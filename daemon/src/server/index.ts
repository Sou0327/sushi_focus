import { config } from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { exec } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { TaskManager } from '../task/TaskManager.js';
import type { CreateTaskRequest, ChoiceRequest, HealthResponse, ApiResponse } from '../types/index.js';

// Load .env from project root
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../../..');
config({ path: resolve(PROJECT_ROOT, '.env') });

const FOCUS_SCRIPT = resolve(PROJECT_ROOT, 'scripts/focus-ide.sh');

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const VERSION = '0.1.0';

// IDE Focus Settings (loaded from .env)
let focusSettings = {
  enabled: process.env.FOCUS_ENABLED !== 'false',
  targetApp: process.env.FOCUS_APP || 'Cursor',
  focusOnNeedInput: process.env.FOCUS_ON_NEED_INPUT !== 'false',
  focusOnDone: process.env.FOCUS_ON_DONE !== 'false',
};

function focusIDE(): void {
  if (!focusSettings.enabled) return;

  exec(`"${FOCUS_SCRIPT}" "${focusSettings.targetApp}"`, (error, stdout, stderr) => {
    if (error) {
      console.error('[Focus] Failed:', stderr);
    } else {
      console.log('[Focus]', stdout.trim());
    }
  });
}

const app = express();
app.use(express.json());

// CORS for Chrome extension
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// WebSocket client management
const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  console.log('[WS] Client connected');
  clients.add(ws);

  ws.on('close', () => {
    console.log('[WS] Client disconnected');
    clients.delete(ws);
  });

  ws.on('error', (err) => {
    console.error('[WS] Error:', err);
    clients.delete(ws);
  });
});

// Broadcast to all connected clients
function broadcast(data: object): void {
  const message = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
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
  const response: HealthResponse = { ok: true, version: VERSION };
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

  if (!body.prompt) {
    const response: ApiResponse = { ok: false, error: 'prompt is required' };
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
}

interface AgentEventLog {
  taskId: string;
  message: string;
  level?: 'info' | 'warning' | 'error';
}

interface AgentEventNeedInput {
  taskId: string;
  question: string;
  choices?: { id: string; label: string }[];
}

interface AgentEventDone {
  taskId: string;
  summary: string;
  filesModified?: number;
}

// Agent: Task started
app.post('/agent/start', (req, res) => {
  const body = req.body as AgentEventStart;
  const taskId = body.taskId || `agent-${Date.now()}`;

  broadcast({
    type: 'task.started',
    taskId,
    prompt: body.prompt,
    repoId: body.repoId || 'external',
  });

  console.log(`[Agent] Task started: ${taskId} - ${body.prompt}`);
  res.json({ ok: true, taskId });
});

// Agent: Log message
app.post('/agent/log', (req, res) => {
  const body = req.body as AgentEventLog;

  if (!body.taskId || !body.message) {
    return res.status(400).json({ ok: false, error: 'taskId and message required' });
  }

  broadcast({
    type: 'task.log',
    taskId: body.taskId,
    level: body.level || 'info',
    message: body.message,
  });

  console.log(`[Agent] Log: ${body.message}`);
  res.json({ ok: true });
});

// Agent: Need input (triggers auto-focus)
app.post('/agent/need-input', (req, res) => {
  const body = req.body as AgentEventNeedInput;

  if (!body.taskId || !body.question) {
    return res.status(400).json({ ok: false, error: 'taskId and question required' });
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

  console.log(`[Agent] Need input: ${body.question}`);
  res.json({ ok: true });
});

// Agent: Task done (triggers auto-focus from distraction sites)
app.post('/agent/done', (req, res) => {
  const body = req.body as AgentEventDone;

  if (!body.taskId) {
    return res.status(400).json({ ok: false, error: 'taskId required' });
  }

  broadcast({
    type: 'task.done',
    taskId: body.taskId,
    summary: body.summary || 'Task completed',
    filesModified: body.filesModified || 0,
  });

  // Auto-focus IDE
  if (focusSettings.focusOnDone) {
    focusIDE();
  }

  console.log(`[Agent] Done: ${body.summary}`);
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
  const body = req.body;
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
