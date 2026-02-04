#!/usr/bin/env node

/**
 * Sushi Focus Daemon Auto-Starter
 *
 * Flow:
 * 1. Port check (net.createServer)
 *    - Available → goto 5
 *    - In use → goto 2
 * 2. Health check (/health API)
 *    - OK → "already running" exit
 *    - NG → goto 3
 * 3. Zombie process detection (lsof -ti:PORT)
 *    - Found → goto 4
 *    - Not found → error exit
 * 4. Kill zombie → wait 1s → goto 5
 * 5. Start daemon (detached spawn)
 * 6. Health check retry (5s)
 *    - Success → done
 *    - Fail → error exit
 */

import { spawn, execSync } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = parseInt(process.env.SUSHI_FOCUS_PORT || process.env.PORT || '41593', 10);
const HEALTH_TIMEOUT = 5000;
const HEALTH_RETRY_INTERVAL = 500;
const STARTUP_WAIT = 1000;

/**
 * Find the daemon path by checking multiple locations
 */
function findDaemonPath() {
  // 1. Environment variable (highest priority)
  if (process.env.SUSHI_FOCUS_DAEMON_PATH && existsSync(process.env.SUSHI_FOCUS_DAEMON_PATH)) {
    return process.env.SUSHI_FOCUS_DAEMON_PATH;
  }

  // 2. Project root from environment variable
  if (process.env.SUSHI_FOCUS_PROJECT_ROOT) {
    const path = join(process.env.SUSHI_FOCUS_PROJECT_ROOT, 'daemon', 'dist', 'server', 'index.js');
    if (existsSync(path)) return path;
  }

  // 3. Check marketplace config (works for both GitHub and local installs)
  try {
    const marketplacePath = join(homedir(), '.claude', 'plugins', 'known_marketplaces.json');
    if (existsSync(marketplacePath)) {
      const marketplaces = JSON.parse(readFileSync(marketplacePath, 'utf-8'));
      const sushiFocus = marketplaces['sushi-focus'];
      if (sushiFocus) {
        // Check installLocation first (works for GitHub, local, and directory sources)
        if (sushiFocus.installLocation) {
          const path = join(sushiFocus.installLocation, 'daemon', 'dist', 'server', 'index.js');
          if (existsSync(path)) return path;
        }
        // Fallback to source.path for directory/local sources
        if (sushiFocus.source?.path) {
          const path = join(sushiFocus.source.path, 'daemon', 'dist', 'server', 'index.js');
          if (existsSync(path)) return path;
        }
      }
    }
  } catch {
    // Ignore JSON parse errors
  }

  // 4. Relative path from plugin (for development/symlink install)
  const relativePath = join(__dirname, '..', '..', '..', 'daemon', 'dist', 'server', 'index.js');
  if (existsSync(relativePath)) return relativePath;

  // 5. Common locations
  const commonPaths = [
    join(homedir(), 'kaihatu', 'FocusFlow', 'daemon', 'dist', 'server', 'index.js'),
    join(homedir(), 'projects', 'sushi-focus', 'daemon', 'dist', 'server', 'index.js'),
    join(homedir(), 'dev', 'sushi-focus', 'daemon', 'dist', 'server', 'index.js'),
  ];

  for (const path of commonPaths) {
    if (existsSync(path)) return path;
  }

  return null;
}

/**
 * Check if a port is available
 */
async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Health check the daemon
 */
async function healthCheck() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`http://127.0.0.1:${PORT}/health`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return { ok: true, version: data.version };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

/**
 * Find process using the port (macOS/Linux only)
 */
function findProcessOnPort(port) {
  try {
    const result = execSync(`lsof -ti:${port}`, { encoding: 'utf-8' });
    return result.trim().split('\n').filter(Boolean).map(Number);
  } catch {
    // lsof returns error if no process found, or on Windows
    return [];
  }
}

/**
 * Kill processes
 */
function killProcesses(pids) {
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM');
      console.log(`[sushi-focus] Killed zombie process: ${pid}`);
    } catch (err) {
      // Process may have already exited
      console.log(`[sushi-focus] Could not kill PID ${pid}: ${err.message}`);
    }
  }
}

/**
 * Wait for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Start the daemon
 */
function startDaemon(daemonPath) {
  const child = spawn('node', [daemonPath], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, PORT: String(PORT) }
  });

  child.unref();
  console.log(`[sushi-focus] Started daemon (PID: ${child.pid})`);
  return child.pid;
}

/**
 * Wait for daemon to become healthy
 */
async function waitForHealthy(timeout = HEALTH_TIMEOUT) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const result = await healthCheck();
    if (result.ok) {
      return result;
    }
    await sleep(HEALTH_RETRY_INTERVAL);
  }

  return { ok: false };
}

/**
 * Main entry point
 */
async function main() {
  console.log(`[sushi-focus] Checking daemon on port ${PORT}...`);

  // Find daemon path
  const daemonPath = findDaemonPath();
  if (!daemonPath) {
    console.error(`[sushi-focus] Error: Daemon not found.`);
    console.error(`[sushi-focus] Please set SUSHI_FOCUS_PROJECT_ROOT or SUSHI_FOCUS_DAEMON_PATH`);
    console.error(`[sushi-focus] Or build the daemon: cd <project-root> && pnpm build:daemon`);
    process.exit(1);
  }
  console.log(`[sushi-focus] Found daemon at: ${daemonPath}`);

  // Step 1: Check port availability
  const portAvailable = await isPortAvailable(PORT);

  if (!portAvailable) {
    // Step 2: Health check
    console.log(`[sushi-focus] Port ${PORT} in use, checking health...`);
    const health = await healthCheck();

    if (health.ok) {
      console.log(`[sushi-focus] Daemon already running (v${health.version})`);
      process.exit(0);
    }

    // Step 3: Find zombie process
    console.log(`[sushi-focus] Daemon unhealthy, looking for zombie process...`);
    const pids = findProcessOnPort(PORT);

    if (pids.length === 0) {
      console.error(`[sushi-focus] Error: Port ${PORT} in use but cannot find process.`);
      console.error(`[sushi-focus] Try manually: lsof -i:${PORT}`);
      process.exit(1);
    }

    // Step 4: Kill zombie
    console.log(`[sushi-focus] Found zombie process(es): ${pids.join(', ')}`);
    killProcesses(pids);
    await sleep(STARTUP_WAIT);

    // Verify port is now available
    const nowAvailable = await isPortAvailable(PORT);
    if (!nowAvailable) {
      console.error(`[sushi-focus] Error: Port ${PORT} still in use after kill.`);
      console.error(`[sushi-focus] Try manually: kill -9 $(lsof -ti:${PORT})`);
      process.exit(1);
    }
  }

  // Step 5: Start daemon
  console.log(`[sushi-focus] Starting daemon...`);
  startDaemon(daemonPath);

  // Step 6: Wait for healthy
  await sleep(STARTUP_WAIT);
  const result = await waitForHealthy();

  if (result.ok) {
    console.log(`[sushi-focus] Daemon started successfully (v${result.version})`);
    process.exit(0);
  } else {
    console.error(`[sushi-focus] Error: Daemon failed to start.`);
    console.error(`[sushi-focus] Check logs with: cd daemon && pnpm start`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`[sushi-focus] Unexpected error: ${err.message}`);
  process.exit(1);
});
