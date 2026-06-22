# Architecture

## Two-layer design

`local-ai` is split into a **read-only scanner** layer and a **setup assistant** layer.

```
┌────────────────────────────────────────────────────┐
│ Setup assistant (writes, with explicit consent)    │
│   src/commands/                                    │
│   src/core/workflow.ts                             │
│   src/integrations/{opencode,vscode}.ts            │
│   src/core/state.ts                                │
└────────────────────────────────────────────────────┘
                          ▲
                          │ ScanResult, Advice
                          │
┌────────────────────────────────────────────────────┐
│ Scanner (read-only, never writes)                  │
│   src/core/scanner.ts        ── orchestration      │
│   src/core/envcheck.ts       ── llm-env-check wrap │
│   src/providers/lmstudio.ts  ── server + models    │
│   src/core/advisor.ts        ── interpretation     │
└────────────────────────────────────────────────────┘
                          ▲
                          │
                      Hardware
                      OS, Node, npm, Git, winget
                      opencode, VS Code
                      LM Studio /v1/models
                      State file, opencode config
```

Every command in `src/commands/` either operates entirely within the scanner layer (`doctor`, `status`, `cleanup`) or invokes the scanner first and then engages the setup assistant only after `ask()` consent (`setup`, `repair`, `reset`).

---

## `llm-env-check` as the capability source

`local-ai` imports `llm-env-check` as a runtime dependency and calls `detectSystem()` from its programmatic API as the **first** action of every scan.

`src/core/envcheck.ts` is a thin wrapper that:

1. Calls `detectSystem()` (synchronous, returns `SystemInfo`).
2. Maps `SystemInfo` → the project's stable `HardwareCapabilities` interface.
3. Derives `runnableModelTiers` from RAM/VRAM using a documented table (since `llm-env-check` v1.0.0 returns model-by-model recommendations rather than tier bands).
4. Infers GPU acceleration type (CUDA / Metal / Vulkan / ROCm) from the GPU vendor string.

The rest of the codebase imports only `HardwareCapabilities` from `envcheck.ts`. If `llm-env-check` changes its API or shape in the future, the wrapper absorbs the change and the rest of the code is unaffected.

---

## Data flow from hardware to recommendation

```
detectSystem() →  SystemInfo
                      │
                      ▼
                envcheck.ts → HardwareCapabilities
                                      │
            ┌─────────────────────────┼─────────────────────┐
            ▼                         ▼                     ▼
       scanner.ts             lmstudio.ts             advisor.ts
       (other checks)         (models from /v1)       (uses both)
            │                         │                     │
            └────────────┬────────────┘                     │
                         ▼                                  ▼
                   ScanResult ──────────────► buildAdvice(scan) → Advice
                                                              ├─ hardwareSummary
                                                              ├─ compatibleModels
                                                              ├─ preferredModel
                                                              ├─ missingTools
                                                              ├─ recommendations
                                                              └─ isSetupComplete
```

The advisor never inspects the system directly — it operates purely on the `ScanResult`. This makes the recommendation logic testable in isolation.

---

## State file

Location: `%USERPROFILE%\.local-ai\state.json`

Shape:

```json
{
  "version": "0.1.0",
  "profile": "coding",
  "workflow": "terminal | vscode | both",
  "setupComplete": true,
  "provider": "lmstudio",
  "serverUrl": "http://127.0.0.1:1234/v1",
  "model": "<model id>",
  "configPath": "<path to opencode.json>",
  "lastVerified": "<ISO 8601>"
}
```

### Why we still verify live on every run

The state file is a *cache*, not a source of truth. Between sessions:

- The user may have stopped LM Studio.
- The model in the state may no longer be loaded.
- The opencode config may have been edited or deleted by hand.
- `code` or `opencode` may have been uninstalled.

`status` and `repair` both run a live scan and treat any mismatch as actionable, never as success. `lastVerified` is updated only after a successful end-to-end check. This avoids the most common failure mode of CLI setup tools: silently claiming "ready" when something downstream is broken.

---

## opencode config merge strategy

When the user already has an `opencode.json`, `local-ai` does NOT overwrite it. The merge rules ([integrations/opencode.ts `mergeOpencodeConfig`](../src/integrations/opencode.ts)):

1. **Only `provider.lmstudio` is touched.** Other top-level keys and other providers are preserved verbatim.
2. **`provider.lmstudio.models` is unioned.** Existing model entries are kept; the new model is added alongside.
3. **`$schema` is preserved** if the user already set one.
4. A timestamped backup of the original file is created *before* writing.

Rationale: the user owns their config. We add to it, we don't replace it.

---

## Extension points

The codebase leaves room for v0.2+ work without forcing it now:

- **New providers** (Ollama, llama.cpp): add a sibling module to `src/providers/lmstudio.ts`. The scanner aggregates per-provider checks.
- **New tools** (Aider, Continue CLI): add detection to `src/core/scanner.ts` and a config writer alongside `src/integrations/opencode.ts`.
- **Other platforms** (macOS, Linux): the `os.platform()` check in `scanner.ts:checkOS()` is the single guard. `paths.ts` uses cross-platform `os.homedir()` already; only the install commands (winget) are Windows-specific.

---

*Developed by Brijesh B*
