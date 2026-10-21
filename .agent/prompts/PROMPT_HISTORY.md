# Master Orchestrator Prompt Changelog & Version Registry

## Versioning Policy
- **Immutable Snapshots**: Every prompt architecture update increments the version string (`vX.Y`).
- **Archive Directory**: Previous versions are preserved immutably under `.agent/prompts/history/vX.Y/`.
- **Registry & Audit**: All changes, rationales, token metrics, and operational delta rules are logged chronologically in this document (`.agent/prompts/PROMPT_HISTORY.md`).
- **Zero Drift**: Active master prompts in `.agent/prompts/` and root `AGENTS.md` must stay strictly synchronized with the latest version registry entry.

---

## Active Prompts Table (`v12.4`)

| Prompt File | Version | 1-Word Trigger | Model Target | Core Discipline |
| :--- | :---: | :---: | :---: | :--- |
| [`flash.md`](file:///Users/joelchong/Documents/MCQ%20App/Anti/.agent/prompts/flash.md) | `v12.4` | `"flash"` | Flash / Fast Lead | Low-latency dispatcher; edits <= 15L fast-path; max 1 Argon subagent on Strike 1 fail |
| [`argon.md`](file:///Users/joelchong/Documents/MCQ%20App/Anti/.agent/prompts/argon.md) | `v12.4` | `"argon"` / `"pro"` / `"argon/pro"` | Argon (`pro`) Lead | In-brain multi-file architecture; strictly all-flash subagent fleet (`Model="flash"`, 0 `pro`) |
| [`opus.md`](file:///Users/joelchong/Documents/MCQ%20App/Anti/.agent/prompts/opus.md) | `v12.4` | `"opus"` | Claude Opus 5.5 Lead | Frontier Architect; razor-thin context shielding (`<= 80L` reads, `<= 8L` replies, all-fast fleet) |
| [`universal.md`](file:///Users/joelchong/Documents/MCQ%20App/Anti/.agent/prompts/universal.md) | `v12.4` | *Agnostic* | Any Model Lead | 100% project-agnostic orchestrator rulebook portable to any repo |

---

## Chronological Version History

### `v12.4` (2026-10-20) — GitHub Semantic Commit Naming, Multi-Line Descriptions, & Single-Trigger Vercel Webhook Rule
- **Semantic GitHub Commit Naming & Multi-Line Change Summaries**:
  - Enforced structured semantic commit titles (`feat(<scope>): ...`, `fix(<scope>): ...`) and multi-line body summaries (`-b "<change summary & verify log>"`) in `npm run wt -- ship`.
  - Disallowed generic commit messages (e.g. `"ship verified changes"`) to maintain clean, auditable commit histories on GitHub.
- **Single-Trigger Vercel Webhook Deployment Defense**:
  - Eliminated duplicate deployments caused by simultaneous `git push` (Vercel GitHub integration webhook) and manual `npx vercel --prod` CLI uploads.
  - Prevents untracked raw UID hash builds (`4bsWZp3yR`) on Vercel and guarantees every production deployment is linked to an enriched semantic git commit.
- **Prompt Snapshot Archiving**:
  - Snapshot archived in `.agent/prompts/history/v12.4/` across `flash.md`, `argon.md`, `opus.md`, and `universal.md`.

### `v12.3` (2026-10-20) — Claude Opus 5.5 Context-Shielding, Universal Project-Agnostic Suite, & Post-Ship Subagent Reset
- **Post-Ship Subagent Cleanup**: Updated push-live rule across all prompts (`npm run wt ship <topic> -m "<msg>" --fast`) to automatically execute `manage_subagents(kill_all)` once the worktree is removed.
- **Claude Opus 5.5 Context-Shielding Specification ([`opus.md`](file:///Users/joelchong/Documents/MCQ%20App/Anti/.agent/prompts/opus.md))**:
  - Introduced dedicated orchestrator prompt for Claude Opus 5.5 (`"opus"` trigger).
  - Enforced strict token protection: `<= 80`-line read slices, all planning in-brain, and an **All-Fast Subagent Fleet** (`Model="flash"` / fast tier only, 0 expensive frontier subagents).
  - Retained single-file `<= 15`-line fast-path exception and `<= 8`-line micro-reply contracts.
- **Universal Project-Agnostic Prompt Suite ([`universal.md`](file:///Users/joelchong/Documents/MCQ%20App/Anti/.agent/prompts/universal.md))**:
  - Created zero-dependency, repo-agnostic Master Orchestrator rulebook applicable to any software stack.
- **Prompt Snapshot Archiving**:
  - Established `.agent/prompts/history/` directory structure with historical baseline snapshots (`v11.7`, `v12.2`, `v12.3`).
  - Created [`PROMPT_HISTORY.md`](file:///Users/joelchong/Documents/MCQ%20App/Anti/.agent/prompts/PROMPT_HISTORY.md) version registry.

### `v12.2` (2026-10-19) — Zero-Read Startup, Delta Subagent Prompts, Failure-Only Test Runner, & 1-Command `wt end`
- **Zero-Read Startup Boot**:
  - Compressed root [`AGENTS.md`](file:///Users/joelchong/Documents/MCQ%20App/Anti/AGENTS.md) by **68.6%** (`9.2 KB -> 2.89 KB`), preloading all essential fleet rules into context.
  - Enabled 0-read, 0-tool startup activations on Turn 0 for `"flash"` and `"argon/pro"`.
- **Codebase Atlas Compression**:
  - Compressed [`CODEBASE_MAP.md`](file:///Users/joelchong/Documents/MCQ%20App/Anti/.agent/CODEBASE_MAP.md) by **60%** (`43.1 KB -> 17.4 KB`), removing redundant line-by-line dumps.
  - Added inline symbol search coordinates to `npm run wt create <topic> <terms...>`.
- **Delta-Only Subagent Prompts & `<= 8`-Line Reply Contract**:
  - Subagents inherit rules; master prompts now pass ONLY Cwd, files + `[L<start>-L<end>]`, exact spec, and verify command.
  - Subagents self-verify and reply in `<= 8` bullet lines, preventing child-to-master context bloat.
- **Failure-Only Agent Test Runner**:
  - Switched `npm test` from Jest/default Vitest reporting to direct `tsx` + Vitest `--reporter=agent` failure-only output.
  - Execution runtime dropped from **5.75s to 1.65s**; test token consumption slashed from **19 KB to 96 B (-99.5%)**.
  - Added parallel `runFastVerify` combining `tsc --noEmit` and tests concurrently.
- **1-Command Session Handoff**:
  - Implemented `npm run wt end -n "<learning>"` + `manage_subagents(kill_all)` for 1-command auto-memory digest, server shutdown, and worktree pruning.

### `v12.1` (2026-10-19) — 1-Word Mode Loader & Smart GitHub CI/CD Ship
- **1-Word Mode Loader**:
  - Added `.agent/prompts/{flash,argon}.md` combined with the `revizz-mode-loader` skill for zero-overhead persona switching.
- **Smart GitHub CI/CD Ship**:
  - Updated `npm run wt ship` to bypass Vercel deployment probes for agent/tooling/documentation-only commits.
  - Offloaded remote verification to GitHub CI/CD workflows instead of blocking local `npx vercel` checks.
- **Detached Local Server Speedup**:
  - Sped up `npm run wt serve` to ~2.5s using log readiness detection (`ready in ... ms`) on detached processes.

### `v12.0` (2026-10-19) — 94-Line Consolidated Fast-Boot Memory Digest & Auto-Synced Worktrees
- **Fast-Boot Memory Digest**:
  - Archived legacy 3,158-line `learnings_and_reflections.md` into `.agent/memory/archive/learnings_archive_2026_10.md`.
  - Replaced active memory with a high-density, 94-line Fast-Boot Digest (`L1-L94`), keeping startup memory footprint minimal.
- **Automated Worktree Tooling Sync**:
  - Added `syncAgentTooling` to `scripts/wt.ts` (`commandCreate`), ensuring all newly spawned worktrees automatically inherit `.agent/` tooling and configs.
  - Indexed `hooks/` and UI component registries in `scripts/codebase-map.ts`.

### `v11.0–v11.7` (2026-10-15 to 2026-10-18) — Worktree CLI, Codebase Atlas, Local Server & Push-Live Skills
- **Git Worktree Automation CLI**:
  - Introduced `scripts/wt.ts` to manage isolated git worktrees (`.worktrees/<topic>`) branching from `origin/main` with symlinked `node_modules` and `.env*`.
- **Codebase Atlas & Indexing**:
  - Introduced `scripts/codebase-map.ts` (`.agent/CODEBASE_MAP.md`) and `scripts/agent-memory.ts` for structural symbol lookup.
- **Local Dev Server Lifecycle**:
  - Added `revizz-local-server` skill (`npm run wt serve [topic]` and `npm run wt stop`) running detached servers with readiness polling.
- **Production Atomic Shipping**:
  - Added `revizz-push-live` skill (`npm run wt ship <topic> -m "<msg>"`), enforcing rebase, test/typecheck gating, atomic remote push, and worktree cleanup.
- **Concurrency & Response Standards**:
  - Introduced Smart Fleet disjoint concurrency rules, single-committer git safety, and the Mandatory Closing Block (`### Simple Summary of What Was Done` & `### 3 Suggested Next Steps`).
