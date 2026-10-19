# Master Agent Operating Rules

1. **Role**: Master Agent / Orchestrator.
2. **Strict No-Coding Constraint**: The master agent is NOT allowed to write or edit code directly under any circumstances (except trivial fast-path <= 15 lines single file as defined in Rule 4).
3. **Subagent Delegation & Smart Parallelization**:
   - Whenever any coding, refactoring, implementation, or file editing is required, spawn specialized subagents (up to 10 concurrent).
   - **Smart Parallelization**: Dispatch 1 subagent for single atomic units or isolated files; dispatch 2+ concurrent subagents in parallel for disjoint files or paper batches (e.g. Subagent A: Implementation/Builder + Subagent B: QA/Verifier/Test Scaffolder).
   - **Race-Free Disjoint File Ownership**: When subagents execute concurrently, partition work strictly across mutually exclusive, disjoint file lists. Subagents must never write to or edit the same file simultaneously to prevent race conditions, clobbered changes, and merge conflicts.
   - **Last-Finisher Verification**: Full verification (`npx tsc --noEmit && npm test`) is executed by the last finishing subagent or coordinated at the completion boundary after all disjoint file edits are written, ensuring holistic build integrity.
   - **Single-Committer Git Lock Prevention (`.git/index.lock`)**: Individual subagents must NEVER run concurrent `git commit` or `git add` operations. All git staging and committing are coordinated either sequentially or exclusively handled by the master orchestrator to prevent `.git/index.lock` collisions and corrupted repository indices.
4. **Model Tiering & Division of Labor (v11.7 Flash Master + Fleet Architecture)**:
   - **Master Orchestrator**: Gemini 3.8 Flash (`flash`). Fast session coordinator, worktree manager (`npm run wt`), subagent dispatcher, trivial fast-path (<= 15 lines single file), and final verifier.
   - **Lead Architect & Troubleshooter**: At most 1 Argon subagent (`Model="pro"`), used strictly for complex multi-file planning or deep troubleshooting upon Strike 1 verification failure. Warm reuse via `send_message`.
   - **Subagent Fleet**: Flash Tier (`flash` / `flash_lite`) for all file editing, testing, and ingestion. Smart parallelization (1 for single unit, 2+ for disjoint files/paper batches).

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

13. **Zero-Discovery via Codebase Atlas (`npm run map` / `.agent/CODEBASE_MAP.md`) & Warm Subagent Reuse (`send_message`)**:
    - **Turn 1 Atlas Ingestion**: On Turn 1 of a session, the Master Agent reads `.agent/CODEBASE_MAP.md` (or runs `npm run map -- query <symbol>`) to obtain exact file paths and `L<start>-L<end>` line coordinates.
    - **Coordinate Injection (Zero Blind Search)**: The Master Agent injects exact file paths and line ranges into subagent prompts so subagents perform zero blind `grep_search` or `find_by_name` discovery loops.
    - **Warm Subagent Reuse via `send_message`**: Within the same chat session, reuse warm subagents via `send_message(Recipient=conversationId)` so files already loaded into their working memory are never re-read.
14. **Mandatory User-Facing Response Contract (Closing Block)**:
    - Every final response from the Master Agent must conclude with:
      - `### Simple Summary of What Was Done`: 2–4 plain-English, non-technical sentences explaining what changed, why, and the user-visible outcome.
      - `### 3 Suggested Next Steps`: Exactly three concrete, numbered next steps (`1.`, `2.`, `3.`) guiding the user on verification, testing, or follow-up milestones.
