import { config } from 'dotenv';
import express, { Express, Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { execFile, execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { TaskManager } from '../task/TaskManager.js';
import { validateString, validateOptionalString, validateNumber } from '../utils/validation.js';
import type { CreateTaskRequest, ChoiceRequest, HealthResponse, ApiResponse } from '../types/index.js';

// Load .env from project root
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../../..');
config({ path: resolve(PROJECT_ROOT, '.env') });

const FOCUS_SCRIPT = resolve(PROJECT_ROOT, 'scripts/focus-ide.sh');

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 41593;
const VERSION = '0.1.0';

// ============================================================
// Security Configuration
// ============================================================

// N.1: Allowed target applications (whitelist)
const ALLOWED_TARGET_APPS = new Set([
  'Antigravity',
  'Cursor',
  'VSCode',
  'VS Code',
  'Code',
  'Terminal',
  'iTerm',
  'iTerm2',
  'Warp',
  'Alacritty',
  'Hyper',
  'Sublime Text',
  'Atom',
  'WebStorm',
  'IntelliJ IDEA',
  'Vim',
  'Neovim',
  'Emacs',
]);

// N.2: CORS allowed origins
const DEFAULT_ALLOWED_ORIGINS = [
  /^chrome-extension:\/\//,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^http:\/\/localhost(:\d+)?$/,
];

function parseAllowedOrigins(): (string | RegExp)[] {
  const envOrigins = process.env.ALLOWED_ORIGINS;
  if (!envOrigins) return DEFAULT_ALLOWED_ORIGINS;

  // Parse comma-separated origins from env, add to defaults
  const customOrigins = envOrigins.split(',').map(o => o.trim()).filter(Boolean);
  return [...DEFAULT_ALLOWED_ORIGINS, ...customOrigins];
}

const ALLOWED_ORIGINS = parseAllowedOrigins();

// N.3: Authentication secret (optional)
const AUTH_SECRET = process.env.FOCUSFLOW_SECRET || null;

// O.3: Input validation limits
const MAX_PROMPT_LENGTH = 10000;
const MAX_TASK_ID_LENGTH = 100;
const MAX_MESSAGE_LENGTH = 5000;
const MAX_SUMMARY_LENGTH = 2000;

// IDE Focus Settings (loaded from .env)
const focusSettings = {
  enabled: process.env.FOCUS_ENABLED !== 'false',
  targetApp: process.env.FOCUS_APP || 'Cursor',
  focusOnNeedInput: process.env.FOCUS_ON_NEED_INPUT !== 'false',
  focusOnDone: process.env.FOCUS_ON_DONE !== 'false',
};

// N.1: Validate target app against whitelist
function isValidTargetApp(app: string): boolean {
  return ALLOWED_TARGET_APPS.has(app);
}

function focusIDE(): void {
  if (!focusSettings.enabled) return;

  // N.1: Whitelist validation before execution
  if (!isValidTargetApp(focusSettings.targetApp)) {
    console.error(`[Focus] Invalid target app: "${focusSettings.targetApp}". Must be one of: ${[...ALLOWED_TARGET_APPS].join(', ')}`);
    return;
  }

  // N.1: Use execFile instead of exec to prevent shell injection
  execFile(FOCUS_SCRIPT, [focusSettings.targetApp], (error, stdout, stderr) => {
    if (error) {
      console.error('[Focus] Failed:', stderr || error.message);
    } else {
      console.log('[Focus]', stdout.trim());
    }
  });
}

const app: Express = express();
app.use(express.json({ limit: '1mb' })); // O.3: Limit request body size

// N.2: CORS middleware with origin validation
function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // Allow requests without Origin (e.g., curl, Postman)

  for (const allowed of ALLOWED_ORIGINS) {
    if (allowed instanceof RegExp) {
      if (allowed.test(origin)) return true;
    } else if (allowed === origin) {
      return true;
    }
  }
  return false;
}

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;

  if (isOriginAllowed(origin)) {
    // Set specific origin instead of wildcard when origin is provided
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
  }

  // Handle preflight
  if (req.method === 'OPTIONS') {
    if (isOriginAllowed(origin)) {
      return res.status(204).end();
    } else {
      return res.status(403).json({ ok: false, error: 'Origin not allowed' });
    }
  }

  next();
});

// N.3: Authentication middleware (optional, enabled when FOCUSFLOW_SECRET is set)
// Routes called by external tools (Claude Code hooks) require auth.
// Routes called only by the extension are exempt (trusted local origin).
const AUTH_EXEMPT_ROUTES = ['/health', '/repos', '/agent/cancel'];
const AUTH_EXEMPT_PREFIXES = ['/tasks/'];

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip auth if no secret is configured (local development mode)
  if (!AUTH_SECRET) {
    return next();
  }

  // Skip auth for extension-only routes (local trusted origin)
  if (AUTH_EXEMPT_ROUTES.includes(req.path) ||
      AUTH_EXEMPT_PREFIXES.some(prefix => req.path.startsWith(prefix))) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ ok: false, error: 'Authorization header required (Bearer token)' });
    return;
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix
  if (token !== AUTH_SECRET) {
    res.status(401).json({ ok: false, error: 'Invalid authentication token' });
    return;
  }

  next();
}

app.use(authMiddleware);

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Q.3: WebSocket connection limit
const MAX_WS_CONNECTIONS = parseInt(process.env.FOCUSFLOW_MAX_WS_CONNECTIONS || '10', 10);
const PING_INTERVAL_MS = 30000; // 30 seconds

// WebSocket client management with alive tracking
interface ClientState {
  ws: WebSocket;
  isAlive: boolean;
}
const clients = new Map<WebSocket, ClientState>();

wss.on('connection', (ws) => {
  // Q.3: Reject if connection limit exceeded
  if (clients.size >= MAX_WS_CONNECTIONS) {
    console.warn(`[WS] Connection rejected: limit of ${MAX_WS_CONNECTIONS} reached`);
    ws.close(1013, 'Max connections reached');
    return;
  }

  console.log('[WS] Client connected');
  clients.set(ws, { ws, isAlive: true });

  // Q.3: Handle pong response
  ws.on('pong', () => {
    const state = clients.get(ws);
    if (state) {
      state.isAlive = true;
    }
  });

  ws.on('close', () => {
    console.log('[WS] Client disconnected');
    clients.delete(ws);
  });

  ws.on('error', (err) => {
    console.error('[WS] Error:', err);
    clients.delete(ws);
  });
});

// Q.3: Periodic ping to detect dead connections
const pingInterval = setInterval(() => {
  clients.forEach((state, ws) => {
    if (!state.isAlive) {
      console.log('[WS] Terminating unresponsive client');
      clients.delete(ws);
      ws.terminate();
      return;
    }
    state.isAlive = false;
    ws.ping();
  });
}, PING_INTERVAL_MS);

// Clean up ping interval on server close
wss.on('close', () => {
  clearInterval(pingInterval);
});

// Broadcast to all connected clients
function broadcast(data: object): void {
  const message = JSON.stringify(data);
  for (const [ws] of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}

// Initialize TaskManager with broadcast function
const taskManager = new TaskManager(broadcast);

// ============================================================
// HTTP API Endpoints
// ============================================================

// Health check
app.get('/health', (_req, res) => {
  let gitBranch: string | null = null;
  try {
    gitBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  } catch {
    // Git not available or not a git repo
  }
  const response: HealthResponse = { ok: true, version: VERSION, gitBranch };
  res.json(response);
});

// List repos (mock for now)
app.get('/repos', (_req, res) => {
  res.json([
    { repoId: 'default', name: 'Current Directory', path: process.cwd() },
  ]);
});

// Create task
app.post('/tasks', (req, res) => {
  const body = req.body as CreateTaskRequest;

  // O.3: Enhanced input validation
  const promptError = validateString(body.prompt, 'prompt', MAX_PROMPT_LENGTH);
  if (promptError) {
    const response: ApiResponse = { ok: false, error: promptError };
    return res.status(400).json(response);
  }

  const repoIdError = validateOptionalString(body.repoId, 'repoId', MAX_TASK_ID_LENGTH);
  if (repoIdError) {
    const response: ApiResponse = { ok: false, error: repoIdError };
    return res.status(400).json(response);
  }

  const taskId = taskManager.createTask(body.repoId || 'default', body.prompt);
  res.json({ taskId });
});

// Cancel task
app.post('/tasks/:id/cancel', (req, res) => {
  const { id } = req.params;
  const success = taskManager.cancelTask(id);

  if (!success) {
    const response: ApiResponse = { ok: false, error: 'Task not found' };
    return res.status(404).json(response);
  }

  res.json({ ok: true });
});

// Submit choice for input request
app.post('/tasks/:id/choice', (req, res) => {
  const { id } = req.params;
  const body = req.body as ChoiceRequest;

  if (!body.choiceId) {
    const response: ApiResponse = { ok: false, error: 'choiceId is required' };
    return res.status(400).json(response);
  }

  const success = taskManager.submitChoice(id, body.choiceId);

  if (!success) {
    const response: ApiResponse = { ok: false, error: 'Task not found or not waiting for input' };
    return res.status(404).json(response);
  }

  res.json({ ok: true });
});

// Get current task status
app.get('/tasks/current', (_req, res) => {
  const task = taskManager.getCurrentTask();
  if (!task) {
    return res.json({ task: null });
  }

  // Don't expose process in API response
  const { process: _, ...taskData } = task;
  res.json({ task: taskData });
});

// ============================================================
// External Agent Event API (for Claude Code, Cursor, etc.)
// ============================================================

interface AgentEventStart {
  taskId?: string;
  prompt: string;
  repoId?: string;
  image?: string;
}

interface AgentEventLog {
  taskId: string;
  message: string;
  level?: 'info' | 'warn' | 'warning' | 'error' | 'debug';
}

interface AgentEventNeedInput {
  taskId: string;
  question: string;
  choices?: { id: string; label: string }[];
}

interface AgentEventDone {
  taskId: string;
  summary?: string;
  filesModified?: number;
}

// Agent: Task started
app.post('/agent/start', (req, res) => {
  const body = req.body as AgentEventStart;

  // O.3: Enhanced input validation
  const promptError = validateString(body.prompt, 'prompt', MAX_PROMPT_LENGTH);
  if (promptError) {
    return res.status(400).json({ ok: false, error: promptError });
  }

  const taskIdError = validateOptionalString(body.taskId, 'taskId', MAX_TASK_ID_LENGTH);
  if (taskIdError) {
    return res.status(400).json({ ok: false, error: taskIdError });
  }

  const repoIdError = validateOptionalString(body.repoId, 'repoId', MAX_TASK_ID_LENGTH);
  if (repoIdError) {
    return res.status(400).json({ ok: false, error: repoIdError });
  }

  const taskId = body.taskId || `agent-${Date.now()}`;

  broadcast({
    type: 'task.started',
    taskId,
    prompt: body.prompt,
    repoId: body.repoId || 'external',
    startedAt: Date.now(),
    hasImage: !!body.image,
  });

  console.log(`[Agent] Task started: ${taskId} - ${body.prompt.slice(0, 100)}${body.prompt.length > 100 ? '...' : ''}`);
  res.json({ ok: true, taskId });
});

// Agent: Log message
app.post('/agent/log', (req, res) => {
  const body = req.body as AgentEventLog;

  // O.3: Enhanced input validation
  const taskIdError = validateString(body.taskId, 'taskId', MAX_TASK_ID_LENGTH);
  if (taskIdError) {
    return res.status(400).json({ ok: false, error: taskIdError });
  }

  const messageError = validateString(body.message, 'message', MAX_MESSAGE_LENGTH);
  if (messageError) {
    return res.status(400).json({ ok: false, error: messageError });
  }

  // Validate and normalize level enum
  const validLevels = ['info', 'warn', 'error', 'debug'] as const;
  const normalizedLevel = body.level === 'warning' ? 'warn' : body.level;
  if (body.level && !validLevels.includes(normalizedLevel as typeof validLevels[number])) {
    return res.status(400).json({ ok: false, error: `level must be one of: ${validLevels.join(', ')}` });
  }

  broadcast({
    type: 'task.log',
    taskId: body.taskId,
    level: normalizedLevel || 'info',
    message: body.message,
  });

  console.log(`[Agent] Log: ${body.message.slice(0, 200)}${body.message.length > 200 ? '...' : ''}`);
  res.json({ ok: true });
});

// Agent: Need input (triggers auto-focus)
app.post('/agent/need-input', (req, res) => {
  const body = req.body as AgentEventNeedInput;

  // O.3: Enhanced input validation
  const taskIdError = validateString(body.taskId, 'taskId', MAX_TASK_ID_LENGTH);
  if (taskIdError) {
    return res.status(400).json({ ok: false, error: taskIdError });
  }

  const questionError = validateString(body.question, 'question', MAX_MESSAGE_LENGTH);
  if (questionError) {
    return res.status(400).json({ ok: false, error: questionError });
  }

  // Validate choices array structure
  if (body.choices !== undefined) {
    if (!Array.isArray(body.choices)) {
      return res.status(400).json({ ok: false, error: 'choices must be an array' });
    }
    for (let i = 0; i < body.choices.length; i++) {
      const choice = body.choices[i];
      if (!choice || typeof choice.id !== 'string' || typeof choice.label !== 'string') {
        return res.status(400).json({ ok: false, error: `choices[${i}] must have id and label strings` });
      }
    }
  }

  broadcast({
    type: 'task.need_input',
    taskId: body.taskId,
    question: body.question,
    choices: body.choices || [],
  });

  // Auto-focus IDE
  if (focusSettings.focusOnNeedInput) {
    focusIDE();
  }

  console.log(`[Agent] Need input: ${body.question.slice(0, 100)}${body.question.length > 100 ? '...' : ''}`);
  res.json({ ok: true });
});

// Agent: Task done (triggers auto-focus from distraction sites)
app.post('/agent/done', (req, res) => {
  const body = req.body as AgentEventDone;

  // O.3: Enhanced input validation
  const taskIdError = validateString(body.taskId, 'taskId', MAX_TASK_ID_LENGTH);
  if (taskIdError) {
    return res.status(400).json({ ok: false, error: taskIdError });
  }

  const summaryError = validateOptionalString(body.summary, 'summary', MAX_SUMMARY_LENGTH);
  if (summaryError) {
    return res.status(400).json({ ok: false, error: summaryError });
  }

  if (body.filesModified !== undefined) {
    const filesModifiedError = validateNumber(body.filesModified, 'filesModified');
    if (filesModifiedError) {
      return res.status(400).json({ ok: false, error: filesModifiedError });
    }
  }

  const summary = typeof body.summary === 'string' && body.summary.trim().length > 0
    ? body.summary
    : 'Task completed';

  broadcast({
    type: 'task.done',
    taskId: body.taskId,
    summary,
    meta: { changedFiles: body.filesModified },
  });

  // Auto-focus IDE
  if (focusSettings.focusOnDone) {
    focusIDE();
  }

  console.log(`[Agent] Done: ${summary.slice(0, 100)}`);
  res.json({ ok: true });
});

// Agent: Cancel task
app.post('/agent/cancel', (req, res) => {
  const body = req.body as { taskId: string };

  // O.3: Enhanced input validation
  const taskIdError = validateString(body.taskId, 'taskId', MAX_TASK_ID_LENGTH);
  if (taskIdError) {
    return res.status(400).json({ ok: false, error: taskIdError });
  }

  // Cancel via TaskManager (handles both internal and external tasks)
  taskManager.cancelExternalTask(body.taskId);

  console.log(`[Agent] Task cancelled: ${body.taskId}`);
  res.json({ ok: true });
});

// Agent: Report progress
app.post('/agent/progress', (req, res) => {
  const body = req.body as { taskId: string; current: number; total: number; label?: string };

  // O.3: Enhanced input validation
  const taskIdError = validateString(body.taskId, 'taskId', MAX_TASK_ID_LENGTH);
  if (taskIdError) {
    return res.status(400).json({ ok: false, error: taskIdError });
  }

  const currentError = validateNumber(body.current, 'current');
  if (currentError) {
    return res.status(400).json({ ok: false, error: currentError });
  }

  const totalError = validateNumber(body.total, 'total');
  if (totalError) {
    return res.status(400).json({ ok: false, error: totalError });
  }

  const labelError = validateOptionalString(body.label, 'label', 200);
  if (labelError) {
    return res.status(400).json({ ok: false, error: labelError });
  }

  broadcast({
    type: 'task.progress',
    taskId: body.taskId,
    current: body.current,
    total: body.total,
    label: body.label,
  });

  res.json({ ok: true });
});

// ============================================================
// Focus Settings API
// ============================================================

// Get focus settings
app.get('/focus/settings', (_req, res) => {
  res.json(focusSettings);
});

// Update focus settings
app.post('/focus/settings', (req, res) => {
  const body = req.body as {
    enabled?: boolean;
    targetApp?: string;
    focusOnNeedInput?: boolean;
    focusOnDone?: boolean;
  };

  // O.3: Type validation
  if (body.enabled !== undefined && typeof body.enabled !== 'boolean') {
    return res.status(400).json({ ok: false, error: 'enabled must be a boolean' });
  }

  if (body.focusOnNeedInput !== undefined && typeof body.focusOnNeedInput !== 'boolean') {
    return res.status(400).json({ ok: false, error: 'focusOnNeedInput must be a boolean' });
  }

  if (body.focusOnDone !== undefined && typeof body.focusOnDone !== 'boolean') {
    return res.status(400).json({ ok: false, error: 'focusOnDone must be a boolean' });
  }

  // N.1: Whitelist validation for targetApp
  if (body.targetApp !== undefined) {
    if (typeof body.targetApp !== 'string') {
      return res.status(400).json({ ok: false, error: 'targetApp must be a string' });
    }
    if (!isValidTargetApp(body.targetApp)) {
      return res.status(400).json({
        ok: false,
        error: `Invalid targetApp: "${body.targetApp}". Allowed values: ${[...ALLOWED_TARGET_APPS].join(', ')}`,
      });
    }
  }

  // Apply validated settings
  if (body.enabled !== undefined) focusSettings.enabled = body.enabled;
  if (body.targetApp) focusSettings.targetApp = body.targetApp;
  if (body.focusOnNeedInput !== undefined) focusSettings.focusOnNeedInput = body.focusOnNeedInput;
  if (body.focusOnDone !== undefined) focusSettings.focusOnDone = body.focusOnDone;

  console.log('[Focus] Settings updated:', focusSettings);
  res.json({ ok: true, settings: focusSettings });
});

// Manual focus trigger
app.post('/focus/now', (_req, res) => {
  focusIDE();
  res.json({ ok: true, app: focusSettings.targetApp });
});

// ============================================================
// Start Server
// ============================================================

// Skip server startup during tests (Vitest sets VITEST env var)
if (!process.env.VITEST) {
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    FocusFlow Daemon                        ║
║                      v${VERSION}                              ║
╠═══════════════════════════════════════════════════════════╣
║  HTTP API: http://127.0.0.1:${PORT}                          ║
║  WebSocket: ws://127.0.0.1:${PORT}/ws                        ║
╚═══════════════════════════════════════════════════════════╝
    `);
  });
}

// Export for testing
export { app };
