# local-ai

`local-ai` helps developers set up local AI chat and coding tools without provider API keys.

It scans your hardware, picks a model your machine can actually run, installs the supporting tools (LM Studio + opencode), writes the opencode config that points at your local server, and launches you into a working chat/coding session.

```
npx local-ai          # diagnostic scan — read-only, no installs
npx local-ai setup    # guided setup — installs + config (asks before any write)
```

Run `npx local-ai` first to see what your hardware can run, what's already installed, and which models `llm-env-check` recommends for your machine. When you're ready to actually wire things up, run `npx local-ai setup`. After the first successful setup, both commands verify the saved setup live — they never re-install if nothing has changed.

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
| `npx local-ai` | Same as `doctor` — read-only diagnostic scan. Prints hardware, system tools, LM Studio status, currently loaded models, and `llm-env-check`'s catalog recommendations for your machine. No installs, no writes. Exits 0 if everything is `ok`, 1 otherwise. |
| `local-ai doctor` | Explicit form of the bare command above. |
| `local-ai setup` | Guided setup. Scans hardware, walks you through any missing tools (asks Yes/No before each install), writes opencode config (with a backup of any existing one), saves state, optionally launches opencode or VS Code. |
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
