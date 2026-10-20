---
name: revizz-push-live
description: 1-command atomic GitHub release, Vercel production redeploy, and worktree cleanup (`npm run wt ship [topic] -m "<msg>"`). Trigger whenever the user says "push live", "push and redeploy", "ship it", or "deploy live".
---

# Revizz 1-Command Push Live & Production Deploy

This skill provides a 1-command atomic workflow to commit, verify, push isolated worktree changes directly to GitHub `main`, trigger a Vercel production deployment, verify HTTP 200 health, and clean up the worktree. It collapses 6 sequential terminal steps into a single deterministic command: `npm run wt ship [topic] -m "<msg>" [--fast]`.

---

## 1. 1-Command Live Ship ("push live")

When the user gives explicit permission to deploy or push live (e.g., `"push live"`, `"push and redeploy"`, `"ship it"`, or `"deploy live"`):

### Command Syntax
```bash
npm run wt ship <topic> -m "feat(<scope>): <summary>"
```

### Options & Flags
- **Auto-Detect Topic**: If `<topic>` is omitted, `wt ship` automatically selects the most recently active feature worktree:
  ```bash
  npm run wt ship -m "feat(<scope>): <summary>"
  ```
- **`--fast` Flag**: If `npm run wt verify <topic>` was already executed immediately prior on the exact same state with zero intervening changes, append `--fast` to bypass redundant test execution while still guaranteeing rebase check:
  ```bash
  npm run wt ship <topic> -m "feat(<scope>): <summary>" --fast
  ```

### Tool Invocation Syntax
Always invoke via `run_command` with `WaitMsBeforeAsync: 10000` and `IsDaemon: false`:
```json
{
  "CommandLine": "npm run wt ship <topic> -m \"feat(<scope>): <summary>\"",
  "Cwd": "/Users/joelchong/Documents/MCQ App/Anti",
  "IsDaemon": false,
  "WaitMsBeforeAsync": 10000
}
```

---

## 2. What `npm run wt ship` Executes Automatically in a Single Call

In a single atomic execution, `npm run wt ship` orchestrates:

1. **Step 1 (Stop Local Server)**:
   - Gracefully terminates any Next.js development server running on port `3000`.
   - Cleans up stale `.next/dev/lock` files in the target worktree.
2. **Step 2 (Auto-Commit)**:
   - Inspects the git status of the worktree.
   - If uncommitted changes exist, stages all modifications (`git add -A`) and creates a commit using the provided `-m "<msg>"` (or an intelligent semantic default).
3. **Step 3 (Rebase & Verify)**:
   - Fetches latest `origin/main` (`git fetch origin main`).
   - Rebases the isolated worktree branch cleanly on top of `origin/main`.
   - Executes the mandatory verification gate (`npx tsc --noEmit && npm test`).
   - *(Note: Verification tests are safely bypassed if `--fast` is specified and `origin/main` has not diverged).*
4. **Step 4 (Atomic GitHub Push)**:
   - Runs `git push origin <branch>:main`.
   - Guarantees that **only** the commits developed in this isolated worktree land on GitHub `main`.
   - Never exposes uncommitted or WIP code from local `main` or other parallel worktrees.
5. **Step 5 (Smart Production Probe via GitHub CI/CD)**:
   - Pushing to GitHub `main` automatically triggers Vercel's GitHub integration for app changes (`app/`, `components/`, `lib/`, `hooks/`, `public/`) and probes `https://revizz-sand.vercel.app` for `HTTP 200`.
   - If a commit only modifies agent/tooling/docs files (`.agent/`, `scripts/`, `AGENTS.md`), it automatically skips the Vercel probe.
6. **Step 6 (Automatic Worktree Cleanup & Post-Ship Context Reset)**:
   - Removes `.worktrees/<topic>` and unlinks symlinked assets.
   - Prunes the merged local feature branch (`git branch -d feat/<topic>`).
   - Master Agent immediately calls `manage_subagents(Action="kill_all")` to clear stale worktree subagents and recommends `/compact` as Suggested Next Step #1 to free completed milestone context.

---

## 3. Critical Guardrails

- **Explicit User Permission Mandatory**: NEVER invoke `npm run wt ship` autonomously. Only run it when the user explicitly issues instructions such as `"push live"`, `"ship it"`, `"push and redeploy"`, or `"deploy to production"`.
- **Single Master Orchestrator Execution**: Subagents must NEVER run `npm run wt ship`, `git push`, or `git commit`. Live shipping is strictly reserved for the Master Agent.
- **Timeout Buffer**: Always use `WaitMsBeforeAsync: 10000` to allow the build, push, deploy, and HTTP health probe adequate time to stream output.
