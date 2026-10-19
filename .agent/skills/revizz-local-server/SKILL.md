---
name: revizz-local-server
description: Fast 1-command local Next.js dev server management (`npm run wt serve <topic>` and `npm run wt stop`) for isolated git worktrees. Trigger whenever the user says "start local", "run local server", "preview local", or "kill server".
---

# Revizz Fast Local Server Management

This skill provides fast, deterministic 1-command local Next.js dev server management for Revizz isolated git worktrees (`npm run wt serve <topic>` and `npm run wt stop`). It eliminates 10-second `IsDaemon` tool timeouts, port 3000 conflicts, and stale `.next/dev/lock` file issues.

---

## 1. Fast 1-Command Start ("start local")

When the user asks to start the local server, run the local server, or preview local changes (e.g. `"start local"`, `"run local server"`, `"preview local"`):

### Command
```bash
npm run wt serve <topic>
# Or auto-select the most recent active worktree:
npm run wt serve
```

### What It Does Automatically (~2 seconds execution)
1. **Frees Port 3000**: Checks and terminates any existing process occupying port 3000 (`lsof -ti:3000 | xargs kill -9`).
2. **Cleans Stale Locks**: Removes any leftover `.next/dev/lock` files in the target worktree that cause Next.js "another instance is running" errors.
3. **Detached Background Spawning**: Spawns `npx next dev -p 3000` completely detached (`detached: true, stdio: ['ignore', fd, fd]`, unreferenced via `unref()`) logging output to `/tmp/revizz-dev-3000.log`. Because it is detached, `run_command` exits cleanly in ~2 seconds rather than hanging for 10 seconds.
4. **Instant Health Check Verification**: Verifies `http://localhost:3000` is active and responsive, reporting the live process PID and key navigation URLs:
   - Student App: [http://localhost:3000](http://localhost:3000)
   - Teacher Portal: [http://localhost:3000/portal](http://localhost:3000/portal)
   - Admin Dashboard: [http://localhost:3000/admin](http://localhost:3000/admin)
   - Dev Log: `/tmp/revizz-dev-3000.log`

### Tool Invocation Syntax
Always invoke via `run_command` with `WaitMsBeforeAsync: 5000` and `IsDaemon: false` so the command completes synchronously in a single tool call:
```json
{
  "CommandLine": "npm run wt serve <topic>",
  "Cwd": "/Users/joelchong/Documents/MCQ App/Anti",
  "IsDaemon": false,
  "WaitMsBeforeAsync": 5000
}
```

---

## 2. Fast 1-Command Stop ("kill server")

When the user requests to stop or kill the dev server (e.g. `"kill server"`, `"stop local"`, `"stop server"`):

### Command
```bash
npm run wt stop
```

### What It Does (<100ms execution)
1. Finds any process running on port 3000 and forcefully terminates it.
2. Removes any remaining `.next/dev/lock` files in active worktrees.
3. Returns confirmation that port 3000 is clean and available.

### Automatic Teardown in Worktree Clean
Note that `npm run wt clean <topic>` also automatically calls server shutdown before removing the worktree directory, preventing orphaned node processes or locked directories.

---

## 3. Critical Guardrails

1. **Build Guardrail**: NEVER run `next build` or `npm run build` while `next dev` is actively running in the same worktree. The dev server locks `.next/` and causes build cache corruption. Always run `npm run wt stop` before invoking `next build` or `npm run wt release <topic>`.
2. **Synchronous Execution Parameter**: Always pass `WaitMsBeforeAsync: 5000` and `IsDaemon: false` when calling `npm run wt serve <topic>`. Because `wt serve` spawns the dev server detached and exits after polling readiness, it returns in ~2s. Setting `IsDaemon: false` and `WaitMsBeforeAsync: 5000` ensures you get the output instantly without background task churn.
3. **Log Inspection**: If the dev server reports an error or fails to boot, inspect the tail of `/tmp/revizz-dev-3000.log`:
   ```bash
   tail -n 50 /tmp/revizz-dev-3000.log
   ```
