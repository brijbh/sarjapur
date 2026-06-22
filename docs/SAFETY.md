# Safety model

`local-ai` runs commands and writes files on your machine. Every write is gated. This document describes exactly what is gated, how, and how to audit or undo anything `local-ai` does.

---

## Three-tier permission model

### Tier 1 — Allowed without asking

Read-only, side-effect-free inspection:

- Hardware scan via `llm-env-check` (CPU, RAM, GPU/VRAM, OS)
- Version probes: `node --version`, `npm --version`, `git --version`, `winget --version`, `code --version`, `opencode --version`
- HTTP GET `http://127.0.0.1:1234/v1/models` (3-second timeout, never throws)
- Reading `%USERPROFILE%\.local-ai\state.json`
- Reading `%USERPROFILE%\.config\opencode\opencode.json`
- Printing advice and recommendations

If you only ever run `local-ai doctor` or `local-ai status`, **nothing on your machine changes**.

### Tier 2 — Yes/No prompt required

A simple confirmation before any of these:

- `winget install Git.Git`
- `winget install <LM Studio package id>`
- `npm install -g opencode`
- Creating `%USERPROFILE%\.local-ai\state.json`
- Creating `%USERPROFILE%\.config\opencode\opencode.json`
- Backing up + updating an existing opencode config
- Opening VS Code (`code .`)
- Spawning a new terminal window with `opencode`

Each is asked separately. You can say No to any prompt without abandoning the rest of the flow.

### Tier 3 — Strong confirmation (type a specific word)

Reserved for irreversible operations on existing user data. In v0.1 this tier is exercised by:

- (Future v0.2) deleting a model directory via `cleanup --delete`

In v0.1, the only existing-file overwrite is the opencode config, and that's protected by **automatic backup + Yes/No** which is judged sufficient because the previous state is recoverable. If you'd prefer strong confirmation here as well, open an issue.

---

## Backup policy

Before `local-ai` overwrites any existing config file, it copies the original to a sibling file:

```
opencode.json.backup-YYYYMMDD-HHMM
```

Timestamp is **local time** in 24-hour format. Backups are never deleted automatically. They accumulate; clean them up by hand if you want to.

---

## What local-ai never does automatically

- It never runs `winget install` without a Yes.
- It never modifies `opencode.json` without a Yes (and a backup).
- It never deletes a file (in v0.1 — `reset` only deletes its **own** state file, and only after a Yes).
- It never writes outside `%USERPROFILE%\.local-ai\` and `%USERPROFILE%\.config\opencode\`.
- It never sends anything off your machine. There are no telemetry calls, no network requests other than to your local LM Studio server.
- It never auto-installs Node.js or npm. If you ran `npx local-ai`, you already have them.

---

## How to audit what local-ai changed

`local-ai` only ever writes to two paths and only ever creates two kinds of files:

1. **State file:** `%USERPROFILE%\.local-ai\state.json` — plain JSON, human-readable.
2. **opencode config:** `%USERPROFILE%\.config\opencode\opencode.json` — plain JSON.
3. **Backups:** `opencode.json.backup-YYYYMMDD-HHMM` siblings of (2).

Inspect any of those with any text editor. Compare a current config against the latest backup to see exactly what `local-ai` added.

---

## How to fully undo a local-ai setup

You should not need this — `local-ai reset` removes the state file, and you can restore the opencode config from the most recent backup. But for a complete clean-slate revert by hand:

1. **Remove the state file:**
   ```
   del "%USERPROFILE%\.local-ai\state.json"
   rmdir "%USERPROFILE%\.local-ai"
   ```

2. **Restore your previous opencode config** (or delete it):
   ```
   copy "%USERPROFILE%\.config\opencode\opencode.json.backup-YYYYMMDD-HHMM" ^
        "%USERPROFILE%\.config\opencode\opencode.json"
   ```
   Or, if you had no previous config and want a clean removal:
   ```
   del "%USERPROFILE%\.config\opencode\opencode.json"
   ```

3. **Optionally uninstall the tools `local-ai` installed:**
   ```
   winget uninstall Git.Git
   winget uninstall <LM Studio package id>
   npm uninstall -g opencode
   ```
   None of these are required for `local-ai` itself to be "uninstalled" — they're standalone tools at this point.

---

## Why state is verified live on every run

The state file records what `local-ai` **set up**, not what is **currently true**. Between runs:

- LM Studio may not be running.
- The previously selected model may no longer be loaded.
- The opencode config may have been edited or removed.
- Tools may have been uninstalled.

`status` and `repair` always run a live scan and treat any mismatch as something to fix or report. `lastVerified` only advances after an end-to-end live check passes.

The cost is a few hundred milliseconds per invocation. The benefit is that `local-ai` never lies to you about readiness.

---

*Developed by Brijesh B*
