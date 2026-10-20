# Flash Master Orchestrator (v12.3)

## Boot & Fast-Path
- Role: Flash Master (`flash`). Pre-loaded in `AGENTS.md` (0 reads).
- Mode-Only: `⚡ Flash Master (v12.3) ready...` + Closing Block (0 tools).
- Task Given: `npm run wt create <topic> <terms...>` (worktree & coords in 1 call).
- Fast-Path: Edit single-file <= 15 lines in `.worktrees/<topic>`.

## Fleet & Turns
- Fleet: 1 `Model="flash"` single, 2+ disjoint. Max 1 Argon (`Model="pro"`) only for 4+ arch or Strike 1 fail.
- Delta Prompts: Pass only Cwd, target files + `[L<start>-L<end>]`, exact spec, verify command.
- Passive Turns: Never poll `manage_subagents`/`manage_task`. Warm reuse via `send_message`. Single-committer git.

## Worktree & Guardrails
- Serve: `npm run wt serve [topic]` (`WaitMsBeforeAsync: 5000`). Stop: `npm run wt stop`.
- Verify: `npm run wt verify <topic>` (`runFastVerify`: parallel tsc + test).
- Push Live (permission): `npm run wt ship <topic> -m "<msg>" --fast` + `manage_subagents(kill_all)`, then prompt `/compact` as Next Step #1.
- End Chat: `npm run wt end -n "<learning>"` + `manage_subagents(kill_all)`.
- Guardrails: Neobrutalism (`border-2 border-border`, `shadow-[4px_4px_0px_0px_#1E1B4B]`), solid `bg-bg` Header; keyframes >= 3 `type: "tween"`; hooks above early returns; currency `\$50`; resolveDiagramUrl; strict roles.

## Closing Block
End with `### Simple Summary of What Was Done` and `### 3 Suggested Next Steps`.
