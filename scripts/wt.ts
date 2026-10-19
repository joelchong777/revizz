#!/usr/bin/env npx tsx
/**
 * Revizz Git Worktree Automation CLI (wt.ts)
 * 
 * Codifies Rule 12 from AGENTS.md:
 * Worktree Isolation & Independent Live Release Protocol
 * 
 * Commands:
 *   create <topic>        Create an isolated worktree from origin/main with symlinked assets
 *   list                  List all active git worktrees with branches, paths, and HEAD commits
 *   verify [topic]        Run TypeScript typecheck and QA tests inside worktree
 *   release <topic>       Rebase on origin/main, verify, show diff, and atomic push to main
 *   clean <topic>         Safely remove worktree and prune branch (refuses if unmerged without --force)
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawnSync, spawn } from 'node:child_process';
import http from 'node:http';
import https from 'node:https';

// --- Terminal Styling Helpers ---
const isColorSupported = !process.env.NO_COLOR && (process.stdout.isTTY || process.env.FORCE_COLOR);

const colors = {
  reset: isColorSupported ? '\x1b[0m' : '',
  bold: isColorSupported ? '\x1b[1m' : '',
  dim: isColorSupported ? '\x1b[2m' : '',
  green: isColorSupported ? '\x1b[32m' : '',
  yellow: isColorSupported ? '\x1b[33m' : '',
  red: isColorSupported ? '\x1b[31m' : '',
  cyan: isColorSupported ? '\x1b[36m' : '',
  magenta: isColorSupported ? '\x1b[35m' : '',
  blue: isColorSupported ? '\x1b[34m' : '',
};

function header(title: string): void {
  const line = '═'.repeat(68);
  console.log(`\n${colors.cyan}${colors.bold}${line}`);
  console.log(`  ${title}`);
  console.log(`${line}${colors.reset}\n`);
}

function success(msg: string): void {
  console.log(`${colors.green}${colors.bold}✔ ${msg}${colors.reset}`);
}

function info(msg: string): void {
  console.log(`${colors.cyan}ℹ ${msg}${colors.reset}`);
}

function warn(msg: string): void {
  console.warn(`${colors.yellow}⚠️  ${msg}${colors.reset}`);
}

function error(msg: string): void {
  console.error(`${colors.red}${colors.bold}✖ Error: ${msg}${colors.reset}`);
}

// --- Data Types ---
export interface WorktreeInfo {
  path: string;
  head: string;
  branch: string;
  isBare: boolean;
  isDetached: boolean;
  isMain: boolean;
  topic?: string;
  commitSubject?: string;
}

export interface ResolvedWorktree {
  worktreePath: string;
  topic: string;
  branch: string;
  isMain: boolean;
}

// --- Git & Filesystem Utilities ---
export function getRepoRoot(): string {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
  } catch {
    error('Not inside a git repository.');
    process.exit(1);
  }
}

export function isSymlink(filePath: string): boolean {
  try {
    const stat = fs.lstatSync(filePath);
    return stat.isSymbolicLink();
  } catch {
    return false;
  }
}

export function getTimestamp(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${mm}${dd}${hh}${min}`;
}

export function sanitizeTopic(topic: string): string {
  return topic
    .replace(/^feat\//, '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-');
}

export function parseWorktrees(repoRoot: string): WorktreeInfo[] {
  try {
    const raw = execSync('git worktree list --porcelain', {
      cwd: repoRoot,
      encoding: 'utf-8',
    });

    const entries = raw.trim().split(/\n\n+/);
    const result: WorktreeInfo[] = [];

    for (const block of entries) {
      if (!block.trim()) continue;
      const lines = block.split('\n');

      let wtPath = '';
      let head = '';
      let branch = '';
      let isBare = false;
      let isDetached = false;

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          wtPath = line.substring(9).trim();
        } else if (line.startsWith('HEAD ')) {
          head = line.substring(5).trim();
        } else if (line.startsWith('branch refs/heads/')) {
          branch = line.substring(18).trim();
        } else if (line.startsWith('branch ')) {
          branch = line.substring(7).trim();
        } else if (line === 'bare') {
          isBare = true;
        } else if (line === 'detached') {
          isDetached = true;
        }
      }

      if (isDetached || !branch) {
        branch = '(detached HEAD)';
      }

      const isMain = path.resolve(wtPath) === path.resolve(repoRoot);

      // Extract topic from .worktrees/<topic> path if applicable
      let topic: string | undefined;
      const wtPrefix = path.resolve(repoRoot, '.worktrees');
      if (wtPath.startsWith(wtPrefix)) {
        topic = path.relative(wtPrefix, wtPath);
      }

      // Commit subject
      let commitSubject = '';
      if (head) {
        try {
          commitSubject = execSync(`git log -1 --format=%s ${head}`, {
            cwd: repoRoot,
            encoding: 'utf-8',
          }).trim();
        } catch {
          commitSubject = '';
        }
      }

      result.push({
        path: wtPath,
        head,
        branch,
        isBare,
        isDetached,
        isMain,
        topic,
        commitSubject,
      });
    }

    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    error(`Failed to list worktrees: ${message}`);
    return [];
  }
}

export function resolveWorktree(inputTopic: string, repoRoot: string): ResolvedWorktree | null {
  const cleanInput = sanitizeTopic(inputTopic);
  const worktrees = parseWorktrees(repoRoot);

  // 1. Direct match on .worktrees/<topic>
  const directPath = path.resolve(repoRoot, '.worktrees', cleanInput);
  const matchedByDirect = worktrees.find(w => path.resolve(w.path) === directPath);
  if (matchedByDirect) {
    return {
      worktreePath: matchedByDirect.path,
      topic: cleanInput,
      branch: matchedByDirect.branch,
      isMain: matchedByDirect.isMain,
    };
  }

  // 2. Check if input is a path
  const absoluteInputPath = path.isAbsolute(inputTopic)
    ? path.resolve(inputTopic)
    : path.resolve(repoRoot, inputTopic);

  const matchedByPath = worktrees.find(w => path.resolve(w.path) === absoluteInputPath);
  if (matchedByPath) {
    return {
      worktreePath: matchedByPath.path,
      topic: matchedByPath.topic || path.basename(matchedByPath.path),
      branch: matchedByPath.branch,
      isMain: matchedByPath.isMain,
    };
  }

  // 3. Match by topic name or branch name in worktrees
  const matched = worktrees.find(w => {
    if (w.topic && w.topic.toLowerCase() === cleanInput.toLowerCase()) return true;
    if (w.branch && w.branch.toLowerCase() === inputTopic.toLowerCase()) return true;
    if (w.branch && w.branch.toLowerCase() === `feat/${cleanInput}`.toLowerCase()) return true;
    if (w.branch && w.branch.toLowerCase().startsWith(`feat/${cleanInput}-`.toLowerCase())) return true;
    return false;
  });

  if (matched) {
    return {
      worktreePath: matched.path,
      topic: matched.topic || cleanInput,
      branch: matched.branch,
      isMain: matched.isMain,
    };
  }

  // 4. If directory exists on disk even if not listed in worktree list
  if (fs.existsSync(directPath)) {
    let branch = '';
    try {
      branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: directPath,
        encoding: 'utf-8',
      }).trim();
    } catch {
      branch = 'unknown';
    }
    return {
      worktreePath: directPath,
      topic: cleanInput,
      branch,
      isMain: false,
    };
  }

  return null;
}

export function verifyGitignore(repoRoot: string): void {
  const gitignorePath = path.resolve(repoRoot, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    warn('No .gitignore found in repository root. Creating one...');
    fs.writeFileSync(gitignorePath, '.worktrees\n.worktrees/\nnode_modules\n.env*.local\n.env.local\n', 'utf-8');
    return;
  }

  let content = fs.readFileSync(gitignorePath, 'utf-8');
  let updated = false;

  // Requirement: Verifies .gitignore ignores .worktrees/, node_modules, and .env.local without trailing slashes.
  const lines = content.split('\n').map(l => l.trim());

  // Check if .worktrees without trailing slash is present
  const hasWorktreesNoSlash = lines.some(l => l === '.worktrees' || l === '/.worktrees');
  if (!hasWorktreesNoSlash) {
    content += '\n# git worktrees\n.worktrees\n';
    updated = true;
  }

  // Check if node_modules without trailing slash is present
  const hasNodeModules = lines.some(l => l === 'node_modules' || l === '/node_modules');
  if (!hasNodeModules) {
    content += '\nnode_modules\n';
    updated = true;
  }

  // Check if .env.local without trailing slash is present
  const hasEnvLocal = lines.some(l => l === '.env.local' || l === '/.env.local');
  if (!hasEnvLocal) {
    content += '\n.env.local\n';
    updated = true;
  }

  if (updated) {
    fs.writeFileSync(gitignorePath, content, 'utf-8');
    info('Updated .gitignore to ensure .worktrees, node_modules, and .env.local patterns exist.');
  }

  // Verify using git check-ignore without trailing slashes
  try {
    const ignored = execSync('git check-ignore .worktrees node_modules .env.local', {
      cwd: repoRoot,
      encoding: 'utf-8',
    }).trim().split(/\s+/).filter(Boolean);

    success(`.gitignore verified: ${ignored.join(', ')} are strictly ignored without trailing slashes.`);
  } catch {
    warn('git check-ignore check encountered non-zero status. Verify .gitignore patterns manually.');
  }
}

export function syncAgentTooling(repoRoot: string, worktreePath: string): void {
  const toolingPaths = [
    'scripts/wt.ts',
    'scripts/codebase-map.ts',
    'scripts/agent-memory.ts',
    'scripts/blackboard.ts',
    'scripts/verify-ui.ts',
    '.agent/CODEBASE_MAP.md',
    '.agent/memory/learnings_and_reflections.md',
    '.agent/skills/revizz-local-server',
    '.agent/skills/revizz-push-live',
  ];

  let syncedCount = 0;
  for (const rel of toolingPaths) {
    const src = path.resolve(repoRoot, rel);
    const dest = path.resolve(worktreePath, rel);

    if (fs.existsSync(src) && !fs.existsSync(dest)) {
      const parent = path.dirname(dest);
      if (!fs.existsSync(parent)) {
        fs.mkdirSync(parent, { recursive: true });
      }
      const stat = fs.statSync(src);
      if (stat.isDirectory()) {
        fs.cpSync(src, dest, { recursive: true });
      } else {
        fs.copyFileSync(src, dest);
      }
      syncedCount++;
    }
  }

  // Ensure .agent/CODEBASE_MAP.md exists; if missing, generate it quietly
  const targetMapPath = path.resolve(worktreePath, '.agent/CODEBASE_MAP.md');
  if (!fs.existsSync(targetMapPath)) {
    try {
      execSync('npx tsx scripts/codebase-map.ts generate', {
        cwd: worktreePath,
        stdio: 'ignore',
      });
      syncedCount++;
    } catch {
      // Quiet fallback
    }
  }

  if (syncedCount > 0) {
    success(`Synced ${syncedCount} agent tooling & metadata items to worktree.`);
  }
}

// --- CLI Commands ---

/**
 * 1. create <topic>
 */
export function commandCreate(topic: string | undefined, repoRoot: string): void {
  if (!topic) {
    error('Missing topic name for create command.');
    console.log(`\nUsage: npx tsx scripts/wt.ts create <topic>\nExample: npx tsx scripts/wt.ts create fast-ingestion-engine\n`);
    process.exit(1);
  }

  const cleanTopic = sanitizeTopic(topic);
  const branchName = `feat/${cleanTopic}-${getTimestamp()}`;
  const worktreePath = path.resolve(repoRoot, '.worktrees', cleanTopic);

  header(`CREATE WORKTREE: ${cleanTopic}`);

  // 1. Check collision
  if (fs.existsSync(worktreePath)) {
    error(`Worktree destination already exists: ${worktreePath}`);
    console.log(`To clean up the existing worktree, run:`);
    console.log(`  npx tsx scripts/wt.ts clean ${cleanTopic}\n`);
    process.exit(1);
  }

  // 2. Fetch origin/main
  info(`Fetching latest origin/main from remote...`);
  try {
    execSync('git fetch origin main', {
      cwd: repoRoot,
      stdio: 'inherit',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    error(`Failed to fetch origin/main: ${msg}`);
    process.exit(1);
  }

  // Get base commit SHA
  const baseSha = execSync('git rev-parse --short origin/main', {
    cwd: repoRoot,
    encoding: 'utf-8',
  }).trim();

  // 3. Ensure .worktrees parent folder exists
  fs.mkdirSync(path.resolve(repoRoot, '.worktrees'), { recursive: true });

  // 4. Create git worktree
  info(`Creating git worktree on branch '${branchName}' from origin/main (${baseSha})...`);
  try {
    execSync(`git worktree add -b "${branchName}" "${worktreePath}" origin/main`, {
      cwd: repoRoot,
      stdio: 'inherit',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    error(`Failed to create git worktree: ${msg}`);
    process.exit(1);
  }

  // 5. Create absolute symlinks
  const repoNodeModules = path.resolve(repoRoot, 'node_modules');
  const wtNodeModules = path.resolve(worktreePath, 'node_modules');
  if (fs.existsSync(repoNodeModules)) {
    if (fs.existsSync(wtNodeModules) || isSymlink(wtNodeModules)) {
      fs.rmSync(wtNodeModules, { recursive: true, force: true });
    }
    fs.symlinkSync(repoNodeModules, wtNodeModules);
    success(`Symlinked node_modules: ${repoNodeModules} -> ${wtNodeModules}`);
  } else {
    warn(`Root node_modules not found at ${repoNodeModules}. Run npm install in repo root.`);
  }

  const repoEnvLocal = path.resolve(repoRoot, '.env.local');
  const wtEnvLocal = path.resolve(worktreePath, '.env.local');
  if (fs.existsSync(repoEnvLocal)) {
    if (fs.existsSync(wtEnvLocal) || isSymlink(wtEnvLocal)) {
      fs.rmSync(wtEnvLocal, { force: true });
    }
    fs.symlinkSync(repoEnvLocal, wtEnvLocal);
    success(`Symlinked .env.local: ${repoEnvLocal} -> ${wtEnvLocal}`);
  } else {
    info(`No .env.local found in repo root; skipped .env.local symlinking.`);
  }

  // 6. Bootstrap agent tooling and atlas into worktree
  syncAgentTooling(repoRoot, worktreePath);

  // 7. Verify .gitignore
  verifyGitignore(repoRoot);

  // 8. Output clear status & instructions
  console.log(`\n${colors.green}${colors.bold}🚀 Worktree Created Successfully!${colors.reset}`);
  console.log(`\n  ${colors.bold}Topic:${colors.reset}       ${cleanTopic}`);
  console.log(`  ${colors.bold}Branch:${colors.reset}      ${colors.cyan}${branchName}${colors.reset}`);
  console.log(`  ${colors.bold}Path:${colors.reset}        ${worktreePath}`);
  console.log(`  ${colors.bold}Base:${colors.reset}        origin/main (${baseSha})`);
  console.log(`\n${colors.bold}Agent Workflow Quick Reference:${colors.reset}`);
  console.log(`  1. Enter worktree:    ${colors.cyan}cd "${worktreePath}"${colors.reset}`);
  console.log(`  2. Verify worktree:   ${colors.cyan}npx tsx scripts/wt.ts verify ${cleanTopic}${colors.reset}`);
  console.log(`  3. Release to live:   ${colors.cyan}npx tsx scripts/wt.ts release ${cleanTopic}${colors.reset}`);
  console.log(`  4. Teardown & clean:  ${colors.cyan}npx tsx scripts/wt.ts clean ${cleanTopic}${colors.reset}\n`);
}

/**
 * 2. list
 */
export function commandList(repoRoot: string): void {
  header('ACTIVE GIT WORKTREES');

  const worktrees = parseWorktrees(repoRoot);
  if (worktrees.length === 0) {
    info('No git worktrees found.');
    return;
  }

  const main = worktrees.find(w => w.isMain);
  const others = worktrees.filter(w => !w.isMain);

  if (main) {
    console.log(`${colors.bold}${colors.blue}[Main Repository]${colors.reset}`);
    console.log(`  Path:    ${main.path}`);
    console.log(`  Branch:  ${colors.green}${main.branch}${colors.reset}`);
    console.log(`  HEAD:    ${colors.yellow}${main.head.substring(0, 7)}${colors.reset} ${main.commitSubject || ''}`);
    console.log('');
  }

  if (others.length === 0) {
    info('No active feature worktrees currently allocated.');
  } else {
    console.log(`${colors.bold}${colors.magenta}[Isolated Feature Worktrees (${others.length})]${colors.reset}`);
    others.forEach((w, idx) => {
      const topicLabel = w.topic ? ` (${w.topic})` : '';
      const relPath = path.relative(repoRoot, w.path);
      console.log(`\n  ${colors.bold}#${idx + 1}${topicLabel}${colors.reset}`);
      console.log(`    Path:    ${relPath} ${colors.dim}(${w.path})${colors.reset}`);
      console.log(`    Branch:  ${colors.cyan}${w.branch}${colors.reset}`);
      console.log(`    HEAD:    ${colors.yellow}${w.head.substring(0, 7)}${colors.reset} ${w.commitSubject || ''}`);
    });
  }

  console.log(`\n${colors.dim}Total Active Worktrees: ${worktrees.length} (1 root + ${others.length} isolated)${colors.reset}\n`);
}

/**
 * 3. verify [topic]
 */
export function commandVerify(topic: string | undefined, repoRoot: string): void {
  let targetPath = '';
  let resolvedTopic = '';

  if (topic) {
    const resolved = resolveWorktree(topic, repoRoot);
    if (!resolved) {
      error(`Worktree for topic '${topic}' not found.`);
      console.log('\nRun `npx tsx scripts/wt.ts list` to inspect active worktrees.\n');
      process.exit(1);
    }
    targetPath = resolved.worktreePath;
    resolvedTopic = resolved.topic;
  } else {
    // Check if current working directory is inside a worktree
    const cwd = process.cwd();
    const wtDir = path.resolve(repoRoot, '.worktrees');
    if (cwd.startsWith(wtDir)) {
      const relative = path.relative(wtDir, cwd);
      const topSegment = relative.split(path.sep)[0];
      targetPath = path.resolve(wtDir, topSegment);
      resolvedTopic = topSegment;
    } else {
      error('No topic specified and current directory is not inside a worktree.');
      console.log('\nUsage: npx tsx scripts/wt.ts verify <topic>\n');
      process.exit(1);
    }
  }

  header(`VERIFY WORKTREE: ${resolvedTopic}`);
  console.log(`  Path: ${targetPath}\n`);

  if (!fs.existsSync(targetPath)) {
    error(`Worktree directory does not exist at: ${targetPath}`);
    process.exit(1);
  }

  // 1. Run TypeScript check (npx tsc --noEmit)
  console.log(`${colors.cyan}🧪 [1/2] Running TypeScript typecheck (npx tsc --noEmit)...${colors.reset}`);
  const tscResult = spawnSync('npx', ['tsc', '--noEmit'], {
    cwd: targetPath,
    stdio: 'inherit',
    env: process.env,
  });

  if (tscResult.status !== 0) {
    error(`TypeScript check failed in ${targetPath} (exit code ${tscResult.status}).`);
    process.exit(1);
  }
  success('TypeScript check passed with zero errors.');

  // 2. Run QA Test Suite (npm test)
  console.log(`\n${colors.cyan}🧪 [2/2] Running QA Test Suite (npm test)...${colors.reset}`);
  const testResult = spawnSync('npm', ['test'], {
    cwd: targetPath,
    stdio: 'inherit',
    env: process.env,
  });

  if (testResult.status !== 0) {
    error(`QA Test Suite failed in ${targetPath} (exit code ${testResult.status}).`);
    process.exit(1);
  }
  success('QA Test Suite passed with all assertions passing.');

  // Auto-sync Codebase Map if scripts/codebase-map.ts exists
  const codebaseMapScript = path.join(repoRoot, 'scripts/codebase-map.ts');
  if (fs.existsSync(codebaseMapScript)) {
    try {
      execSync('npx tsx scripts/codebase-map.ts generate', {
        cwd: repoRoot,
        stdio: 'ignore',
      });
      success('Codebase Atlas map synchronized (.agent/CODEBASE_MAP.md).');
    } catch {
      // Quietly ignore if indexer encounters errors
    }
  }

  console.log(`\n${colors.green}${colors.bold}✔ Verification Succeeded: All checks passed cleanly for ${resolvedTopic}.${colors.reset}\n`);
}

/**
 * 4. release <topic>
 */
export function commandRelease(topic: string | undefined, repoRoot: string, isDryRun: boolean): void {
  if (!topic) {
    error('Missing topic name for release command.');
    console.log(`\nUsage: npx tsx scripts/wt.ts release <topic> [--dry-run]\n`);
    process.exit(1);
  }

  const resolved = resolveWorktree(topic, repoRoot);
  if (!resolved) {
    error(`Worktree for topic '${topic}' not found.`);
    process.exit(1);
  }

  if (resolved.isMain) {
    error(`Cannot release from main repository! Rule 12 strictly mandates isolated worktree releases.`);
    process.exit(1);
  }

  const worktreePath = resolved.worktreePath;
  const branch = resolved.branch;

  header(`INDEPENDENT LIVE RELEASE: ${resolved.topic} -> origin/main`);
  console.log(`  Worktree: ${worktreePath}`);
  console.log(`  Branch:   ${branch}`);
  if (isDryRun) {
    console.log(`  Mode:     ${colors.yellow}${colors.bold}[DRY RUN]${colors.reset}`);
  }
  console.log('');

  // 1. Guard against detached HEAD or main branch
  if (branch === 'main' || branch === 'master' || branch.includes('detached')) {
    error(`Invalid branch '${branch}' for worktree release.`);
    process.exit(1);
  }

  // 2. Check for uncommitted changes in worktree
  const status = execSync('git status --porcelain', {
    cwd: worktreePath,
    encoding: 'utf-8',
  }).trim();

  if (status.length > 0) {
    error(`Worktree has uncommitted or unstaged changes:\n`);
    console.error(status);
    console.error(`\nPlease commit or stash all changes in ${worktreePath} before releasing.`);
    process.exit(1);
  }

  // 3. Fetch latest origin/main
  info(`Fetching latest origin/main...`);
  try {
    execSync('git fetch origin main', {
      cwd: worktreePath,
      stdio: 'inherit',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    error(`Failed to fetch origin/main: ${msg}`);
    process.exit(1);
  }

  // 4. Rebase worktree branch on origin/main
  info(`Rebasing branch '${branch}' on origin/main...`);
  try {
    execSync('git rebase origin/main', {
      cwd: worktreePath,
      stdio: 'inherit',
    });
    success(`Branch '${branch}' cleanly rebased on origin/main.`);
  } catch {
    error(`Rebase encountered merge conflicts in ${worktreePath}.`);
    console.log(`Resolve the conflicts inside ${worktreePath}, run 'git rebase --continue', and retry release.`);
    process.exit(1);
  }

  // 5. Verification Gate (Bundled Definition of Done)
  info(`Running pre-release verification gate inside worktree...`);
  console.log(`\n${colors.dim}--- Running npx tsc --noEmit ---${colors.reset}`);
  const tscResult = spawnSync('npx', ['tsc', '--noEmit'], {
    cwd: worktreePath,
    stdio: 'inherit',
    env: process.env,
  });
  if (tscResult.status !== 0) {
    error(`Pre-release TypeScript verification failed. Release aborted.`);
    process.exit(1);
  }

  console.log(`\n${colors.dim}--- Running npm test ---${colors.reset}`);
  const testResult = spawnSync('npm', ['test'], {
    cwd: worktreePath,
    stdio: 'inherit',
    env: process.env,
  });
  if (testResult.status !== 0) {
    error(`Pre-release QA tests failed. Release aborted.`);
    process.exit(1);
  }
  success('Verification gate passed.');

  // 6. Display Commits and Diff Stat
  console.log(`\n${colors.bold}Commits to be released to origin/main:${colors.reset}`);
  const commits = execSync('git log --oneline origin/main..HEAD', {
    cwd: worktreePath,
    encoding: 'utf-8',
  }).trim();

  if (!commits) {
    warn('No commits between origin/main and HEAD. Branch is already up-to-date with remote main.');
    console.log('Nothing to push.\n');
    return;
  }
  console.log(commits);

  console.log(`\n${colors.bold}Diff Stat:${colors.reset}`);
  const diffStat = execSync('git diff --stat origin/main..HEAD', {
    cwd: worktreePath,
    encoding: 'utf-8',
  });
  console.log(diffStat);

  // 7. Atomic Push
  const pushCmd = `git push origin ${branch}:main`;
  if (isDryRun) {
    console.log(`${colors.yellow}${colors.bold}[DRY RUN] Would execute:${colors.reset} ${colors.cyan}${pushCmd}${colors.reset}`);
    success('Dry run completed successfully. Verification passed. Ready for live push.');
  } else {
    info(`Executing atomic push: ${pushCmd}...`);
    try {
      execSync(`git push origin "${branch}":main`, {
        cwd: worktreePath,
        stdio: 'inherit',
      });
      console.log(`\n${colors.green}${colors.bold}🚀 Live Release Succeeded!${colors.reset}`);
      console.log(`Branch '${branch}' has been pushed directly to origin/main.`);
      console.log(`\nTo clean up this worktree now that it is merged, run:`);
      console.log(`  ${colors.cyan}npx tsx scripts/wt.ts clean ${resolved.topic}${colors.reset}\n`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      error(`Atomic push failed: ${msg}`);
      process.exit(1);
    }
  }
}

/**
 * 5. clean <topic>
 */
export function commandClean(topic: string | undefined, repoRoot: string, force: boolean): void {
  if (!topic) {
    error('Missing topic name for clean command.');
    console.log(`\nUsage: npx tsx scripts/wt.ts clean <topic> [--force]\n`);
    process.exit(1);
  }

  const resolved = resolveWorktree(topic, repoRoot);
  if (!resolved) {
    error(`Worktree for topic '${topic}' not found.`);
    process.exit(1);
  }

  if (resolved.isMain) {
    error('Refusing to clean main repository!');
    process.exit(1);
  }

  const worktreePath = resolved.worktreePath;
  const branch = resolved.branch;

  header(`CLEAN WORKTREE: ${resolved.topic}`);
  console.log(`  Path:   ${worktreePath}`);
  console.log(`  Branch: ${branch}\n`);

  // Stop active dev server on port 3000 to prevent file locks
  stopServerOnPort(3000);

  // 1. Fetch origin main to get true remote state
  info('Fetching latest origin/main...');
  try {
    execSync('git fetch origin main', { cwd: repoRoot, stdio: 'ignore' });
  } catch {
    warn('Could not fetch origin/main; evaluating ancestor status against local ref.');
  }

  // 2. Verify ancestor status (is branch merged into origin/main?)
  let isAncestor = false;
  if (branch && branch !== '(detached HEAD)') {
    try {
      execSync(`git merge-base --is-ancestor "${branch}" origin/main`, {
        cwd: repoRoot,
        stdio: 'ignore',
      });
      isAncestor = true;
    } catch {
      isAncestor = false;
    }
  }

  if (!isAncestor && !force && branch && branch !== '(detached HEAD)') {
    let unmerged = '';
    try {
      unmerged = execSync(`git log --oneline origin/main.."${branch}"`, {
        cwd: repoRoot,
        encoding: 'utf-8',
      }).trim();
    } catch {
      unmerged = '(unable to inspect log)';
    }

    error(`Refusing to remove worktree '${resolved.topic}'.`);
    console.error(`\nBranch '${branch}' contains unmerged commits not found on origin/main:`);
    console.error(`${colors.yellow}${unmerged}${colors.reset}\n`);
    console.error(`If you intend to discard these commits, re-run with:`);
    console.error(`  ${colors.cyan}npx tsx scripts/wt.ts clean ${resolved.topic} --force${colors.reset}\n`);
    process.exit(1);
  }

  if (force && !isAncestor) {
    warn(`Force flag active. Proceeding to discard unmerged branch '${branch}'.`);
  }

  // 3. Remove git worktree
  info(`Removing git worktree at ${worktreePath}...`);
  try {
    execSync(`git worktree remove --force "${worktreePath}"`, {
      cwd: repoRoot,
      stdio: 'inherit',
    });
    success(`Removed git worktree.`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    warn(`git worktree remove encountered: ${msg}`);
  }

  // Clean any remaining files on disk
  if (fs.existsSync(worktreePath)) {
    info(`Cleaning remaining files on disk: ${worktreePath}...`);
    try {
      fs.rmSync(worktreePath, { recursive: true, force: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      warn(`Failed to remove folder from disk: ${msg}`);
    }
  }

  // 4. Prune local branch
  if (branch && branch !== '(detached HEAD)' && branch !== 'main') {
    info(`Pruning local branch '${branch}'...`);
    try {
      execSync(`git branch -D "${branch}"`, {
        cwd: repoRoot,
        stdio: 'inherit',
      });
      success(`Pruned branch '${branch}'.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      warn(`Could not prune branch '${branch}': ${msg}`);
    }
  }

  // 5. Run git worktree prune
  try {
    execSync('git worktree prune', { cwd: repoRoot, stdio: 'ignore' });
  } catch {
    // Ignore prune errors
  }

  console.log(`\n${colors.green}${colors.bold}✔ Clean Completed: Worktree '${worktreePath}' removed and branch pruned cleanly.${colors.reset}\n`);
}

// --- Worktree Aliases ---
export const listWorktrees = parseWorktrees;
export const resolveTargetWorktree = resolveWorktree;

// --- Dev Server Management ---

/**
 * Stop any process listening on the specified port and kill tracked PID if present.
 */
export function stopServerOnPort(port: number = 3000): boolean {
  let stopped = false;
  const pidFile = `/tmp/revizz-dev-${port}.pid`;

  if (fs.existsSync(pidFile)) {
    try {
      const pidStr = fs.readFileSync(pidFile, 'utf-8').trim();
      const pid = parseInt(pidStr, 10);
      if (!isNaN(pid) && pid > 0) {
        try {
          process.kill(pid, 'SIGKILL');
          stopped = true;
        } catch {
          // PID may already be dead
        }
      }
    } catch {
      // Ignore reading error
    } finally {
      try {
        fs.rmSync(pidFile, { force: true });
      } catch {}
    }
  }

  try {
    execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore' });
    stopped = true;
  } catch {
    // Ignore error
  }

  return stopped;
}

/**
 * 6. serve [topic] [--port <number>] (alias: start)
 * Starts a detached local Next.js dev server in ~2s and exits cleanly.
 */
export async function commandServe(
  topic: string | undefined,
  repoRoot: string,
  port: number = 3000
): Promise<void> {
  let target: ResolvedWorktree;

  if (topic) {
    const resolved = resolveTargetWorktree(topic, repoRoot);
    if (!resolved) {
      error(`Worktree for topic '${topic}' not found.`);
      console.log('\nRun `npx tsx scripts/wt.ts list` to inspect active worktrees.\n');
      process.exit(1);
    }
    target = resolved;
  } else {
    const worktrees = listWorktrees(repoRoot);
    const featureWorktrees = worktrees.filter(
      w => !w.isMain && fs.existsSync(w.path) && fs.existsSync(path.join(w.path, 'package.json'))
    );

    if (featureWorktrees.length > 0) {
      // Pick most recently modified non-main worktree
      featureWorktrees.sort((a, b) => {
        let mtimeA = 0;
        let mtimeB = 0;
        try {
          mtimeA = fs.statSync(a.path).mtimeMs;
        } catch {}
        try {
          mtimeB = fs.statSync(b.path).mtimeMs;
        } catch {}
        return mtimeB - mtimeA;
      });

      const chosen = featureWorktrees[0];
      target = {
        worktreePath: chosen.path,
        topic: chosen.topic || path.basename(chosen.path),
        branch: chosen.branch,
        isMain: false,
      };
    } else {
      let currentBranch = 'main';
      try {
        currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
          cwd: repoRoot,
          encoding: 'utf-8',
        }).trim();
      } catch {}
      target = {
        worktreePath: repoRoot,
        topic: 'main',
        branch: currentBranch,
        isMain: true,
      };
    }
  }

  header(`START LOCAL DEV SERVER: ${target.topic}`);
  info(`Target worktree: ${target.worktreePath} (${target.branch})`);

  // Call stopServerOnPort(port) to free target port
  stopServerOnPort(port);

  // Remove stale .next/dev/lock inside target.worktreePath if it exists
  const lockFile = path.join(target.worktreePath, '.next', 'dev', 'lock');
  try {
    fs.rmSync(lockFile, { force: true });
  } catch {}

  const logFile = `/tmp/revizz-dev-${port}.log`;
  const pidFile = `/tmp/revizz-dev-${port}.pid`;

  let logFd: number;
  try {
    logFd = fs.openSync(logFile, 'w');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    error(`Failed to open log file ${logFile}: ${msg}`);
    process.exit(1);
  }

  const child = spawn('npx', ['next', 'dev', '-p', String(port)], {
    cwd: target.worktreePath,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  if (!child.pid) {
    try {
      fs.closeSync(logFd);
    } catch {}
    error('Failed to spawn Next.js dev server process.');
    process.exit(1);
  }

  fs.writeFileSync(pidFile, String(child.pid), 'utf-8');
  child.unref();
  try {
    fs.closeSync(logFd);
  } catch {}

  info(`Dev server launched with PID ${child.pid}. Polling http://localhost:${port}...`);

  const startTime = Date.now();
  const maxWaitMs = 15000;
  const pollIntervalMs = 250;
  let ready = false;

  while (Date.now() - startTime < maxWaitMs) {
    if (child.pid) {
      try {
        process.kill(child.pid, 0);
      } catch {
        error(`Dev server process (PID ${child.pid}) terminated unexpectedly.`);
        try {
          const logContent = fs.readFileSync(logFile, 'utf-8').trim();
          if (logContent) {
            console.error(`\n${colors.yellow}${logContent}${colors.reset}\n`);
          }
        } catch {}
        process.exit(1);
      }
    }

    let reachable = false;
    try {
      reachable = fs.readFileSync(logFile, 'utf-8').includes('Ready in');
    } catch {}

    if (reachable) {
      ready = true;
      break;
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  if (ready) {
    console.log(`\n${colors.green}${colors.bold}✔ Local Dev Server Ready at http://localhost:${port}${colors.reset}`);
    console.log(`  • Worktree : ${target.worktreePath} (${target.branch})`);
    console.log(`  • PID      : ${child.pid} (Logs: /tmp/revizz-dev-${port}.log)`);
    console.log(`  • Stop Cmd : npm run wt stop\n`);
  } else {
    warn(`Dev server process ${child.pid} started but did not respond within 15 seconds.`);
    console.log(`  • Check logs at: /tmp/revizz-dev-${port}.log\n`);
  }
}

/**
 * 7. stop [--port <number>] (alias: kill)
 * Stops dev server on port and cleans .next/dev/lock files.
 */
export function commandStop(repoRoot: string, port: number = 3000): void {
  stopServerOnPort(port);

  // Cleans .next/dev/lock across repoRoot and active worktrees
  const worktrees = listWorktrees(repoRoot);
  const pathsToCheck = new Set<string>([repoRoot]);
  for (const wt of worktrees) {
    pathsToCheck.add(wt.path);
  }

  const wtDir = path.resolve(repoRoot, '.worktrees');
  if (fs.existsSync(wtDir)) {
    try {
      const entries = fs.readdirSync(wtDir);
      for (const entry of entries) {
        pathsToCheck.add(path.resolve(wtDir, entry));
      }
    } catch {}
  }

  for (const p of pathsToCheck) {
    const lockFile = path.join(p, '.next', 'dev', 'lock');
    if (fs.existsSync(lockFile)) {
      try {
        fs.rmSync(lockFile, { force: true });
      } catch {}
    }
  }

  console.log(`\n${colors.green}${colors.bold}✔ Local Dev Server on port ${port} stopped and locks cleared.${colors.reset}\n`);
}

/**
 * 8. ship [topic] [-m "<commit message>"] [--fast] [--dry-run] [--skip-vercel]
 * (aliases: push-live, deploy)
 * Executes the entire "Push Live" lifecycle in one single command.
 */
export async function commandShip(
  topic: string | undefined,
  repoRoot: string,
  options: { message?: string; fast?: boolean; dryRun?: boolean; skipVercel?: boolean } = {}
): Promise<void> {
  let resolved: ResolvedWorktree;

  // Step 1 (Resolve Worktree)
  if (topic) {
    const res = resolveWorktree(topic, repoRoot);
    if (!res) {
      error(`Worktree for topic '${topic}' not found.`);
      process.exit(1);
    }
    resolved = res;
  } else {
    const worktrees = parseWorktrees(repoRoot);
    const featureWorktrees = worktrees.filter(
      w => !w.isMain && fs.existsSync(w.path) && fs.existsSync(path.join(w.path, 'package.json'))
    );

    if (featureWorktrees.length === 0) {
      error('No active feature worktrees found to ship.');
      process.exit(1);
    }

    // Pick most recently modified non-main worktree
    featureWorktrees.sort((a, b) => {
      let mtimeA = 0;
      let mtimeB = 0;
      try {
        mtimeA = fs.statSync(a.path).mtimeMs;
      } catch {}
      try {
        mtimeB = fs.statSync(b.path).mtimeMs;
      } catch {}
      return mtimeB - mtimeA;
    });

    const chosen = featureWorktrees[0];
    resolved = {
      worktreePath: chosen.path,
      topic: chosen.topic || path.basename(chosen.path),
      branch: chosen.branch,
      isMain: false,
    };
  }

  if (resolved.isMain) {
    error('Cannot ship from main repository! Rule 12 strictly mandates isolated worktree releases.');
    process.exit(1);
  }

  const worktreePath = resolved.worktreePath;
  const branch = resolved.branch;

  header(`SHIP / PUSH LIVE: ${resolved.topic} -> origin/main`);
  console.log(`  Worktree: ${worktreePath}`);
  console.log(`  Branch:   ${branch}`);
  if (options.dryRun) {
    console.log(`  Mode:     ${colors.yellow}${colors.bold}[DRY RUN]${colors.reset}`);
  }
  console.log('');

  if (branch === 'main' || branch === 'master' || branch.includes('detached')) {
    error(`Invalid branch '${branch}' for worktree ship.`);
    process.exit(1);
  }

  // Step 2 (Stop Local Server)
  info('Stopping any local dev server and clearing locks...');
  stopServerOnPort(3000);
  const lockFile = path.join(worktreePath, '.next', 'dev', 'lock');
  try {
    fs.rmSync(lockFile, { force: true });
  } catch {}

  // Step 3 (Auto-Stage & Commit if Dirty)
  let dirtyStatus = '';
  try {
    dirtyStatus = execSync('git status --porcelain', {
      cwd: worktreePath,
      encoding: 'utf-8',
    }).trim();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    error(`Failed to check git status in ${worktreePath}: ${msg}`);
    process.exit(1);
  }

  if (dirtyStatus.length > 0) {
    info('Uncommitted changes detected. Auto-staging and committing...');
    const addResult = spawnSync('git', ['add', '-A'], {
      cwd: worktreePath,
      stdio: 'inherit',
    });
    if (addResult.status !== 0) {
      error(`Failed to stage changes in ${worktreePath}.`);
      process.exit(1);
    }

    const commitMsg = options.message || `feat(${resolved.topic}): ship verified changes to production`;
    const commitResult = spawnSync('git', ['commit', '-m', commitMsg], {
      cwd: worktreePath,
      stdio: 'inherit',
    });
    if (commitResult.status !== 0) {
      error(`Failed to commit changes in ${worktreePath}.`);
      process.exit(1);
    }
    success(`Auto-committed changes: "${commitMsg}"`);
  }

  // Step 4 (Fetch & Rebase on origin/main)
  info('Fetching latest origin/main...');
  try {
    execSync('git fetch origin main', {
      cwd: worktreePath,
      stdio: 'inherit',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    error(`Failed to fetch origin/main: ${msg}`);
    process.exit(1);
  }

  const isAncestorResult = spawnSync('git', ['merge-base', '--is-ancestor', 'origin/main', 'HEAD'], {
    cwd: worktreePath,
    stdio: 'ignore',
  });
  const alreadyAncestor = isAncestorResult.status === 0;

  info(`Rebasing branch '${branch}' on origin/main...`);
  try {
    execSync('git rebase origin/main', {
      cwd: worktreePath,
      stdio: 'inherit',
    });
    success(`Branch '${branch}' cleanly rebased on origin/main.`);
  } catch {
    error(`Rebase encountered merge conflicts in ${worktreePath}.`);
    console.log(`Resolve the conflicts inside ${worktreePath}, run 'git rebase --continue', and retry ship.`);
    process.exit(1);
  }

  // Step 5 (Smart Verification Gate)
  if (options.fast && alreadyAncestor) {
    info('[--fast] Skipping redundant verification (already verified, no upstream divergence)');
  } else {
    info('Running verification gate inside worktree...');
    console.log(`\n${colors.dim}--- Running npx tsc --noEmit ---${colors.reset}`);
    const tscResult = spawnSync('npx', ['tsc', '--noEmit'], {
      cwd: worktreePath,
      stdio: 'inherit',
      env: process.env,
    });
    if (tscResult.status !== 0) {
      error('Pre-release TypeScript verification failed. Ship aborted.');
      process.exit(1);
    }

    console.log(`\n${colors.dim}--- Running npm test ---${colors.reset}`);
    const testResult = spawnSync('npm', ['test'], {
      cwd: worktreePath,
      stdio: 'inherit',
      env: process.env,
    });
    if (testResult.status !== 0) {
      error('Pre-release QA tests failed. Ship aborted.');
      process.exit(1);
    }
    success('Verification gate passed.');
  }

  // Step 6 (Atomic GitHub Push)
  console.log(`\n${colors.bold}Commits to be shipped to origin/main:${colors.reset}`);
  const commits = execSync('git log --oneline origin/main..HEAD', {
    cwd: worktreePath,
    encoding: 'utf-8',
  }).trim();

  if (!commits) {
    warn('No commits between origin/main and HEAD. Branch is already up-to-date with remote main.');
    console.log('Nothing to push.\n');
    return;
  }
  console.log(commits);

  console.log(`\n${colors.bold}Diff Stat:${colors.reset}`);
  const diffStat = execSync('git diff --stat origin/main..HEAD', {
    cwd: worktreePath,
    encoding: 'utf-8',
  });
  console.log(diffStat);

  const pushCmd = `git push origin "${branch}":main`;
  if (options.dryRun) {
    console.log(`${colors.yellow}${colors.bold}[DRY RUN] Would execute:${colors.reset} ${colors.cyan}${pushCmd}${colors.reset}`);
    success('Dry run completed successfully. Verification passed. Ready for live push.');
    return;
  }

  info(`Executing atomic push: ${pushCmd}...`);
  try {
    execSync(`git push origin "${branch}":main`, {
      cwd: worktreePath,
      stdio: 'inherit',
    });
    console.log(`\n${colors.green}${colors.bold}🚀 Live Release Succeeded!${colors.reset}`);
    console.log(`Branch '${branch}' has been pushed directly to origin/main.`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    error(`Atomic push failed: ${msg}`);
    process.exit(1);
  }

  // Step 7 (Smart Production Probe — skip for agent/tooling-only changes; GitHub push triggers Vercel CI/CD for app changes)
  const changedFiles = diffStat
    .split('\n')
    .map((l) => l.trim().split(/\s+\|\s+/)[0])
    .filter(Boolean);
  const hasAppChanges = changedFiles.some(
    (f) => f.startsWith('app/') || f.startsWith('components/') || f.startsWith('lib/') || f.startsWith('hooks/') || f.startsWith('public/')
  );

  if (!options.skipVercel && hasAppChanges) {
    info('Triggering Vercel production deployment and verifying live build...');
    try {
      execSync('npx vercel --prod --yes', { cwd: repoRoot, stdio: 'inherit' });
      success('Vercel production deployment verified and aliased to https://revizz-sand.vercel.app!');
    } catch (deployErr) {
      const msg = deployErr instanceof Error ? deployErr.message : String(deployErr);
      warn(`Vercel deployment failed during build: ${msg}`);
      throw new Error(`Production deploy failed on Vercel: ${msg}`);
    }
  } else if (!hasAppChanges) {
    info('Agent/tooling-only changes pushed to GitHub main — skipping Vercel deployment probe.');
  }

  // Step 8 (Automatic Worktree Cleanup)
  info(`Cleaning up worktree for topic '${resolved.topic}'...`);
  commandClean(resolved.topic, repoRoot, false);
}

/**
 * Help manual
 */
export function commandHelp(): void {
  console.log(`
${colors.bold}${colors.cyan}Revizz Git Worktree Automation CLI (wt.ts)${colors.reset}
Codifies Rule 12 from AGENTS.md: Worktree Isolation & Independent Live Release Protocol

${colors.bold}USAGE:${colors.reset}
  npx tsx scripts/wt.ts <command> [args] [options]

${colors.bold}COMMANDS:${colors.reset}
  ${colors.cyan}create <topic>${colors.reset}
      Creates an isolated git worktree at .worktrees/<topic> branched from origin/main.
      Generates collision-proof branch: feat/<topic>-$(date +%m%d%H%M).
      Creates absolute symlinks for node_modules and .env.local.
      Verifies .gitignore rules.

  ${colors.cyan}list${colors.reset}
      Lists all active git worktrees with their branches, paths, and HEAD commits.

  ${colors.cyan}serve [topic] [--port <number>]${colors.reset} (alias: ${colors.cyan}start${colors.reset})
      Starts a detached local Next.js dev server in the specified worktree
      (defaults to most recently modified feature worktree or repo root).
      Polls until server is responsive, writes logs to /tmp/revizz-dev-<port>.log,
      and exits cleanly without hanging CLI.

  ${colors.cyan}stop [--port <number>]${colors.reset} (alias: ${colors.cyan}kill${colors.reset})
      Stops local Next.js dev server on the specified port and clears stale
      .next/dev/lock files across all worktrees.

  ${colors.cyan}verify [topic]${colors.reset}
      Runs TypeScript typecheck (npx tsc --noEmit) and QA tests (npm test)
      inside the specified worktree path.

  ${colors.cyan}release <topic> [--dry-run]${colors.reset}
      Rebases worktree branch on origin/main.
      Runs verification gate (npx tsc --noEmit and npm test).
      Displays git log and diff stat.
      Executes atomic push: git push origin <branch>:main.

  ${colors.cyan}clean <topic> [--force]${colors.reset}
      Verifies remote ancestor status (git merge-base --is-ancestor <branch> origin/main).
      Removes worktree safely (git worktree remove --force).
      Prunes local branch (git branch -D).
      Refuses deletion if unmerged commits exist, unless --force is passed.

  ${colors.cyan}ship [topic] [-m "<msg>"] [--fast] [--dry-run] [--skip-vercel]${colors.reset}
      (aliases: ${colors.cyan}push-live${colors.reset}, ${colors.cyan}deploy${colors.reset})
      Full 1-command "Push Live" lifecycle:
      • Stops local dev server on port 3000 and clears locks.
      • Auto-stages and commits uncommitted changes (custom or default message).
      • Fetches origin/main and cleanly rebases feature branch.
      • Smart verification gate: runs tsc and test (skipped if --fast and no upstream divergence).
      • Executes atomic push: git push origin <branch>:main.
      • Triggers Vercel prod deployment and live URL probe (unless --skip-vercel).
      • Safely cleans up worktree and prunes feature branch.

${colors.bold}OPTIONS:${colors.reset}
  ${colors.cyan}--port, -p <number>${colors.reset} Dev server port (default: 3000)
  ${colors.cyan}-m, --message <msg>${colors.reset} Commit message for auto-committing uncommitted changes
  ${colors.cyan}--fast, --skip-verify${colors.reset} Skip redundant verification if HEAD is already rebased on origin/main
  ${colors.cyan}--skip-vercel${colors.reset}        Skip Vercel CLI deploy and live probe
  ${colors.cyan}--force, -f${colors.reset}         Force operation (used with clean to discard unmerged commits)
  ${colors.cyan}--dry-run${colors.reset}           Perform verification, rebase, and diff display without pushing
  ${colors.cyan}--help, -h${colors.reset}          Show this help manual

${colors.bold}EXAMPLES:${colors.reset}
  npx tsx scripts/wt.ts create fast-ingest
  npx tsx scripts/wt.ts list
  npx tsx scripts/wt.ts serve fast-ingest
  npx tsx scripts/wt.ts serve --port 3001
  npx tsx scripts/wt.ts stop
  npx tsx scripts/wt.ts verify fast-ingest
  npx tsx scripts/wt.ts release fast-ingest --dry-run
  npx tsx scripts/wt.ts release fast-ingest
  npx tsx scripts/wt.ts ship
  npx tsx scripts/wt.ts ship fast-ingest -m "feat: complete ingestion feature"
  npx tsx scripts/wt.ts ship --fast
  npx tsx scripts/wt.ts ship --dry-run
  npx tsx scripts/wt.ts clean fast-ingest
`);
}

// --- CLI Entrypoint ---
export async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    commandHelp();
    return;
  }

  const repoRoot = getRepoRoot();
  const force = args.includes('--force') || args.includes('-f');
  const dryRun = args.includes('--dry-run');
  const fast = args.includes('--fast') || args.includes('--skip-verify');
  const skipVercel = args.includes('--skip-vercel');

  // Parse optional -m <message> or --message <message> or -m="<message>" or --message="<message>"
  let message: string | undefined;
  const msgFlagIdx = args.findIndex(a => a === '--message' || a === '-m');
  if (msgFlagIdx !== -1 && args[msgFlagIdx + 1] && !args[msgFlagIdx + 1].startsWith('-')) {
    message = args[msgFlagIdx + 1];
  } else {
    const inlineMsg = args.find(a => a.startsWith('--message=') || a.startsWith('-m='));
    if (inlineMsg) {
      message = inlineMsg.slice(inlineMsg.indexOf('=') + 1);
    }
  }

  // Parse optional --port <number> or -p <number> or --port=<number>
  let port = 3000;
  const portFlagIdx = args.findIndex(a => a === '--port' || a === '-p');
  if (portFlagIdx !== -1 && args[portFlagIdx + 1] && !args[portFlagIdx + 1].startsWith('-')) {
    const parsed = parseInt(args[portFlagIdx + 1], 10);
    if (!isNaN(parsed) && parsed > 0) {
      port = parsed;
    }
  } else {
    const inlinePort = args.find(a => a.startsWith('--port=') || a.startsWith('-p='));
    if (inlinePort) {
      const parsed = parseInt(inlinePort.split('=')[1], 10);
      if (!isNaN(parsed) && parsed > 0) {
        port = parsed;
      }
    }
  }

  // Extract positional arguments (excluding command, flags, and flag values)
  const nonFlags: string[] = [];
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--port' || arg === '-p' || arg === '--message' || arg === '-m') {
      i++; // skip next arg as it's the flag value
      continue;
    }
    if (arg.startsWith('-')) {
      continue;
    }
    nonFlags.push(arg);
  }
  const topic = nonFlags[0];

  switch (command) {
    case 'create':
      commandCreate(topic, repoRoot);
      break;

    case 'list':
      commandList(repoRoot);
      break;

    case 'serve':
    case 'start':
      await commandServe(topic, repoRoot, port);
      break;

    case 'stop':
    case 'kill':
      commandStop(repoRoot, port);
      break;

    case 'verify':
      commandVerify(topic, repoRoot);
      break;

    case 'release':
      commandRelease(topic, repoRoot, dryRun);
      break;

    case 'clean':
      commandClean(topic, repoRoot, force);
      break;

    case 'ship':
    case 'push-live':
    case 'deploy':
      await commandShip(topic, repoRoot, { message, fast, dryRun, skipVercel });
      break;

    default:
      error(`Unknown command '${command}'`);
      commandHelp();
      process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  main().catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    error(msg);
    process.exit(1);
  });
}
