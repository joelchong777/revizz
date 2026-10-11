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
