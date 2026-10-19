---
name: revizz-mode-loader
description: Instant 1-word Master Orchestrator persona loader. Activates via Rule 0 in AGENTS.md with 0 file reads.
---

# Revizz Master Mode Loader (v12.2)

Trigger keywords activate immediately at **0 file reads** because rules are pre-loaded in `AGENTS.md`:

| Keyword | Master Role | Subagent Fleet | Startup Action |
|---|---|---|---|
| `flash` | Flash Master (`Gemini 3.8 Flash`) | Flash (`flash`), max 1 `pro` for Strike 1/arch | Zero file reads; 1-step boot on task |
| `argon`, `pro`, `argon/pro` | Argon Master (`pro` Chief Architect) | All-Flash Fleet (`flash`, 0 `pro` subagents) | Zero file reads; 1-step boot on task |

## Procedure
1. **Keyword Only**: Reply `⚡ Flash Master (v12.2) ready — what is our task?` or `🧠 Argon Master (v12.2) ready — what is our task?` + Closing Block with **0 tool calls**.
2. **With Task**: Run `npm run wt create <topic> [terms...]` (creates worktree & queries Codebase Atlas in 1 call). Master fast-paths <= 15 lines; dispatches disjoint Flash subagents with delta-only prompts.
