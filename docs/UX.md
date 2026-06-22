# UX

## Core principle

> **Check automatically. Ask before changes. Explain manual fallback. Do not repeat completed setup.**

Every UX decision in `local-ai` flows from that line.

- **Check automatically.** Everything that can be inspected without changing your machine is inspected up front. You never have to answer a question whose answer is already on disk.
- **Ask before changes.** Anything that installs, writes, or spawns is gated by an explicit Yes/No (see [SAFETY.md](SAFETY.md)).
- **Explain manual fallback.** When `local-ai` cannot do something for you (no `winget`, no `code` on PATH, a model isn't loaded), it prints the exact manual step you would take in its place.
- **Do not repeat completed setup.** If `state + opencode config + LM Studio + model` all check out, `local-ai setup` says so and exits — it does not walk you through any questions.

---

## Canonical user journey

```
Step 1   User runs:  npx local-ai

Step 2   local-ai → llm-env-check
         Hardware scanned: RAM, VRAM, CPU, GPU

Step 3   local-ai prints what is ready and what is missing
         ✓ Windows 11   ✓ Node 22 / npm 10
         ✓ 32 GB RAM    ✓ NVIDIA RTX 4070 (12 GB VRAM)
         ✓ Can run: 7B, 13B, 30B
         ✗ Git           ✗ LM Studio    ✗ opencode

Step 4   "Where do you want to use local AI?"
         Options: terminal / vscode / both

Step 5   local-ai recommends a model your hardware can run

Step 6   For each missing tool, ask permission and install
         → Git via winget
         → LM Studio via winget   →   wait for user to load model
         → opencode via npm

Step 7   Verify full setup
         ✓ LM Studio reachable
         ✓ Model loaded
         ✓ opencode config valid

Step 8   "Save setup state?" → write state.json

Step 9   Launch
         terminal: spawn new powershell window running opencode
         vscode:   print next-steps card, optionally code .

Step 10  Next run: detect saved state, verify live, print
         "Local AI is ready" — no setup repeated
```

For full details, see the "Intended UX Flow" in the build prompt.

---

## VS Code workflow — what testing means

Testing VS Code support in v0.1 does **not** mean installing a VS Code extension. It means proving that you can reach a working `opencode` session inside VS Code's integrated terminal.

`local-ai doctor` and `local-ai status` check all of:

| Check | How |
|---|---|
| `code` command exists | `code --version` |
| opencode is installed | `opencode --version` |
| opencode config is valid | File exists + valid JSON + contains LM Studio provider |
| LM Studio server is reachable | HTTP GET `http://127.0.0.1:1234/v1/models` |
| Selected model is available | Model ID from state is in `/v1/models` response |

If all five pass, the VS Code workflow is ready. Open VS Code, open the terminal, run `opencode`.

---

## Error states the user can see

| Situation | Output | Exit |
|---|---|---|
| No state file | `✗ No setup found.` + `→ Run: local-ai setup` | `1` |
| LM Studio not running | `✗ LM Studio server is not reachable.` + open + start instructions | `1` |
| Model not loaded | `✗ No models loaded in LM Studio.` + load instructions | `1` |
| Saved model not loaded | `⚠ Saved model "X" is not loaded.` + propose swap | `1` if declined |
| opencode config invalid | `⚠ opencode config exists but is not valid JSON.` + offer rewrite | `1` if declined |
| `winget` missing | `⚠ winget is not available.` + manual download URL | continues |
| `code` missing | `⚠ VS Code 'code' command not found.` + install instructions | continues |
| User Ctrl+C at a prompt | `Cancelled.` | `0` |
| Unhandled error | `✗ <message>` (stack hidden unless `--debug`) | `1` |

---

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success, or graceful user cancel |
| `1` | Any check is `warn` / `missing` / `error`; or a command's pre-conditions aren't met |

`local-ai doctor` exits `1` if any check is `warn` or `missing`. `local-ai status` exits `1` if state is missing or live verification fails. All other commands exit `0` on success and `1` on error.

---

## Ctrl+C handling

Every prompt is wrapped — pressing Ctrl+C anywhere prints `Cancelled.` and exits with code `0` (not 130). The current operation aborts cleanly; nothing partially written is left behind, because writes (state file, opencode config) use atomic rename or are gated behind a prior `ask()` that you would have answered Yes to first.

---

*Developed by Brijesh B*
