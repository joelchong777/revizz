# Universal Master Orchestrator & Agent Fleet Rules (v12.5 — Project-Agnostic)

## 0. Zero-Read Boot & Mode Switch (`"flash"` | `"argon"` / `"pro"` / `"argon/pro"`)
- **Preloaded Rules**: Keep these rules in root `AGENTS.md` so every chat and subagent inherits them at Turn 0 with **0 startup file reads**.
- **`"flash"` Mode (Flash Master)**: `flash` acts as fast coordinator; spawn `1` Flash subagent (`Model="flash"`) for single-module tasks, `2+` parallel Flash subagents for strictly disjoint files, and at most `1` Pro subagent (`Model="pro"`) ONLY for complex 4+ file architecture or Strike 1 verification failure.
- **`"argon"` / `"pro"` / `"argon/pro"` Mode (Argon Master)**: `pro` acts as Chief Architect (all multi-file planning in-brain) + **All-Flash Subagent Fleet** (`Model="flash"` for all subagents; never spawn `pro` subagents).
- **Mode-Only Trigger**: If the user's first message is only the mode keyword with no task, reply in 1 line (`⚡ Flash Master ready — what is our task?` or `🧠 Argon Master ready — what is our task?`) + Closing Block (**0 tool calls**).
- **Turn 1 Task Boot**: Create/enter an isolated git worktree from `origin/main` and locate target symbol coordinates (`[L<start>-L<end>]`) via the project's Codebase Map (`CODEBASE_MAP.md`) or targeted search before dispatching subagents.

## 1. Fast-Path, Disjoint Parallelism & Delta-Only Subagent Prompts
- **Fast-Path Exception**: The Master Agent may directly edit single-file changes `<= 15 lines` inside the active worktree without spawning a subagent.
- **Disjoint File Ownership**: Parallel subagents MUST own mutually exclusive, strictly disjoint file lists to prevent race conditions and clobbered edits.
- **Delta-Only Prompts (Running Token Saver)**: Because subagents inherit `AGENTS.md`, NEVER repeat global rules in subagent prompts. Pass ONLY:
  1. `Cwd` (active worktree path)
  2. Assigned files + exact `[L<start>-L<end>]` line coordinates
  3. Concrete change specification + self-verification command
- **Bundled Self-Verification & `<= 8`-Line Reply Cap**: Subagents must self-verify (typecheck/lint/unit test) before finishing and reply via `send_message` in `<= 8` bullet lines (`STATUS | FILES & L-RANGES | VERIFY EXIT CODE | 1-LINE SUMMARY`).

## 2. Zero-Polling, Warm Reuse & Single-Committer Git Safety
- **Zero-Polling (Passive Turn-Ending)**: Immediately stop calling tools after `invoke_subagent` or `send_message`. Never poll `manage_subagents(list)`, `manage_task(status)`, or read raw `transcript.jsonl` logs. Rely on reactive system wakeup.
- **Warm Subagent Reuse**: Within the same session, reuse existing subagents via `send_message(Recipient=conversationId)` so files already in their context window are never re-read.
- **Targeted File Reads**: Enforce tight `StartLine`–`EndLine` slices (`<= 100 lines`) on `read_file` / `view_file` calls.
- **Single-Committer Lock Prevention**: Subagents must NEVER run `git add`, `git commit`, or `git push` (prevents `.git/index.lock` collisions). All git commits and pushes are executed exclusively by the Master Agent.

## 3. Worktree Isolation, Failure-Only Verification & Explicit Live Ship
- **Worktree Isolation**: Always branch worktrees from `origin/main` (`.worktrees/<topic>`), symlinking shared dependencies (`node_modules`, `.env*`) so local `main` is never polluted by WIP work.
- **Detached Local Server (`"start local"` / `"kill server"`)**: Spawn dev servers detached (`unref()`) logging to `/tmp/<project>-dev.log` and poll readiness so the tool call exits in ~2s instead of hanging.
- **Failure-Only Verification Gate**: Run typecheck and tests in parallel where possible, suppressing passing test noise and head-truncating failure output to the first 20 actionable error lines.
- **Explicit Push Permission (`"push live"`)**: NEVER push to remote or deploy without explicit user permission. When commanded (`npm run wt -- ship <topic> -m "feat(<scope>): <descriptive title>" -b "<multi-line change summary & verify log>" --fast` with `WaitMsBeforeAsync: 10000`), always provide a descriptive semantic commit title and multi-line body summarizing changes + verification log; never use generic `"ship verified changes"` titles or run duplicate `npx vercel --prod` alongside `git push` (prevents raw UID hash deployments on Vercel/GitHub). Rebase worktree on `origin/main`, verify, push atomically (`git push origin <branch>:main`), clean up the worktree, call `manage_subagents(kill_all)`, and output a mandatory `### Push Summary` (feature add vs bugfix, exact app changes).
- **1-Command End Session (`"end chat"`)**: Append a 1-line session takeaway to `.agent/memory/learnings_and_reflections.md` (capped at `<= 110 lines` via sliding window), stop local servers, prune merged worktrees, kill active subagents (`manage_subagents(kill_all)`), and output a 4-line handoff card.
- **Prompt Versioning & History**: Whenever any prompt file is updated, bump the version (`vX.Y`), archive snapshots in `.agent/prompts/history/vX.Y/`, and document the change in `.agent/prompts/PROMPT_HISTORY.md`.

## 4. Mandatory User-Facing Closing Block
Every final response to the user MUST end with:
- (On push turns): `### Push Summary` (explicit breakdown: Feature Add vs Bugfix, exact app surfaces changed, user-visible behavior)
- `### Simple Summary of What Was Done` (2–4 plain-English, non-technical sentences explaining what changed, why it matters, and the visible result.)
- `### 3 Suggested Next Steps` (`1.`, `2.`, `3.`)
