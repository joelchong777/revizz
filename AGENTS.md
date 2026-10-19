# Master Operating Rules (v12.2)

0. **Zero-Read 1-Word Activation (`"flash"` | `"argon"`/`"pro"`/`"argon/pro"`)**:
   - `AGENTS.md` is pre-loaded in `<user_rules>`: **NEVER waste tool calls reading prompt files at startup**.
   - `"flash"` -> **Flash Master (`v12.2`)**: Gemini 3.8 Flash coordinator; 1 Flash subagent (`Model="flash"`) for single units, 2+ parallel for disjoint files/papers, max 1 Argon (`Model="pro"`) ONLY for 4+ file arch or Strike 1 failure.
   - `"argon"`/`"pro"`/`"argon/pro"` -> **Argon Master (`v12.2`)**: `pro` Chief Architect (in-brain planning) + **All-Flash Fleet** (`Model="flash"`, 0 `pro` subagents).
   - **Mode-Only (no task)**: Reply 1 line (`⚡ Flash Master (v12.2) ready — what is our task?` or `🧠 Argon Master (v12.2) ready — what is our task?`) + Closing Block (**0 tool calls**).
   - **Task Given (1-Step Boot)**: Run `npm run wt create <topic> <keywords...>` (creates `.worktrees/<topic>` & prints atlas coords in 1 call). Read `.agent/CODEBASE_MAP.md` or `.agent/memory/learnings_and_reflections.md` (`L1-L94`) only if extra symbols/traps needed.
1. **Fast-Path & Delta Delegation**:
   - Master edits single files <= 15 lines in `.worktrees/<topic>`. All larger edits to Flash subagents with **strictly disjoint file lists**.
   - **Delta Prompts**: Subagents inherit `AGENTS.md`. Pass ONLY: (a) `.worktrees/<topic>` Cwd, (b) target files + `[L<start>-L<end>]`, (c) exact spec + verify cmd.
   - **Reply Cap (<= 8 lines)**: Subagents self-verify (`npx tsc --noEmit`) and report in <= 8 lines (files, ranges, exit codes).
2. **Zero-Polling, Single-Committer & Warm Reuse**:
   - End turn immediately after `invoke_subagent`/`send_message`; never poll `manage_subagents`/`manage_task` or read `transcript.jsonl`.
   - Warm reuse via `send_message(Recipient=conversationId)`. Targeted `view_file` <= 100 lines. Subagents NEVER run `git add`/`commit`/`push` (prevents `.git/index.lock`).
3. **1-Command Worktree, Server & Live Ship (`npm run wt`)**:
   - Create + Atlas Query: `npm run wt create <topic> [query_terms...]`
   - Local Dev (`"start local"`): `npm run wt serve [topic]` (`WaitMsBeforeAsync: 5000`, `http://localhost:3000` in ~2.5s). Stop (`"kill server"`): `npm run wt stop`.
   - Verify: `npm run wt verify <topic>` (`npx tsc --noEmit && npm test`).
   - Push Live (explicit user permission ONLY): `npm run wt ship <topic> -m "feat(<scope>): <msg>" --fast` (`WaitMsBeforeAsync: 10000`). Pushes `origin <branch>:main`, triggers Vercel CI/CD (skips probe for agent/tooling commits), cleans worktree.
   - End Chat (`"end chat"`): Update `.agent/memory/learnings_and_reflections.md` (< 120 lines), clean git state, kill subagents/daemons, output handoff summary.
4. **Revizz Architectural Guardrails**:
   - **UI**: Tactile neobrutalism (`border-2 border-border`, `shadow-[4px_4px_0px_0px_#1E1B4B]`), solid `bg-bg` sticky `Header.tsx`, `grid-cols-2 sm:grid-cols-4` settings.
   - **Motion/React/TS**: Framer Motion >= 3 keyframes MUST use `type: "tween"` (never `spring`). Unconditional hooks above early returns (React #310). No `.tsx` imports in `scripts/verify-revizz.ts` (`TS6142`).
   - **Content/Media**: Escape currency as `\$50`; pass `remarkGfm` + `rehypeRaw` to `ReactMarkdown`; use `resolveDiagramUrl()` (`lib/questions.ts`).
   - **Boundaries**: Student `Header.tsx` zero Portal/Admin links; `StartFlow.tsx` 4-option format filter (`all | graph | diagram | text`); Demo Student locks Review Pile (`StudentAuthGate.tsx`); Teacher `/portal` (3-col bank, multi-topic `topicIds: string[]`); Admin `/admin` (5-col bank, `/api/admin/users` CRUD, 6 settings panels, Ingestion Studio `0455`=30 / Sciences=40 MCQs, never symlink `staging/`).
5. **Mandatory Closing Block**:
   - End every final response with:
     `### Simple Summary of What Was Done` (2–4 plain-English sentences)
     `### 3 Suggested Next Steps` (`1.`, `2.`, `3.`)
