# Master Rules (v12.6)

0. **Zero-Read Boot (`"flash"` | `"argon"`/`"pro"`/`"argon/pro"` | `"opus"`)**:
- Preloaded in `<user_rules>`: **0 startup reads/tool calls**.
- `"flash"` -> Flash Master: `flash` lead; 1 `Model="flash"` single, 2+ disjoint; max 1 Argon (`Model="pro"`) only 4+ arch/Strike 1 fail.
- `"argon"`/`"pro"`/`"argon/pro"`/`"opus"` -> Chief Architect Master (`pro` / Claude Opus 5.5): in-brain plan + **All-Flash Fleet** (`Model="flash"`, 0 `pro` subagents; shield root context with <=80-line reads & <=8-line subagent replies).
- Mode-Only: 1 line (`⚡ Flash Master (v12.6)...` / `🧠 Argon Master...` / `🏛️ Opus 5.5 Master...`) + Closing Block (**0 tool calls**).
- Task Given: `npm run wt create <topic> <keywords...>` (creates worktree & coords). Read `CODEBASE_MAP.md`/`learnings` (`L1-L94`) if needed.

1. **Fast-Path & Delta Delegation**:
- Master edits <= 15 lines in `.worktrees/<topic>`; larger edits to Flash subagents with **disjoint file lists**.
- **Delta Prompts**: Subagents inherit rules. Pass ONLY: (a) Cwd, (b) files + `[L<start>-L<end>]`, (c) spec + verify cmd.
- **Reply Cap**: Subagents self-verify (`npx tsc --noEmit`) and report in <= 8 lines (files, ranges, exit codes).

2. **Zero-Polling, Single-Committer & Warm Reuse**:
- Stop turn after `invoke_subagent`/`send_message`; never poll `manage_subagents`/`manage_task` or read `transcript.jsonl`.
- Warm reuse via `send_message(Recipient=conversationId)`; `view_file` <= 100 lines; subagents NEVER git add/commit/push (prevents `.git/index.lock`).

3. **Worktree, Server & Live Ship (`npm run wt`)**:
- Create/Query: `npm run wt create <topic> [terms...]` | Verify: `npm run wt verify <topic>` (`npx tsc --noEmit && npm test`).
- Serve & Preview: `npm run wt serve [topic]` (`WaitMsBeforeAsync: 5000`, `localhost:3000` ~2.5s). Stop: `npm run wt stop`. If there is any preview to show, agents MUST start a local server upon completion of given work and include a direct link to the preview in the work summary.
- Push Live (user permission): `npm run wt -- ship <topic> -m "feat(<scope>): <descriptive title>" -b "<multi-line change summary & verify log>" --fast` (`WaitMsBeforeAsync: 10000`) + `manage_subagents(kill_all)`. Always provide semantic title + multi-line body summarizing changes & verify log; never generic `"ship verified changes"` or duplicate `npx vercel --prod` alongside `git push` (prevents raw UID hash deployments). Post-push: output mandatory `### Push Summary` (feature add vs bugfix, exact app changes).
- End Chat: 1 cmd: `npm run wt end -n "<1-line learning>"` + `manage_subagents(kill_all)` (auto-memory, cleans server/git).
- Prompt Updates: bump version + archive snapshot in `.agent/prompts/history/vX.Y/` and `.agent/prompts/PROMPT_HISTORY.md`.

4. **Revizz Architectural Guardrails**:
- **UI**: Neobrutalism (`border-2 border-border`, `shadow-[4px_4px_0px_0px_#1E1B4B]`), solid `bg-bg` Header.tsx, `grid-cols-2 sm:grid-cols-4`.
- **Motion/TS**: Keyframes >= 3 `type: "tween"` (never `spring`); hooks above early returns (#310); no `.tsx` in `verify-revizz.ts` (`TS6142`).
- **Content**: Currency `\$50`; `ReactMarkdown` remarkGfm + rehypeRaw; `resolveDiagramUrl()` (`lib/questions.ts`).
- **Roles**: Student `Header.tsx` 0 Portal/Admin links; `StartFlow.tsx` (`all|graph|diagram|text`); Demo locks Review Pile (`StudentAuthGate.tsx`); Teacher `/portal` (3-col, `topicIds: string[]`); Admin `/admin` (5-col, CRUD, 6 panels, Studio `0455`=30/Sciences=40 MCQs, no `staging/` symlink).

5. **Mandatory Closing Block**: End final responses with:
- (On push turns): `### Push Summary` (explicit breakdown: Feature Add vs Bugfix, exact app surfaces changed, user-visible behavior)
- `### Simple Summary of What Was Done` (2–4 plain sentences; if preview available, include direct link to preview)
- `### 3 Suggested Next Steps` (`1.`, `2.`, `3.`)
