# Roadmap

## v0.1 — current

- **Platform:** Windows 10/11 (x64) only
- **Provider:** LM Studio (`http://127.0.0.1:1234/v1`)
- **Chat/coding tool:** opencode
- **Workflows:** terminal, VS Code, both
- **Commands:** `setup`, `doctor`, `status`, `repair`, `reset`, `cleanup` (list-only)
- **Hardware scanner:** `llm-env-check` programmatic API
- **Safety:** three-tier permission model; timestamped backups before overwriting any config

---

## v0.2 — planned

- **Provider:** Ollama (parallel to LM Studio, user picks at setup)
- **Platform:** macOS support (Intel + Apple Silicon)
- **Cleanup:** `--delete <model-id>` actually deletes model directories with strong confirmation
- **VS Code:** detect whether the user has a Claude / Continue / Cline extension installed and offer to point it at the local model

---

## v0.3 — planned

- **Provider:** llama.cpp server (`llama-server`) as a third option
- **Tools:** Aider and Continue CLI integrations alongside opencode
- **Platform:** Linux support (Debian / Fedora / Arch family)
- **Setup:** non-interactive flags for CI (`--yes`, `--model <id>`, `--workflow terminal`)

---

## Future

- Richer `llm-env-check` integration: model benchmarking on first download, quantization advice (Q3_K vs Q4_K_M vs Q5 trade-offs), thermal/power profile hints.
- Multi-machine: detect a peer LM Studio server on the LAN and offer to use it.
- Model recommendation refresh: pull updated model catalogs from a signed manifest rather than relying solely on hardware tier matching.

---

## Explicit non-goals

- `local-ai` will not become an IDE, agent, model runner, or replacement for opencode / LM Studio / Ollama.
- `local-ai` will not auto-install Node.js or npm (they're prerequisites of `npx`).
- `local-ai` will not download model files itself — that stays with LM Studio's model manager (a deliberate boundary so we don't duplicate model storage and licensing logic).

---

*Developed by Brijesh B*
