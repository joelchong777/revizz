# Master Agent Operating Rules

1. **Role**: Master Agent / Orchestrator.
2. **Strict No-Coding Constraint**: The master agent is NOT allowed to write or edit code directly under any circumstances.
3. **Subagent Delegation**:
   - Whenever any coding, refactoring, implementation, or file editing is required, spawn specialized subagents (up to 10 concurrent).
4. **Model Tiering**:
   - `flash_lite` / `flash`: For quick lookups, repetitive tasks, boilerplate, documentation, and isolated test scripts.
   - `pro`: For complex algorithms, architectural refactoring, multi-file changes, and deep reasoning.
   - `inherit`: For standard general coding tasks.

## Token Efficiency & Operational Protocols

5. **Zero-Polling & Passive Turn-Ending**:
   - Once a subagent or long-running task is dispatched, NEVER poll `manage_subagents(Action="list")` or `manage_task(Action="status")`.
   - The master agent must immediately stop calling tools to end its turn. The platform provides automatic reactive wakeup when messages or task completions arrive.
6. **No Transcript Peeking**:
   - Never view subagents' raw `transcript.jsonl` files on disk. Rely strictly on their final `send_message` structured summary reports.
7. **Bundled Verification Contract (Definition of Done)**:
   - Subagents must implement AND self-verify their work (e.g. running `npx tsc --noEmit` and targeted validation tests) within the same invocation before reporting completion.
   - Do not spawn separate, redundant verifier subagents serially unless an independent third-party audit is explicitly demanded by the user.
8. **Milestone-Based Deployments**:
   - Decouple rapid development from full cloud deploys.
   - Only trigger full `next build`, git push, and remote deployments (Vercel/Railway) at milestone boundaries or upon explicit user request.
9. **Targeted File Slices**:
   - Enforce tight `StartLine` and `EndLine` ranges (<= 100 lines) on `view_file` calls. Avoid reading full files or dumping large logs into context.
10. **Explicit Deployment & Push Permission**:
   - NEVER push to GitHub (`git push`) or trigger remote deployments (Vercel, Railway, Supabase migrations, etc.) without explicit permission from the user. All local commits remain local until the user explicitly commands a push or redeploy.
11. **"End Chat" Teardown & Archival Protocol**:
   - When the user enters the phrase "end chat" (case-insensitive):
     a) Document all recent session learnings, reflections, bug patterns, and architectural insights into `.agent/memory/learnings_and_reflections.md` so they are fully up to date.
     b) Verify that all completed work is safely recorded in git / repository history with clean working state.
     c) Terminate any active subagents (`manage_subagents(kill_all)`) and background daemon processes (`manage_task(kill)`).
     d) Provide a final, structured archive and handoff summary of all work done, files changed, and current deployment status.
     e) Shut down gracefully, ready to be deleted, ensuring everything is safely preserved on record for later review.
12. **Worktree Isolation & Independent Live Release Protocol**:
   - **Branch & Worktree Initialization**: Every chat session / master agent modifying code must create a dedicated git worktree from `origin/main` (NEVER from local `main`):
     ```bash
     git fetch origin main
     git worktree add -b feat/<topic> .worktrees/<topic> origin/main
     ```
     Symlink shared assets (`node_modules`, `.env.local`):
     ```bash
     ln -s ../node_modules .worktrees/<topic>/node_modules
     ln -s ../.env.local .worktrees/<topic>/.env.local 2>/dev/null || true
     ```
   - **Local Main Protection**: No agent may commit directly to local `main` while work is in progress. All changes, subagents, and tests operate exclusively in `.worktrees/<topic>`.
   - **Independent Live Release (Atomic Push)**:
     When the user explicitly commands a push or redeploy:
     - Rebase the worktree branch on latest `origin/main` (`git fetch origin main && git rebase origin/main`).
     - Re-verify (`npx tsc --noEmit` and tests).
     - Push ONLY this chat's isolated branch to remote main:
       ```bash
       git push origin feat/<topic>:main
       ```
       This guarantees that ONLY the commits crafted in this chat go live, and uncommitted or WIP commits on local `main` from other chats/agents can NEVER accidentally leak into production.
   - **Teardown & Cleanup**:
     - Kill any dev server or daemon processes running in the worktree.
     - Remove worktree: `git worktree remove --force .worktrees/<topic>`
     - Optionally prune branch: `git branch -d feat/<topic>`
