#!/usr/bin/env tsx
import {
  getBlackboard,
  updateBlackboard,
  registerWorker,
  updateWorkerStatus,
  resetBlackboard,
  registerWorktree,
  removeWorktree,
  setSharedData,
  getSharedData,
  setPort,
  getBlackboardFilePath,
  WorkerStatus,
} from '../lib/agentBlackboard';

function printHelp(): void {
  console.log(`
Agent Blackboard CLI

Usage:
  npx tsx scripts/blackboard.ts get
      Print the entire blackboard JSON.

  npx tsx scripts/blackboard.ts set <key> <json_value>
      Update a top-level key on the blackboard (e.g. session_id, ports, shared_data).

  npx tsx scripts/blackboard.ts worker <id> <role> <status> [task]
      Register or update a worker (status: idle | running | completed | failed).

  npx tsx scripts/blackboard.ts reset [session_id]
      Reset the blackboard to clean default state.

  npx tsx scripts/blackboard.ts worktree add <id> <topic> <branch> <path>
      Register an active worktree.

  npx tsx scripts/blackboard.ts worktree remove <id>
      Remove an active worktree entry.

  npx tsx scripts/blackboard.ts shared set <key> <json_value>
      Set a shared data variable.

  npx tsx scripts/blackboard.ts shared get <key>
      Get a shared data variable.

  npx tsx scripts/blackboard.ts port <name> <port_number>
      Set or update an allocated service port.

  npx tsx scripts/blackboard.ts path
      Display the active blackboard file path.
`);
}

function parseJsonOrString(val: string): any {
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h' || command === 'help') {
    printHelp();
    return;
  }

  switch (command) {
    case 'get': {
      const state = getBlackboard();
      console.log(JSON.stringify(state, null, 2));
      break;
    }

    case 'path': {
      console.log(getBlackboardFilePath());
      break;
    }

    case 'reset': {
      const sessionId = args[1];
      resetBlackboard(sessionId);
      console.log(`Blackboard reset successfully.`);
      break;
    }

    case 'set': {
      const key = args[1];
      const rawVal = args[2];
      if (!key || rawVal === undefined) {
        console.error('Error: missing key or json_value. Usage: blackboard set <key> <json_value>');
        process.exit(1);
      }
      const parsedVal = parseJsonOrString(rawVal);
      const updated = updateBlackboard({ [key]: parsedVal });
      console.log(`Updated blackboard [${key}]:`);
      console.log(JSON.stringify((updated as any)[key], null, 2));
      break;
    }

    case 'worker': {
      const id = args[1];
      const role = args[2];
      const status = args[3] as WorkerStatus;
      const task = args[4];

      if (!id || !role || !status) {
        console.error('Error: missing arguments. Usage: blackboard worker <id> <role> <status> [task]');
        process.exit(1);
      }

      const validStatuses: WorkerStatus[] = ['idle', 'running', 'completed', 'failed'];
      if (!validStatuses.includes(status)) {
        console.error(`Error: invalid status "${status}". Allowed values: ${validStatuses.join(', ')}`);
        process.exit(1);
      }

      registerWorker(id, role, task);
      updateWorkerStatus(id, status);
      console.log(`Worker [${id}] set to status: ${status} (${role})`);
      break;
    }

    case 'worktree': {
      const subcmd = args[1];
      if (subcmd === 'add') {
        const id = args[2];
        const topic = args[3];
        const branch = args[4];
        const wtPath = args[5];
        if (!id || !topic || !branch || !wtPath) {
          console.error('Error: missing worktree args. Usage: blackboard worktree add <id> <topic> <branch> <path>');
          process.exit(1);
        }
        registerWorktree(id, { topic, branch, path: wtPath });
        console.log(`Worktree [${id}] registered: ${branch} -> ${wtPath}`);
      } else if (subcmd === 'remove') {
        const id = args[2];
        if (!id) {
          console.error('Error: missing worktree id. Usage: blackboard worktree remove <id>');
          process.exit(1);
        }
        removeWorktree(id);
        console.log(`Worktree [${id}] removed.`);
      } else {
        console.error('Error: unknown worktree subcommand. Usage: blackboard worktree add|remove ...');
        process.exit(1);
      }
      break;
    }

    case 'shared': {
      const subcmd = args[1];
      const key = args[2];
      if (subcmd === 'set') {
        const rawVal = args[3];
        if (!key || rawVal === undefined) {
          console.error('Error: missing key or value. Usage: blackboard shared set <key> <json_value>');
          process.exit(1);
        }
        const val = parseJsonOrString(rawVal);
        setSharedData(key, val);
        console.log(`Shared data [${key}] set.`);
      } else if (subcmd === 'get') {
        if (!key) {
          console.error('Error: missing key. Usage: blackboard shared get <key>');
          process.exit(1);
        }
        const val = getSharedData(key);
        if (val === undefined) {
          console.log('undefined');
        } else {
          console.log(typeof val === 'object' ? JSON.stringify(val, null, 2) : val);
        }
      } else {
        console.error('Error: unknown shared subcommand. Usage: blackboard shared set|get ...');
        process.exit(1);
      }
      break;
    }

    case 'port': {
      const name = args[1];
      const portStr = args[2];
      if (!name || !portStr) {
        console.error('Error: missing arguments. Usage: blackboard port <name> <port_number>');
        process.exit(1);
      }
      const portNum = parseInt(portStr, 10);
      if (isNaN(portNum)) {
        console.error(`Error: invalid port number "${portStr}"`);
        process.exit(1);
      }
      setPort(name, portNum);
      console.log(`Port [${name}] set to ${portNum}`);
      break;
    }

    default: {
      console.error(`Unknown command: "${command}"`);
      printHelp();
      process.exit(1);
    }
  }
}

main();
