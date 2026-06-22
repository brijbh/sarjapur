# Sarjapur — Agent Build Prompt
**Version:** 2.0  
**Compatible with:** Claude Code, Codex, or any capable AI coding agent  
**Author:** Brijesh B  
**Last updated:** 2026-06-22

---

## How to Use This Prompt

This document is a complete, self-contained instruction set for an AI coding agent.

Read every section before writing any code. Sections are ordered chronologically and by dependency — later sections build on earlier ones. Each section ends with a **Section Complete** task that commits code and appends a dated status entry to `STATUS.md` in the project root.

Do not skip sections. Do not reorder tasks. Do not assume anything not stated here.

---

## Project Identity

```
Project name:     Sarjapur
npm package name: local-ai
User command:     npx local-ai
Author:           Brijesh B
Repository:       https://github.com/brijbh/sarjapur.git
Project root:     C:\dev\Sarjapur
License:          MIT
```

The `author` field in `package.json` and the footer of every docs page must read: **Developed by Brijesh B**.

---

## Definitions

These terms are used throughout. Refer back here if any term is ambiguous.

| Term | Definition |
|---|---|
| **Project root** | `C:\dev\Sarjapur` on the developer's machine |
| **State file** | `%USERPROFILE%\.local-ai\state.json` — tracks completed setup on the end user's machine |
| **Config file** | `%USERPROFILE%\.config\opencode\opencode.json` — opencode's configuration file on the end user's machine |
| **llm-env-check** | The npm package `llm-env-check` (https://www.npmjs.com/package/llm-env-check). The primary tool used to assess what the user's system can run. It scans hardware (RAM, VRAM, CPU) and returns structured data about model compatibility. local-ai calls this as its first step. |
| **Scanner** | `src/core/scanner.ts` — calls `llm-env-check` plus additional tool checks (opencode, VS Code, LM Studio). Returns structured data only. No writes, no side effects. |
| **Advisor** | `src/core/advisor.ts` — interprets scanner output and produces human-readable advice and model recommendations |
| **Workflow** | A configured end-to-end path. Terminal workflow = opencode + LM Studio + local model. VS Code workflow = same, but launched via VS Code integrated terminal. |
| **Provider** | A local AI runtime. In v0.1, only LM Studio is supported |
| **Setup complete** | State where: state file exists, config file exists, LM Studio responds, and the selected model is available |
| **Dry-run** | Any operation that reads, checks, or prints without writing, installing, or modifying anything |
| **Strong confirmation** | User must type a specific word (e.g. `DELETE`) to proceed — Yes/No is not sufficient |
| **Backup** | A timestamped copy of a file saved before it is overwritten |
| **STATUS.md** | A file in the project root. The agent appends a progress entry after completing each section of this prompt. |
| **v0.1** | The MVP. Windows only. Scope is fixed. Do not add features not listed in this document. |

---

## The Role of `llm-env-check`

**Package:** https://www.npmjs.com/package/llm-env-check  
**Install as:** a runtime dependency (`npm install llm-env-check`)

`llm-env-check` is the hardware and capability scanner that `local-ai` depends on. It is not an optional future integration — it is the first thing `local-ai` calls when the user runs `npx local-ai`.

### What llm-env-check does

It inspects the user's system and returns structured data including:
- Total RAM and available RAM
- GPU presence, VRAM if detectable
- CPU core count and architecture
- OS platform and version
- Which model size tiers the system can realistically run (e.g. 7B, 13B, 30B, 70B)
- Whether GPU acceleration (CUDA/Metal/Vulkan) is available

### How local-ai uses it

local-ai calls `llm-env-check` programmatically and uses its output to:
1. Determine which models are compatible with the user's hardware
2. Filter the list of models available in LM Studio to only show runnable options
3. Recommend the best model the hardware can handle
4. Warn if the system cannot run any useful model at all

### Integration rule

The scanner module (`scanner.ts`) must import and call `llm-env-check` as its first action. The `ScanResult` type must include a `hardware` field populated from `llm-env-check` output.

If `llm-env-check` is not yet published or its API differs from what is described here, implement a thin wrapper (`src/core/envcheck.ts`) that calls it via `execa` (as a CLI) and parses its JSON output. The wrapper interface must remain stable regardless of how the underlying package is invoked.

### Scanner data flow

```
npx local-ai
  └─ scanner.ts
       ├─ llm-env-check  →  hardware capabilities + runnable model tiers
       ├─ LM Studio /v1/models  →  available model IDs
       ├─ cross-reference  →  which available models are compatible
       ├─ opencode check  →  installed or missing
       ├─ VS Code check  →  installed or missing
       └─ state file check  →  setup history
```

---

## Node/npm Reality and the Installation Problem

Because the user runs `npx local-ai`, Node.js and npm already exist on their machine. The CLI cannot and must not attempt to auto-install Node or npm from within itself — doing so is a circular dependency.

However, the user's setup flow described below includes installing other base software (Git, LM Studio, opencode). Those can be installed.

### The bootstrapping rule

| Software | Can local-ai install it? | Method if yes |
|---|---|---|
| Node.js | No — already required to run local-ai | Print: `winget install OpenJS.NodeJS.LTS` |
| npm | No — comes with Node | N/A |
| Git | Yes, with permission | `winget install Git.Git` |
| LM Studio | Yes, with permission | `winget install lmstudio` (verify this winget ID before using) |
| opencode | Yes, with permission | `npm install -g opencode` |

For any software that requires `winget`, local-ai must first check if `winget` is available. If `winget` is not found, print the manual download URL instead and ask the user to install it themselves.

---

## Intended UX Flow (Canonical)

This is the authoritative user experience. Every implementation decision must serve this flow.

```
Step 1 — User runs: npx local-ai

Step 2 — local-ai calls llm-env-check
         Hardware is scanned: RAM, VRAM, CPU, GPU
         System capabilities are returned as structured data

Step 3 — local-ai shows what is ready and what is missing
         Example:
           System
           ✓ Windows 11 (x64)
           ✓ Node.js 22.18.0 / npm 10.9.3
           ✓ 32 GB RAM  ✓ NVIDIA RTX 4070 (12 GB VRAM)
           ✓ Can run: 7B, 13B, 30B models with GPU acceleration
           ✗ Git not found
           ✗ LM Studio not found
           ✗ opencode not found

Step 4 — local-ai asks where the user wants to run local AI
         Options: Terminal / VS Code / Both

Step 5 — local-ai recommends a compatible model
         Based on llm-env-check hardware data + LM Studio available models
         Example: "Your GPU can run Qwen3-Coder-30B-A3B-Instruct-GGUF (Q4_K_M)"

Step 6 — local-ai asks permission before each install/config action
         [Assuming user says Yes to all]:

         → Install Git? Yes
            Installing Git via winget...  ✓ Git installed

         → Install LM Studio? Yes
            Installing LM Studio via winget...  ✓ LM Studio installed
            Please open LM Studio and download: Qwen3-Coder-30B-A3B-Instruct-GGUF Q4_K_M
            Press Enter when done, or S to skip...

         → Install opencode? Yes
            Installing opencode via npm...  ✓ opencode installed

         → Create opencode config for local model? Yes
            ✓ Config written to %USERPROFILE%\.config\opencode\opencode.json

Step 7 — local-ai verifies the full setup
         ✓ LM Studio server reachable
         ✓ Model loaded: qwen3-coder-30b-a3b-instruct
         ✓ opencode config valid
         ✓ Setup complete

Step 8 — local-ai saves state
         → Save setup state? Yes
            ✓ State saved

Step 9 — local-ai launches the workflow

         If Terminal:
           Spawns a new terminal window running: opencode
           User can immediately chat with the local model

         If VS Code:
           Opens VS Code: code .
           Prints instructions: Open Terminal → New Terminal → run: opencode
           (See VS Code testing section below)

Step 10 — On next run: local-ai detects saved state, verifies live,
           prints "Local AI is ready" and does not repeat setup
```

---

## VS Code Workflow — Testing Strategy

This is the question "how do we test VS Code support?" — answered explicitly.

### What VS Code testing means in v0.1

Testing VS Code support does not mean installing or verifying VS Code extensions. It means verifying that the user can reach a working `opencode` session inside VS Code's integrated terminal.

### VS Code test checklist (v0.1)

The `local-ai doctor` and `local-ai status` commands must verify all of the following for VS Code workflow:

| Check | How |
|---|---|
| `code` command exists | `code --version` via execa |
| opencode is installed | `opencode --version` via execa |
| opencode config is valid | File exists and contains the LM Studio provider |
| LM Studio server is reachable | HTTP GET to `http://127.0.0.1:1234/v1/models` |
| Selected model is available | Model ID from state is present in `/v1/models` response |

### VS Code launch and handoff

After all checks pass:
1. Print the VS Code next-steps card (see below).
2. Ask: `Open VS Code in this folder now?`
3. If approved: run `code .` and detach.
4. Print a reminder that the model is accessible at the local server address.

### VS Code next-steps card (print this exactly)

```
VS Code workflow ready.

To start using local AI in VS Code:
  1. VS Code will open (or is already open)
  2. Go to: Terminal → New Terminal
  3. In the terminal, run: opencode
  4. opencode will connect to your local model automatically

Your local model: <model name>
Local server:     http://127.0.0.1:1234/v1

To verify it's working:
  In opencode, type: Hello, are you running locally?
  The model should respond without any internet connection.
```

### VS Code test in development (for the agent building this tool)

To test VS Code workflow during development:
1. Run `npm run dev -- setup` and select VS Code.
2. Verify `code .` is spawned correctly.
3. Verify the next-steps card is printed with the correct model name.
4. Manually open VS Code, open terminal, run `opencode`, confirm it connects to LM Studio.
5. Document this test result in the Section 7 STATUS.md entry.

---

## Permission Guardrails

These rules govern every action the agent takes during development, and every action the CLI enforces at runtime.

### Agent guardrails (during development)

- Read and inspect files freely.
- Run `git status` and `git diff` freely.
- Run `npm run typecheck` and `npm run build` freely.
- Before writing any file, state what you are writing and why.
- Before any `npm install`, state the packages and reason.
- Do not write to `%USERPROFILE%` paths during development except in explicitly marked dry-run or temp-directory tests.
- Do not delete any file without stating the path and reason.
- If a file already exists, inspect it before overwriting.

### CLI runtime guardrails (baked into the tool)

**Allowed without asking the user:**
- Run `llm-env-check` (read-only hardware scan)
- Read OS, RAM, GPU info
- Read Node/npm/Git versions
- Check whether commands exist (`opencode`, `code`, `winget`, etc.)
- Check whether LM Studio server responds
- Read LM Studio `/v1/models`
- Read state file and config file
- Print advice and recommendations

**Require user approval (Yes/No prompt) before:**
- Installing any software (Git, LM Studio, opencode)
- Creating any config file
- Updating any config file
- Writing the state file
- Creating user-level directories
- Opening VS Code or spawning a new terminal
- Running any external command on behalf of the user

**Require strong confirmation (user must type a specific word) before:**
- Overwriting an existing config file
- Deleting any file
- Modifying anything outside the state/config paths defined in this document

**Backup rule:**
Before overwriting any existing config file, create a timestamped backup in the same directory.
Format: `opencode.json.backup-YYYYMMDD-HHMM` (local time — state this in output).

---

## Git Commit Rules

- All commits must include only files inside the project root.
- Commit after each section is complete — not mid-section.
- Run `npm run typecheck` and `npm run build` before every commit (once the build system exists).
- Run `git status` and `git diff` before every commit.
- If typecheck or build fails, fix before committing.

### Commit message format

```
<type>: <short description>

<optional body>
```

Types: `init`, `feat`, `fix`, `refactor`, `docs`, `chore`, `test`

### Prescribed commit messages

| Section | Commit message |
|---|---|
| Section 1 | `init: scaffold Sarjapur project with TypeScript and package.json` |
| Section 2 | `feat: implement llm-env-check integration and scanner module` |
| Section 3 | `feat: implement LM Studio provider detection and model filtering` |
| Section 4 | `feat: implement advisor, state, permissions, and utility modules` |
| Section 5 | `feat: implement CLI entry point and command skeletons` |
| Section 6 | `feat: implement doctor and status commands` |
| Section 7 | `feat: implement setup command and workflow orchestration` |
| Section 8 | `feat: implement opencode config generation, merge, and backup` |
| Section 9 | `feat: implement repair and reset commands` |
| Section 10 | `feat: implement cleanup command in list-only mode` |
| Section 11 | `docs: add README and documentation files` |
| Section 12 | `chore: final typecheck, build verification, and STATUS.md completion` |

---

## STATUS.md Rules

`STATUS.md` lives in the project root. After completing every section, **append** a new entry. Never overwrite previous entries. Create the file on first write.

### Entry format

```markdown
## Section <N> — <Section Title>
**Completed:** <ISO 8601 timestamp>
**Commit:** `<commit message>`

### What was done
- <file or thing created/changed>
- <file or thing created/changed>

### Known gaps or deferred items
- <anything intentionally deferred>

---
```

---

## Project Boundaries

- **Platform:** Windows only in v0.1. Scanner must detect non-Windows and exit with a clear message.
- **Language:** TypeScript, ESM (`"type": "module"` in package.json)
- **Node minimum:** 18.0.0. npm minimum: 9.0.0
- **Binary name:** `local-ai`
- **Key dependency:** `llm-env-check` (runtime, not dev-only)

### What v0.1 does NOT include

Leave clean extension points but do not implement:
- Ollama support
- Aider, Continue CLI, Kilo Code integration
- VS Code extension installation or configuration
- Claude Code or Gemini CLI integration
- Custom model downloads or model training
- Multi-agent workflows
- macOS or Linux support

---

## Source Layout

```
C:\dev\Sarjapur\
  src/
    cli.ts                      ← entry point, registers all commands
    commands/
      doctor.ts
      setup.ts
      status.ts
      repair.ts
      reset.ts
      cleanup.ts
    core/
      scanner.ts                ← calls llm-env-check + tool checks → ScanResult
      envcheck.ts               ← wrapper for llm-env-check package
      advisor.ts                ← interprets ScanResult → Advice + model recommendation
      state.ts                  ← read/write/clear state file
      permissions.ts            ← ask(), strongConfirm(), choose() prompt helpers
      paths.ts                  ← all Windows path constants
      workflow.ts               ← orchestrates terminal/vscode/both flows
    providers/
      lmstudio.ts               ← LM Studio server check + model list
    integrations/
      opencode.ts               ← detection, config generation, merge, backup, spawn
      vscode.ts                 ← VS Code detection, launch, next-steps card
    utils/
      command.ts                ← runCommand(), commandExists()
      files.ts                  ← fileExists(), readJson, writeJson, backupFile, folderSize
      format.ts                 ← chalk output helpers
      json.ts                   ← safeParseJson with Zod
  docs/
    ARCHITECTURE.md
    ROADMAP.md
    SAFETY.md
    UX.md
  dist/                         ← compiled output (git-ignored)
  STATUS.md                     ← agent progress log
  README.md
  package.json
  tsconfig.json
  .gitignore
  .eslintrc.json
```

---

## Error Handling Philosophy

Apply consistently across the entire codebase.

- All errors display with `✗` prefix in red.
- Stack traces hidden by default; shown with `--debug` flag.
- Unhandled promise rejections exit with code `1`.
- User-cancelled prompts (Ctrl+C) exit with code `0` and print `Cancelled.`
- `local-ai doctor` exits `0` if all checks pass, `1` if any check is `warn` or `missing`.
- `local-ai status` exits `0` if setup is complete and verified, `1` otherwise.
- All other commands exit `0` on success, `1` on error.

---
---

# SECTION 1 — Project Scaffold

**Goal:** Create a working TypeScript ESM npm CLI project connected to Git.

---

### Task 1.1 — Inspect or create project root

- Create `C:\dev\Sarjapur`.
- cd / change dir into `C:\dev\Sarjapur` and run `git status` inside it. Report what is already there before doing anything.

### Task 1.2 — Initialize or connect Git

- If `.git` does not exist: run `git init`.
- Add remote: `git remote add origin https://github.com/brijbh/sarjapur.git`
- If a remote already exists, verify the URL is correct. Update if not.
- Do not push yet.

### Task 1.3 — Create `.gitignore`

```
node_modules/
dist/
*.js.map
.env
misc
```

### Task 1.4 — Create `package.json`

```json
{
  "name": "local-ai",
  "version": "0.1.0",
  "description": "Set up local AI coding and chat tools without provider API keys.",
  "author": "Brijesh B",
  "type": "module",
  "bin": {
    "local-ai": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/cli.ts",
    "start": "node dist/cli.js",
    "typecheck": "tsc --noEmit",
    "lint": "eslint ."
  },
  "keywords": ["local-ai", "opencode", "lmstudio", "llm-env-check", "cli", "no-api-key"],
  "license": "MIT",
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "@inquirer/prompts": "^5.0.0",
    "chalk": "^5.0.0",
    "execa": "^9.0.0",
    "zod": "^3.22.0",
    "llm-env-check": "latest"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "tsx": "^4.0.0",
    "@types/node": "^20.0.0",
    "eslint": "^9.0.0"
  }
}
```

Note: `llm-env-check` is a runtime dependency, not a devDependency.

### Task 1.5 — Create `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Task 1.6 — Run npm install

Run `npm install` in the project root. Verify `llm-env-check` appears in `node_modules`. Report the result.

### Task 1.7 — Inspect llm-env-check

After `npm install`, inspect the `llm-env-check` package:
- Check `node_modules/llm-env-check/package.json` for its `main`, `bin`, and `exports` fields.
- Check whether it exposes a programmatic API or only a CLI.
- Document findings in the Section 1 STATUS.md entry — this determines whether `envcheck.ts` calls it as a library or via `execa`.

### Task 1.8 — Create empty source files

Create all files in the Source Layout above. Each should contain only:
```typescript
// TODO: implement
```
Do not implement logic yet.

### Task 1.9 — Create minimal `src/cli.ts`

Write a minimal entry point that:
- Imports `commander`
- Registers `--version` returning `0.1.0`
- Registers `--help`
- Prints the welcome banner when run with no arguments
- Parses `process.argv`

The welcome banner:
```
Welcome to local-ai

This tool helps you set up local AI chat and coding tools
without provider API keys.

Developed by Brijesh B
```

### Task 1.10 — Run typecheck

Run `npm run typecheck`. Fix all errors before proceeding.

### Task 1.11 — Section complete

- Run `git status` and `git diff`
- Commit: `init: scaffold Sarjapur project with TypeScript and package.json`
- Append Section 1 entry to `STATUS.md`. Include the llm-env-check inspection findings.

---

# SECTION 2 — llm-env-check Integration and Scanner

**Goal:** Implement the `envcheck.ts` wrapper for `llm-env-check` and the full scanner module. This section is the most critical — all model recommendations and compatibility checks depend on it.

---

### Task 2.1 — Implement `src/core/envcheck.ts`

This module wraps `llm-env-check`. Its interface must remain stable regardless of how the underlying package works.

Based on the inspection done in Task 1.7, implement one of these two strategies:

**Strategy A — Programmatic API** (if `llm-env-check` exports a function):
```typescript
import { checkEnv } from 'llm-env-check';
const result = await checkEnv();
```

**Strategy B — CLI invocation** (if `llm-env-check` only has a bin):
```typescript
import { runCommand } from '../utils/command.js';
const output = await runCommand('llm-env-check', ['--json']);
const result = JSON.parse(output ?? '{}');
```

Regardless of strategy, `envcheck.ts` must export this stable interface:

```typescript
export interface HardwareCapabilities {
  ram: {
    totalGB: number;
    availableGB: number;
  };
  gpu: {
    detected: boolean;
    name?: string;
    vramGB?: number;
    accelerationAvailable: boolean;       // CUDA, Vulkan, Metal, etc.
    accelerationType?: string;
  };
  cpu: {
    cores: number;
    arch: string;
  };
  os: {
    platform: string;
    version?: string;
  };
  runnableModelTiers: ModelTier[];        // which size classes can run
  notes: string[];                        // any warnings from llm-env-check
}

export type ModelTier = '1B' | '3B' | '7B' | '13B' | '30B' | '70B' | '70B+';

export async function getHardwareCapabilities(): Promise<HardwareCapabilities>
```

If `llm-env-check` does not return data in this shape, map its output to this interface inside `envcheck.ts`. The rest of the codebase uses only `HardwareCapabilities` — never raw `llm-env-check` output.

If `llm-env-check` does not include `runnableModelTiers`, derive it from RAM and VRAM using this table:

| RAM | VRAM | Max tier |
|---|---|---|
| < 8 GB | any | 3B |
| 8–15 GB | < 4 GB | 7B (CPU-only, slow) |
| 8–15 GB | ≥ 4 GB | 7B |
| 16–31 GB | < 4 GB | 13B (CPU-only, slow) |
| 16–31 GB | ≥ 4 GB | 13B |
| 32–63 GB | < 8 GB | 13B |
| 32–63 GB | ≥ 8 GB | 30B |
| ≥ 64 GB | ≥ 12 GB | 70B |
| ≥ 64 GB | ≥ 24 GB | 70B+ |

Include all tiers the hardware can run, not just the max. Example: a 32 GB / 12 GB VRAM machine returns `['1B', '3B', '7B', '13B', '30B']`.

### Task 2.2 — Define scanner types

In `src/core/scanner.ts`, define and export:

```typescript
export type CheckStatus = 'ok' | 'warn' | 'missing' | 'error';

export interface CheckResult {
  label: string;
  status: CheckStatus;
  value?: string;
  detail?: string;
}

export interface ScanResult {
  hardware: HardwareCapabilities;           // from llm-env-check
  os: CheckResult;
  arch: CheckResult;
  node: CheckResult;
  npm: CheckResult;
  git: CheckResult;
  winget: CheckResult;
  opencode: CheckResult;
  vscode: CheckResult;
  lmstudio: CheckResult;
  models: CheckResult & {
    modelIds?: string[];
    compatibleModelIds?: string[];          // filtered by hardware capabilities
    selectedModel?: string;
  };
  state: CheckResult;
  opencodeConfig: CheckResult;
}
```

### Task 2.3 — Implement OS and architecture check

- Use `os.platform()`. If not `win32`, set status `warn`: `v0.1 supports Windows only.`
- Use `os.arch()` for architecture.

### Task 2.4 — Implement Node and npm version check

- Read Node from `process.version`. Check ≥ 18.0.0.
- Run `npm --version` via execa. Check ≥ 9.0.0.
- Since the user invoked `npx local-ai`, both exist. This check is for version compatibility only.

### Task 2.5 — Implement Git check

- Run `git --version` via execa.
- If found: status `ok` with version string.
- If missing: status `missing` with detail: `Git is required. local-ai can install it via winget.`

### Task 2.6 — Implement winget check

- Run `winget --version` via execa.
- If found: status `ok` with version.
- If missing: status `warn` with detail: `winget not found. Some installations will require manual download.`

### Task 2.7 — Implement opencode check

- Run `opencode --version` via execa.
- If found: status `ok`. If missing: status `missing`.

### Task 2.8 — Implement VS Code check

- Run `code --version` via execa.
- If found: status `ok`. If missing: status `missing` with detail: `Open VS Code → Command Palette → Shell Command: Install 'code' command in PATH`

### Task 2.9 — Implement state file check

- Check `STATE_FILE` from `paths.ts`.
- If exists and valid JSON: status `ok`. If invalid JSON: status `warn`. If missing: status `missing`.

### Task 2.10 — Implement opencode config check

- Check `OPENCODE_CONFIG_FILE` from `paths.ts`.
- If exists and valid JSON: status `ok`. Otherwise `warn` or `missing`.

### Task 2.11 — Implement `paths.ts`

```typescript
import os from 'os';
import path from 'path';

export const STATE_DIR = path.join(os.homedir(), '.local-ai');
export const STATE_FILE = path.join(STATE_DIR, 'state.json');
export const OPENCODE_CONFIG_DIR = path.join(os.homedir(), '.config', 'opencode');
export const OPENCODE_CONFIG_FILE = path.join(OPENCODE_CONFIG_DIR, 'opencode.json');
export const LMSTUDIO_BASE_URL = 'http://127.0.0.1:1234/v1';
export const LMSTUDIO_MODELS_ENDPOINT = `${LMSTUDIO_BASE_URL}/models`;
export const LMSTUDIO_MODEL_DIRS = [
  path.join(os.homedir(), '.lmstudio', 'models'),
  path.join(os.homedir(), '.lmstudio', 'hub', 'models'),
];
```

### Task 2.12 — Implement `runScan()` function

Export `runScan(): Promise<ScanResult>` that:
1. Calls `getHardwareCapabilities()` from `envcheck.ts` first.
2. Runs all other checks in parallel where safe.
3. Stubs `lmstudio` and `models` (filled in Section 3).
4. Returns the full `ScanResult`.

### Task 2.13 — Run typecheck

Fix all errors.

### Task 2.14 — Section complete

- Run `git status` and `git diff`
- Commit: `feat: implement llm-env-check integration and scanner module`
- Append Section 2 entry to `STATUS.md`. Include which invocation strategy was used for llm-env-check (A or B) and why.

---

# SECTION 3 — LM Studio Provider and Model Filtering

**Goal:** Detect LM Studio server and models, then filter models by hardware compatibility.

---

### Task 3.1 — Implement server reachability check

In `src/providers/lmstudio.ts`:
- HTTP GET `http://127.0.0.1:1234/v1/models` with 3-second timeout using built-in `fetch`.
- HTTP 200: status `ok`.
- Connection refused or timeout: status `missing` with detail: `LM Studio server not reachable. Open LM Studio and start the local server.`
- Never throw — always catch and return a structured result.

### Task 3.2 — Implement model list parsing

```typescript
const LMStudioModelSchema = z.object({
  id: z.string(),
  object: z.string(),
  owned_by: z.string().optional(),
});

const LMStudioModelsResponseSchema = z.object({
  data: z.array(LMStudioModelSchema),
  object: z.string(),
});
```

Parse using Zod. On schema mismatch: return `status: 'warn'` with format detail.

### Task 3.3 — Implement hardware-aware model filtering

This is the key integration between `llm-env-check` and LM Studio.

Export `filterCompatibleModels(modelIds: string[], hardware: HardwareCapabilities): string[]`.

Rules:
- A model ID is compatible if its name suggests a parameter size within `hardware.runnableModelTiers`.
- Parse size hints from model IDs using these patterns: `7b`, `13b`, `30b`, `70b`, `3b`, `1b` (case-insensitive).
- If no size hint is found in the ID, include the model (cannot determine incompatibility).
- If no models are compatible after filtering, return all models with a warning.

Example: hardware supports up to 30B. Model ID `qwen3-coder-70b` is filtered out. `qwen3-coder-30b` is included.

### Task 3.4 — Implement model preference selection

Given a filtered list, select the best model:

1. ID contains `qwen3-coder` (case-insensitive)
2. ID contains `qwen`
3. ID contains `coder`
4. ID contains `code`
5. No match → return `null` (caller will ask user to choose)

If multiple match the same tier: pick the one with the highest runnable parameter size (prefer larger models within hardware capability). If still tied: first in list.

Export `selectPreferredModel(modelIds: string[], hardware: HardwareCapabilities): string | null`.

### Task 3.5 — Export `checkLMStudio()` function

```typescript
export async function checkLMStudio(hardware: HardwareCapabilities): Promise<{
  server: CheckResult;
  models: CheckResult & {
    modelIds?: string[];
    compatibleModelIds?: string[];
    selectedModel?: string;
  };
}>
```

This function must pass `hardware` into `filterCompatibleModels`.

### Task 3.6 — Wire LM Studio into scanner

Update `runScan()` to call `checkLMStudio(hardware)` and populate `lmstudio` and `models` fields. Note that `hardware` must be fetched before this call.

### Task 3.7 — Run typecheck

Fix all errors.

### Task 3.8 — Section complete

- Run `git status` and `git diff`
- Commit: `feat: implement LM Studio provider detection and model filtering`
- Append Section 3 entry to `STATUS.md`

---

# SECTION 4 — Core Modules

**Goal:** Implement advisor, state manager, permissions helpers, format utilities, and file utilities.

---

### Task 4.1 — Implement `advisor.ts`

```typescript
export interface Advice {
  summary: CheckResult[];
  recommendations: string[];
  hardwareSummary: string;           // e.g. "32 GB RAM, RTX 4070 — can run up to 30B models"
  preferredModel: string | null;
  compatibleModels: string[];        // list of all compatible model IDs
  preferredWorkflow: 'terminal' | 'vscode' | 'both' | null;
  isSetupComplete: boolean;
  missingTools: string[];            // e.g. ['git', 'lmstudio', 'opencode']
}

export function buildAdvice(scan: ScanResult): Advice
```

Rules:
- `isSetupComplete`: true only if state, opencode config, LM Studio, and models are all `ok`.
- `missingTools`: derive from scan results — list tool names that are `missing`.
- `hardwareSummary`: build from `scan.hardware` in plain English.
- `recommendations`: ordered by blocking severity (most critical gap first).

### Task 4.2 — Implement `state.ts`

```typescript
const StateSchema = z.object({
  version: z.string(),
  profile: z.string(),
  workflow: z.enum(['terminal', 'vscode', 'both']),
  setupComplete: z.boolean(),
  provider: z.string(),
  serverUrl: z.string(),
  model: z.string(),
  configPath: z.string(),
  lastVerified: z.string(),       // ISO 8601
});

export type State = z.infer<typeof StateSchema>;
```

Export:
- `readState(): Promise<State | null>` — null if missing or invalid
- `writeState(state: State): Promise<void>` — atomic write (temp file → rename)
- `clearState(): Promise<void>` — deletes state file only

`writeState` never prompts — the caller must have already obtained user approval.

### Task 4.3 — Implement `permissions.ts`

```typescript
export async function ask(message: string): Promise<boolean>
export async function strongConfirm(message: string, requiredWord: string): Promise<boolean>
export async function choose<T extends string>(message: string, choices: T[]): Promise<T>
```

All must handle Ctrl+C: exit code 0, print `Cancelled.`

### Task 4.4 — Implement `format.ts`

```typescript
export function printHeader(title: string): void
export function printCheckResult(r: CheckResult): void   // ✓ / ⚠ / ✗
export function printSuccess(msg: string): void
export function printWarn(msg: string): void
export function printError(msg: string): void
export function printInfo(msg: string): void
export function printSection(title: string): void
export function printHardwareSummary(hw: HardwareCapabilities): void
export function printVSCodeCard(model: string): void     // prints the VS Code next-steps card
```

`printVSCodeCard` must print the exact VS Code next-steps card text defined in the "VS Code Workflow — Testing Strategy" section above, substituting the `model` parameter.

### Task 4.5 — Implement `files.ts`

```typescript
export async function fileExists(p: string): Promise<boolean>
export async function readJsonFile<T>(p: string): Promise<T | null>
export async function writeJsonFile(p: string, data: unknown): Promise<void>
export async function backupFile(p: string): Promise<string>      // returns backup path
export async function getFolderSize(p: string): Promise<number>   // recursive bytes
```

`backupFile`: copy to `<path>.backup-YYYYMMDD-HHMM` (local time). Throw if source missing.

### Task 4.6 — Implement `command.ts`

```typescript
export async function runCommand(cmd: string, args: string[]): Promise<string | null>
export async function commandExists(cmd: string): Promise<boolean>
```

Use `execa`. Never let exceptions bubble — always return `null` or `false`.

### Task 4.7 — Implement `json.ts`

```typescript
export function safeParseJson<T>(schema: ZodSchema<T>, raw: string): T | null
```

### Task 4.8 — Implement `workflow.ts` stub

```typescript
export type WorkflowTarget = 'terminal' | 'vscode' | 'both';

// Stub — fully implemented in Section 7
export async function runSetupWorkflow(
  target: WorkflowTarget,
  scan: ScanResult,
  advice: Advice
): Promise<void>
```

### Task 4.9 — Run typecheck

Fix all errors.

### Task 4.10 — Section complete

- Run `git status` and `git diff`
- Commit: `feat: implement advisor, state, permissions, and utility modules`
- Append Section 4 entry to `STATUS.md`

---

# SECTION 5 — CLI Entry Point and Command Skeletons

**Goal:** Wire up `commander`, register all commands, implement functional stubs.

---

### Task 5.1 — Implement `src/cli.ts`

```typescript
#!/usr/bin/env node
import { program } from 'commander';
// import and register: doctor, setup, status, repair, reset, cleanup

program
  .name('local-ai')
  .description('Set up local AI coding and chat tools without provider API keys. Developed by Brijesh B.')
  .version('0.1.0');

// Register all commands
// Default: run setup when no subcommand given

program.parse(process.argv);
if (!process.argv.slice(2).length) {
  // invoke setup
}
```

### Task 5.2 — Implement command stubs

Each file in `src/commands/` exports:
```typescript
export function register(program: Command): void
```

Each stub prints the command name and `[not yet implemented]`.

### Task 5.3 — Run `npm run build`

Fix all errors. Build must succeed.

### Task 5.4 — Verify binary

Run `node dist/cli.js --help`. Confirm all commands are listed.

### Task 5.5 — Run typecheck

Fix all errors.

### Task 5.6 — Section complete

- Run `git status` and `git diff`
- Commit: `feat: implement CLI entry point and command skeletons`
- Append Section 5 entry to `STATUS.md`

---

# SECTION 6 — Doctor and Status Commands

**Goal:** Implement the two read-only commands. These must never modify anything.

---

### Task 6.1 — Implement `doctor` command

Flow:
1. Print welcome banner.
2. Call `runScan()`.
3. Print hardware summary via `printHardwareSummary()`.
4. Print each check result via `printCheckResult()`.
5. Call `buildAdvice()`. Print recommendations.
6. Exit 0 if all `ok`; exit 1 if any `warn` or `missing`.

Example output:
```
Welcome to local-ai  —  Developed by Brijesh B

Checking your system...

Hardware
  32 GB RAM  |  NVIDIA RTX 4070 (12 GB VRAM)  |  GPU acceleration: CUDA
  Can run: 1B, 3B, 7B, 13B, 30B models

System
✓ Windows 11 (win32 x64)
✓ Node.js 22.18.0
✓ npm 10.9.3
✓ Git 2.44.0
✓ winget 1.8.0

Local AI Runtime
✓ LM Studio server reachable
✓ Models detected (2 total, 2 compatible with your hardware):
  - qwen3-coder-30b-a3b-instruct   ← recommended
  - qwen-7b-instruct

Coding Tools
✓ opencode detected
✓ VS Code command detected

Saved Setup
⚠ No local-ai setup state found

Recommendations
→ Run: local-ai setup
```

### Task 6.2 — Implement `status` command

Flow:
1. Read state file. If missing: print `No setup found. Run: local-ai setup` → exit 1.
2. If exists: run live verification (LM Studio reachable, model available, config exists).
3. Print state + live check results.
4. All pass: print `Local AI is ready.\n\nNext command:\nopencode` → exit 0.
5. Any fail: print what is broken + `Run: local-ai repair` → exit 1.

### Task 6.3 — Run typecheck and build. Fix all errors.

### Task 6.4 — Section complete

- Commit: `feat: implement doctor and status commands`
- Append Section 6 entry to `STATUS.md`

---

# SECTION 7 — Setup Command and Workflow Orchestration

**Goal:** Implement the full guided setup flow.

---

### Task 7.1 — Implement `setup` command entry

Flow:
```
1. Print welcome banner
2. Call runScan()
3. Print hardware summary + all check results
4. Call buildAdvice()
5. If isSetupComplete → print status → exit 0 (do not repeat)
6. Print compatible models and hardware recommendation
7. Ask: "Where do you want to use local AI?" → Terminal / VS Code / Both
8. Call runSetupWorkflow(target, scan, advice)
```

### Task 7.2 — Implement `workflow.ts` — installation phase

Before any workflow-specific config, handle missing base tools. This runs for all workflow targets.

For each missing tool in `advice.missingTools`, ask permission then install:

**Git missing:**
```
Git is not installed. Git is required for opencode.

Install Git via winget? Yes/No
→ If Yes: run: winget install Git.Git
→ If winget missing: print: Download from https://git-scm.com/download/win
```

**LM Studio missing:**
```
LM Studio is not installed. LM Studio runs the local AI model.

Install LM Studio via winget? Yes/No
→ If Yes: run: winget install lmstudio (verify the correct winget package ID before hardcoding)
→ After install: print:
  LM Studio installed.
  
  Next: download a model inside LM Studio.
  Recommended for your hardware: <model name from advice>
  
  Steps:
  1. Open LM Studio
  2. Go to the Search tab
  3. Search: <recommended model>
  4. Download the Q4_K_M variant
  5. Go to Local Server → Load model → Start server
  
  Press Enter when LM Studio server is ready, or S to skip...
→ Wait for user input before continuing.
```

**opencode missing:**
```
opencode is not installed.

Install opencode? Yes/No
→ If Yes: run: npm install -g opencode
```

After all tools are handled, re-scan LM Studio (`checkLMStudio`) before proceeding to config — the user may have just loaded a model.

### Task 7.3 — Implement `workflow.ts` — terminal flow

1. Verify: opencode installed, LM Studio reachable, model available.
2. Check opencode config. If missing: ask → call `writeOpencodeConfig()`.
3. Re-verify full setup.
4. Ask: `Save setup state? Yes/No` → If yes: `writeState()`.
5. Print:
   ```
   Terminal workflow ready.
   
   Next command:
   opencode
   
   Developed by Brijesh B
   ```
6. Ask: `Open opencode in a new terminal window now? Yes/No`
7. If yes: spawn opencode in a new terminal window.
   - On Windows: `Start-Process powershell -ArgumentList "-NoExit", "-Command", "opencode"`
   - Use `execa` with `detached: true`. If spawn fails, print manual command and exit gracefully.

### Task 7.4 — Implement `workflow.ts` — VS Code flow

1. Check `code` command. If missing: print instructions (from Definitions section). Continue.
2. Run opencode + config steps from terminal flow (steps 1–4).
3. Print the VS Code next-steps card via `printVSCodeCard(model)`.
4. Ask: `Open VS Code in this folder now? Yes/No`
5. If yes: run `code .` via execa.

### Task 7.5 — Implement `workflow.ts` — Both flow

Run terminal flow first, then VS Code flow. Share the opencode config step — do not write config twice.

### Task 7.6 — Run typecheck and build. Fix all errors.

### Task 7.7 — Section complete

- Commit: `feat: implement setup command and workflow orchestration`
- Append Section 7 entry to `STATUS.md`. Include any VS Code launch test result.

---

# SECTION 8 — opencode Integration

**Goal:** Config generation, merge strategy, backup, and opencode spawn.

---

### Task 8.1 — Implement config generation

Export `generateOpencodeConfig(modelId: string): object`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "lmstudio": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "LM Studio (local)",
      "options": {
        "baseURL": "http://127.0.0.1:1234/v1"
      },
      "models": {
        "<modelId>": {
          "name": "<derived human name> (local)"
        }
      }
    }
  }
}
```

Use the model ID exactly as returned by LM Studio. Derive human name per the Appendix.

### Task 8.2 — Implement config merge strategy

Export `mergeOpencodeConfig(existing: object, generated: object): object`.

Rules:
- Touch only `provider.lmstudio`.
- Leave all other keys untouched.
- Deep-merge `provider.lmstudio.models` — add new model, do not remove existing ones.
- Do not change `$schema` if it already exists.

### Task 8.3 — Implement config write flow

Export `writeOpencodeConfig(modelId: string): Promise<{ backedUp: boolean; backupPath: string | null; written: boolean }>`.

1. If config exists: ask `opencode config already exists. Back up and update it? Yes/No`
   - Yes: `backupFile()` → merge → write
   - No: print what it would have written → return without writing
2. If missing: create dir if needed → write generated config.

### Task 8.4 — Implement detection functions

```typescript
export async function checkOpencodeInstalled(): Promise<boolean>
export async function checkOpencodeConfig(): Promise<{ exists: boolean; path: string; valid: boolean }>
```

### Task 8.5 — Implement opencode spawn

Export `launchOpencode(cwd: string): Promise<void>`.

- Spawn `opencode` detached in `cwd` using execa.
- On failure: print manual fallback:
  ```
  Could not launch opencode automatically.
  To start manually:
    cd <cwd>
    opencode
  ```

### Task 8.6 — Run typecheck and build. Fix all errors.

### Task 8.7 — Section complete

- Commit: `feat: implement opencode config generation, merge, and backup`
- Append Section 8 entry to `STATUS.md`

---

# SECTION 9 — Repair and Reset Commands

---

### Task 9.1 — Implement `repair` command

1. Read state file. If missing: `No saved setup found. Run: local-ai setup` → exit 1.
2. Run live verification:

| Check | Failure response |
|---|---|
| LM Studio not reachable | Print: open LM Studio and start server. Run repair again. |
| Model from state not in `/v1/models` | Ask: update config to use a different available model? |
| opencode config missing | Ask: recreate opencode config? |
| Config exists but model ID differs | Ask: update config to current model? |

3. After fixes: re-verify. Update `lastVerified` in state if all pass.

### Task 9.2 — Implement `reset` command

1. Print: "Reset will delete the local-ai state file. opencode config and installed tools are not affected."
2. Ask: `Reset local-ai setup state? Yes/No`
3. If yes: `clearState()`.
4. Print: `State cleared. Run: local-ai setup to start fresh.`

### Task 9.3 — Run typecheck and build. Fix all errors.

### Task 9.4 — Section complete

- Commit: `feat: implement repair and reset commands`
- Append Section 9 entry to `STATUS.md`

---

# SECTION 10 — Cleanup Command

---

### Task 10.1 — Implement `cleanup` — list mode

1. Print: `Scanning for large LM Studio model files...`
2. Check both `LMSTUDIO_MODEL_DIRS` from `paths.ts`.
3. For each that exists: list subdirectories + sizes via `getFolderSize()`.
4. Sort descending by size. Print:

```
Large LM Studio model files found:

  1. Qwen3-Coder-30B-A3B-Instruct-GGUF    18.4 GB   C:\Users\...\models\...
  2. Qwen3.6-35B-A3B-GGUF                 22.0 GB   C:\Users\...\hub\models\...

To free up space, remove models from within LM Studio's model manager.
local-ai does not delete model files in v0.1.
```

5. If no directories found: explain where LM Studio stores models.

### Task 10.2 — Add `--delete` stub

```
Model deletion is not available in v0.1.
To remove models: use LM Studio → My Models → Delete.
```

### Task 10.3 — Run typecheck and build. Fix all errors.

### Task 10.4 — Section complete

- Commit: `feat: implement cleanup command in list-only mode`
- Append Section 10 entry to `STATUS.md`

---

# SECTION 11 — Documentation

---

### Task 11.1 — Write `README.md`

Include:

- **What local-ai does:** `local-ai helps developers set up local AI chat and coding tools without provider API keys.`
- **What it does not do:** not an IDE, model runner, agent, or replacement for opencode/LM Studio.
- **How it works:** calls `llm-env-check` to assess hardware, detects compatible models, guides installation, configures opencode.
- **Why Node is required for `npx local-ai`:** `npx` requires Node. If not installed: `winget install OpenJS.NodeJS.LTS`
- **MVP supported setup:** `opencode → LM Studio → Qwen3-Coder-30B (or compatible model)`
- **Commands table**
- **Safety model:** three-tier permission system summary
- **Terminal workflow:** step-by-step
- **VS Code workflow:** step-by-step including how to test
- **No-provider-API-key note:** `No provider API key required for local mode. Performance depends on your hardware, model size, RAM, and GPU.`
- **Footer:** `Developed by Brijesh B`

### Task 11.2 — Write `docs/ARCHITECTURE.md`

Cover:
- Two-layer design: scanner (read-only) vs setup assistant (writes with permission)
- `llm-env-check` as the hardware capability source and how `envcheck.ts` wraps it
- How hardware capabilities flow from `llm-env-check` → scanner → advisor → model recommendation
- State file design and verification-on-every-run rationale
- Config merge strategy rationale
- Extension points for future providers and tools
- Footer: `Developed by Brijesh B`

### Task 11.3 — Write `docs/ROADMAP.md`

- v0.1: Windows, LM Studio, opencode, terminal + VS Code
- v0.2: Ollama support, macOS, model cleanup deletion, VS Code extension check
- v0.3: Aider, Continue CLI integration
- Future: richer `llm-env-check` integration (model benchmarking, quantization advice)
- Footer: `Developed by Brijesh B`

### Task 11.4 — Write `docs/SAFETY.md`

Cover:
- Three-tier permission model with concrete examples
- Backup policy and naming convention
- What local-ai never does automatically
- How to audit changes (state file, backup files)
- How to fully undo a local-ai setup (manual steps)
- Why state is verified live on every run
- Footer: `Developed by Brijesh B`

### Task 11.5 — Write `docs/UX.md`

Cover:
- Core UX principle: Check automatically. Ask before changes. Explain manual fallback. Do not repeat completed setup.
- Full canonical user journey (reference the "Intended UX Flow" section above)
- VS Code testing explanation
- Error states and what the user sees
- Exit codes
- Ctrl+C handling
- Footer: `Developed by Brijesh B`

### Task 11.6 — Section complete

- Commit: `docs: add README and documentation files`
- Append Section 11 entry to `STATUS.md`

---

# SECTION 12 — Final Verification

---

### Task 12.1 — Run full typecheck

```bash
npm run typecheck
```

Fix every error. No `@ts-ignore` or untyped `any` without an explanatory comment.

### Task 12.2 — Run full build

```bash
npm run build
```

Must complete with zero errors.

### Task 12.3 — Verify binary

Run each and report output:
```bash
node dist/cli.js --help
node dist/cli.js doctor
node dist/cli.js status
```

### Task 12.4 — Review STATUS.md

Read `STATUS.md`. Verify entries for all 11 previous sections exist. Add any missing.

### Task 12.5 — Final STATUS.md entry

```markdown
## Section 12 — Final Verification
**Completed:** <ISO 8601 timestamp>
**Commit:** `chore: final typecheck, build verification, and STATUS.md completion`

### What was done
- Full typecheck passed with zero errors
- Full build passed with zero errors
- Binary verified: --help, doctor, status
- STATUS.md complete with all section entries

### Known gaps or deferred items
- <list all v0.1 deferred items here>

---
```

### Task 12.6 — Final commit

- Run `git status` and `git diff`
- Commit: `chore: final typecheck, build verification, and STATUS.md completion`

### Task 12.7 — Final report

Print:
1. Project root location and Git remote status
2. Complete list of files created
3. Commands and their state: fully implemented / stub / deferred
4. How to run locally: `npm run dev` and `node dist/cli.js`
5. llm-env-check integration method used (programmatic or CLI)
6. Build and typecheck result
7. What was not implemented in v0.1
8. Suggested next steps for v0.2

---

## Appendix A — No-Model Fallback Instructions

When LM Studio has no models loaded, print:

```
No models detected in LM Studio.

Based on your hardware, we recommend:
  <model name from advice.preferredModel or default below>

Default recommendation: Qwen3-Coder-30B-A3B-Instruct-GGUF (Q4_K_M)

To download:
  1. Open LM Studio
  2. Go to the Search tab
  3. Search: Qwen3-Coder-30B-A3B-Instruct-GGUF
  4. Download the Q4_K_M variant (~18 GB)
  5. Go to Local Server → load model → start server
  6. Come back here and press Enter, or run: local-ai repair
```

---

## Appendix B — Human-Readable Model Name Derivation

Given `qwen3-coder-30b-a3b-instruct`:
- Replace `-` with spaces
- Title-case each word
- Result: `Qwen3 Coder 30B A3B Instruct`
- Append ` (local)`
- Final: `Qwen3 Coder 30B A3B Instruct (local)`

---

## Appendix C — winget Package IDs to Verify

Before hardcoding these, verify they are correct and current:

| Software | Likely winget ID | Verify with |
|---|---|---|
| Git | `Git.Git` | `winget search Git.Git` |
| LM Studio | `lmstudio` or `ElementLabs.LMStudio` | `winget search lmstudio` |
| Node.js LTS | `OpenJS.NodeJS.LTS` | `winget search OpenJS.NodeJS` |

If any ID is incorrect, use the verified one and note the discrepancy in STATUS.md.

---

*End of prompt.*  
*Developed by Brijesh B*
