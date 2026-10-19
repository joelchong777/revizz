import fs from 'fs';
import path from 'path';

export type WorkerStatus = 'idle' | 'running' | 'completed' | 'failed';

export interface WorkerInfo {
  role: string;
  status: WorkerStatus;
  task?: string;
  updated_at: string;
  details?: any;
}

export interface WorktreeInfo {
  topic: string;
  branch: string;
  path: string;
  created_at: string;
}

export interface BlackboardState {
  session_id: string;
  active_worktrees: Record<string, WorktreeInfo>;
  ports: Record<string, number>;
  workers: Record<string, WorkerInfo>;
  shared_data: Record<string, any>;
}

/**
 * Resolves the absolute path to `.agent/state/blackboard.json`.
 * Handles running from project root, worktrees, or nested subdirectories.
 */
export function getBlackboardFilePath(): string {
  if (process.env.AGENT_BLACKBOARD_PATH) {
    return path.resolve(process.env.AGENT_BLACKBOARD_PATH);
  }

  const current = process.cwd();
  const worktreeIdx = current.indexOf('.worktrees');
  if (worktreeIdx !== -1) {
    const mainRoot = current.substring(0, worktreeIdx);
    return path.join(mainRoot, '.agent', 'state', 'blackboard.json');
  }

  let dir = current;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.agent')) || fs.existsSync(path.join(dir, 'package.json'))) {
      return path.join(dir, '.agent', 'state', 'blackboard.json');
    }
    dir = path.dirname(dir);
  }

  return path.resolve(current, '.agent', 'state', 'blackboard.json');
}

/**
 * Creates a default, clean BlackboardState instance.
 */
export function createDefaultBlackboard(sessionId?: string): BlackboardState {
  return {
    session_id: sessionId || `session_${Date.now()}`,
    active_worktrees: {},
    ports: {
      frontend: 3000,
      test_server: 3001,
    },
    workers: {},
    shared_data: {},
  };
}

/**
 * Executes a function with file locking to ensure safe concurrent access.
 */
function withFileLock<T>(filePath: string, fn: () => T): T {
  const lockPath = `${filePath}.lock`;
  const maxRetries = 80;
  const retryIntervalMs = 25;
  const staleLockMs = 10000;

  let acquired = false;
  let fd: number | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const lockDir = path.dirname(lockPath);
      if (!fs.existsSync(lockDir)) {
        fs.mkdirSync(lockDir, { recursive: true });
      }

      fd = fs.openSync(lockPath, 'wx');
      fs.writeSync(fd, `${process.pid}\n${Date.now()}`);
      acquired = true;
      break;
    } catch (err: any) {
      if (err.code === 'EEXIST') {
        try {
          const stats = fs.statSync(lockPath);
          if (Date.now() - stats.mtimeMs > staleLockMs) {
            fs.unlinkSync(lockPath);
          }
        } catch {
          // Ignore unlink errors
        }

        const waitUntil = Date.now() + retryIntervalMs;
        while (Date.now() < waitUntil) {
          // Synchronous sleep spin
        }
      } else {
        break;
      }
    }
  }

  try {
    return fn();
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        // Ignore
      }
    }
    if (acquired) {
      try {
        fs.unlinkSync(lockPath);
      } catch {
        // Ignore
      }
    }
  }
}

/**
 * Atomically writes JSON content via a unique temp file and rename.
 */
function atomicWriteJson(filePath: string, data: any): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tempFile = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  fs.renameSync(tempFile, filePath);
}

/**
 * Reads the current BlackboardState from disk.
 * Initializes with defaults if not present or corrupt.
 */
export function getBlackboard(): BlackboardState {
  const filePath = getBlackboardFilePath();
  if (!fs.existsSync(filePath)) {
    const defaultState = createDefaultBlackboard();
    withFileLock(filePath, () => {
      if (!fs.existsSync(filePath)) {
        atomicWriteJson(filePath, defaultState);
      }
    });
    return defaultState;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    return {
      session_id: parsed.session_id || `session_${Date.now()}`,
      active_worktrees: parsed.active_worktrees || {},
      ports: parsed.ports || {},
      workers: parsed.workers || {},
      shared_data: parsed.shared_data || {},
    };
  } catch {
    const defaultState = createDefaultBlackboard();
    withFileLock(filePath, () => {
      atomicWriteJson(filePath, defaultState);
    });
    return defaultState;
  }
}

/**
 * Atomically merges a partial patch into BlackboardState.
 */
export function updateBlackboard(patch: Partial<BlackboardState>): BlackboardState {
  const filePath = getBlackboardFilePath();
  return withFileLock(filePath, () => {
    let current: BlackboardState;
    try {
      if (fs.existsSync(filePath)) {
        current = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } else {
        current = createDefaultBlackboard();
      }
    } catch {
      current = createDefaultBlackboard();
    }

    const updated: BlackboardState = {
      session_id: patch.session_id !== undefined ? patch.session_id : (current.session_id || `session_${Date.now()}`),
      active_worktrees: {
        ...(current.active_worktrees || {}),
        ...(patch.active_worktrees || {}),
      },
      ports: {
        ...(current.ports || {}),
        ...(patch.ports || {}),
      },
      workers: {
        ...(current.workers || {}),
        ...(patch.workers || {}),
      },
      shared_data: {
        ...(current.shared_data || {}),
        ...(patch.shared_data || {}),
      },
    };

    atomicWriteJson(filePath, updated);
    return updated;
  });
}

/**
 * Registers a worker on the blackboard.
 */
export function registerWorker(workerId: string, role: string, task?: string): void {
  updateBlackboard({
    workers: {
      [workerId]: {
        role,
        status: task ? 'running' : 'idle',
        task,
        updated_at: new Date().toISOString(),
      },
    },
  });
}

/**
 * Updates a worker's status and optional details on the blackboard.
 */
export function updateWorkerStatus(
  workerId: string,
  status: WorkerStatus,
  details?: any
): void {
  const filePath = getBlackboardFilePath();
  withFileLock(filePath, () => {
    const current = getBlackboard();
    const existing = current.workers?.[workerId] || {
      role: 'worker',
      task: undefined,
    };

    const updatedWorker: WorkerInfo = {
      ...existing,
      status,
      updated_at: new Date().toISOString(),
      ...(details !== undefined ? { details } : {}),
    };

    updateBlackboard({
      workers: {
        [workerId]: updatedWorker,
      },
    });
  });
}

/**
 * Resets the blackboard to a clean default state.
 */
export function resetBlackboard(sessionId?: string): void {
  const filePath = getBlackboardFilePath();
  const defaultState = createDefaultBlackboard(sessionId);
  withFileLock(filePath, () => {
    atomicWriteJson(filePath, defaultState);
  });
}

/**
 * Registers an active worktree.
 */
export function registerWorktree(
  id: string,
  worktree: { topic: string; branch: string; path: string }
): void {
  updateBlackboard({
    active_worktrees: {
      [id]: {
        ...worktree,
        created_at: new Date().toISOString(),
      },
    },
  });
}

/**
 * Removes an active worktree entry from the blackboard.
 */
export function removeWorktree(id: string): void {
  const filePath = getBlackboardFilePath();
  withFileLock(filePath, () => {
    const current = getBlackboard();
    if (current.active_worktrees && current.active_worktrees[id]) {
      const active = { ...current.active_worktrees };
      delete active[id];
      const updated: BlackboardState = {
        ...current,
        active_worktrees: active,
      };
      atomicWriteJson(filePath, updated);
    }
  });
}

/**
 * Updates or sets a key-value pair in shared_data.
 */
export function setSharedData(key: string, value: any): void {
  updateBlackboard({
    shared_data: {
      [key]: value,
    },
  });
}

/**
 * Retrieves a key-value pair from shared_data.
 */
export function getSharedData<T = any>(key: string): T | undefined {
  const bb = getBlackboard();
  return bb.shared_data?.[key] as T | undefined;
}

/**
 * Sets or updates a port entry.
 */
export function setPort(service: string, port: number): void {
  updateBlackboard({
    ports: {
      [service]: port,
    },
  });
}
