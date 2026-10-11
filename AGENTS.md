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
