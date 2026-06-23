# local-ai

`local-ai` helps developers set up local AI chat and coding tools without provider API keys.

It scans your hardware, picks a model your machine can actually run, installs the supporting tools (LM Studio + opencode), writes the opencode config that points at your local server, and launches you into a working chat/coding session.

```
npx local-ai          # the command that gets it done — guided setup
npx local-ai doctor   # full diagnostic for power users
```

`npx local-ai` is action-first: one line confirming your hardware, one question (Terminal / VS Code / Both), one compact picker for the model to install, and you're done. If everything is already set up, it prints a 2-line "ready" message and exits.

`npx local-ai doctor` is the diagnostic — hardware tiers, every tool's version, the full 10-row `llm-env-check` catalog with ratings. Useful when you want to understand what's available, not when you want to get going.

---

## What local-ai does NOT do

- It is not an IDE.
- It is not a model runner — LM Studio runs the model.
- It is not an agent or chat front end — opencode does that.
- It is not a replacement for any of those tools.

`local-ai` is the missing glue: hardware-aware orchestration with explicit user consent at every write.

---

## How it works

```
npx local-ai
  └─ scanner (read-only)
       ├─ llm-env-check  →  hardware capabilities + runnable tiers
       ├─ LM Studio /v1/models  →  available model IDs
       ├─ cross-reference  →  models your hardware can actually run
       ├─ tool checks: opencode, VS Code, Git, winget
       └─ state + opencode config check
  └─ advisor → recommendations, preferred model, missing tools
  └─ workflow → install (with permission), configure, save state, launch
```

The scanner module is **read-only**. The setup assistant module **writes** — but only after asking. See `docs/SAFETY.md` for the full permission model.

`llm-env-check` is the primary hardware/capability source. See its package on [npm](https://www.npmjs.com/package/llm-env-check).

---

## Why Node is required for `npx local-ai`

`npx` is part of npm, which ships with Node.js. Since you ran `npx local-ai`, Node is already installed — `local-ai` won't try to install it. If you don't have Node:

```
winget install OpenJS.NodeJS.LTS
```

---

## v0.1 supported setup

- **Platform:** Windows 10/11 (x64)
- **Runtime:** LM Studio (local server on `http://127.0.0.1:1234/v1`)
- **Chat/coding tool:** opencode
- **Recommended model:** `Qwen3-Coder-30B-A3B-Instruct-GGUF` (Q4_K_M) for 30B-class hardware; the advisor falls back to smaller models for less powerful machines.

---

## Commands

| Command | What it does |
|---|---|
| `npx local-ai` | Same as `setup`. Action-first: confirms hardware, asks where you want to use it (Terminal / VS Code / Both), picks or auto-detects a model, installs anything missing (Yes/No per tool), writes opencode config (with backup), launches you in. If already set up, prints "ready" in 2 lines and exits. |
| `local-ai setup` | Explicit form of the bare command above. |
| `local-ai doctor` | Power-user diagnostic. Full hardware + tool + LM Studio status table, plus the 10-row `llm-env-check` catalog with ratings. Read-only, no installs. |
| `local-ai status` | Verifies a previously saved setup against the live system. Updates `lastVerified` if all checks pass. |
| `local-ai repair` | Live-verifies saved state. Offers to update the saved model if it's no longer loaded, recreate a missing/invalid opencode config, etc. |
| `local-ai reset` | Deletes the saved state file. Does NOT uninstall tools or remove opencode config. |
| `local-ai cleanup` | Lists large LM Studio model directories with sizes. Does not delete in v0.1 — use LM Studio's model manager. |

---

## Safety model (three-tier)

| Tier | Examples |
|---|---|
| **Read freely** | `llm-env-check`, hardware inspection, version checks, `/v1/models`, reading state/config |
| **Ask first** (Yes/No) | Installing software, creating/updating any config file, writing the state file, opening VS Code, spawning a new terminal |
| **Strong confirmation** (type a word) | Overwriting an existing config, deleting any file, modifying anything outside the state/config paths |

Before overwriting any existing opencode config, `local-ai` makes a timestamped backup — `opencode.json.backup-YYYYMMDD-HHMM`.

Full details in [docs/SAFETY.md](docs/SAFETY.md).

---

## Terminal workflow

1. Run `npx local-ai`.
2. Choose **Terminal** when asked where you want to use local AI.
3. Approve any missing-tool installs (Git, LM Studio, opencode) one by one.
4. After installing LM Studio: open it, download the recommended model, start the Local Server, press Enter in your `local-ai` window.
5. Approve writing the opencode config and saving the state.
6. Optionally approve launching `opencode` in a new terminal window.
7. Chat away. The model runs entirely on your machine.

---

## VS Code workflow

1. Run `npx local-ai`.
2. Choose **VS Code** (or **Both**) when asked.
3. Same tool installs + LM Studio download as above.
4. After opencode config + state are saved, `local-ai` prints the VS Code next-steps card.
5. Approve `code .` to open VS Code in this folder.
6. Inside VS Code: **Terminal → New Terminal**, then run `opencode`. It connects to your local model automatically.

### How to test the VS Code workflow

`local-ai doctor` and `local-ai status` both verify all of the following for VS Code:

- `code --version` succeeds
- `opencode --version` succeeds
- opencode config exists and is valid JSON
- LM Studio reachable at `http://127.0.0.1:1234/v1/models`
- Your saved model ID is in the response

Run those and check exit codes — `0` means VS Code workflow is ready end-to-end.

---

## No provider API keys required

`local-ai` configures opencode to talk to your **local** LM Studio server. No tokens, no rate limits, no provider account. Performance depends on your hardware, the model size, available RAM, and GPU/VRAM.

---

*Developed by Brijesh B*
