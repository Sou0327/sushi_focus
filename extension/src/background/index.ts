import type { DaemonEvent, ExtensionSettings, BackgroundTaskState, ErrorLogEntry, ErrorCategory, Language } from '@/shared/types';
import { DEFAULT_SETTINGS } from '@/shared/types';
import { isDaemonEvent, isHealthResponse } from '@/utils/typeGuards';
import { isHostOnDistractionDomain, shouldTriggerFocus } from '@/utils/focusLogic';
import { capturePageContent } from '@/utils/pageCapture';
import en from '@/i18n/locales/en.json';
import ja from '@/i18n/locales/ja.json';

// ============================================================
// Standalone Translation Helper (Service Worker, no React context)
// ============================================================

const localeData: Record<Language, Record<string, unknown>> = { en, ja };

function bgTranslate(key: string): string {
  const keys = key.split('.');
  let current: unknown = localeData[settings.language];
  for (const k of keys) {
    if (!current || typeof current !== 'object') return key;
    current = (current as Record<string, unknown>)[k];
  }
  return typeof current === 'string' ? current : key;
}

// ============================================================
// Keep-Alive (MV3 Service Worker stays active)
// ============================================================

const KEEP_ALIVE_ALARM = 'sushi-focus-keepalive';
const KEEP_ALIVE_INTERVAL_MINUTES = 0.4; // 24 seconds

const CLEANUP_ALARM = 'sushi-focus-cleanup';
const CLEANUP_INTERVAL_MINUTES = 5;
const MAX_DONE_TASK_AGE_MS = 30 * 60 * 1000; // 30 minutes

async function setupKeepAlive(): Promise<void> {
  // Clear existing alarm
  await chrome.alarms.clear(KEEP_ALIVE_ALARM);

  // Create new alarm
  chrome.alarms.create(KEEP_ALIVE_ALARM, {
    periodInMinutes: KEEP_ALIVE_INTERVAL_MINUTES,
  });

  console.log('[BG] Keep-alive alarm set');
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEP_ALIVE_ALARM) {
    // Keep service worker alive and check WebSocket connection
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.log('[BG] Keep-alive: reconnecting WebSocket...');
      connectWebSocket();
    }
  }

  if (alarm.name === CLEANUP_ALARM) {
    cleanupStaleDoneTasks();
  }
});

function cleanupStaleDoneTasks(): void {
  const now = Date.now();
  let cleaned = 0;
  for (const [taskId, task] of tasks) {
    if (
      (task.status === 'done' || task.status === 'error') &&
      task.completedAt &&
      now - task.completedAt > MAX_DONE_TASK_AGE_MS
    ) {
      tasks.delete(taskId);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`[BG] Cleaned up ${cleaned} stale done task(s)`);
    persistTasks();
  }
}

async function setupCleanup(): Promise<void> {
  await chrome.alarms.clear(CLEANUP_ALARM);
  chrome.alarms.create(CLEANUP_ALARM, {
    periodInMinutes: CLEANUP_INTERVAL_MINUTES,
  });
}

// ============================================================
// State
// ============================================================

let ws: WebSocket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

// Settings initialized from DEFAULT_SETTINGS (WebSocket URL now configurable)
let settings: ExtensionSettings = { ...DEFAULT_SETTINGS };

let lastDoneFocusTime = 0;
const disabledAutoFocusTaskIds = new Set<string>();
let daemonVersion: string | null = null;
let daemonGitBranch: string | null = null;

// Multi-task state management (active + completed history)
const tasks = new Map<string, BackgroundTaskState>();
// Completed tasks history (persisted to storage)
const completedTasks = new Map<string, BackgroundTaskState>();
// Error logs (persisted to storage)
const errorLogs: ErrorLogEntry[] = [];

// ============================================================
// Error Logging
// ============================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

async function logError(
  category: ErrorCategory,
  message: string,
  details?: string,
  taskId?: string
): Promise<void> {
  const entry: ErrorLogEntry = {
    id: generateId(),
    timestamp: Date.now(),
    category,
    message,
    details,
    taskId,
  };

  errorLogs.push(entry);

  // Trim old logs
  while (errorLogs.length > (settings.maxErrorLogs ?? 100)) {
    errorLogs.shift();
  }

  // Persist to storage
  if (settings.saveErrorLogs) {
    try {
      await chrome.storage.local.set({ errorLogs: [...errorLogs] });
    } catch {
      // Storage might be full, ignore
    }
  }

  // Notify user for connection/websocket errors
  if (category === 'connection' || category === 'websocket') {
    await showNotification(`⚠️ ${bgTranslate('notification.connectionError')}`, message);
  }
}

async function loadErrorLogs(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get('errorLogs');
    if (Array.isArray(stored.errorLogs)) {
      errorLogs.length = 0;
      errorLogs.push(...stored.errorLogs);
    }
  } catch {
    // Ignore load errors
  }
}

// ============================================================
// Task Management
// ============================================================

function getOrCreateTask(taskId: string): BackgroundTaskState {
  // Check for ID collision
  if (tasks.has(taskId)) {
    const existing = tasks.get(taskId)!;
    // If existing task is still active, return it
    if (existing.status === 'running' || existing.status === 'waiting_input') {
      return existing;
    }
    // Reactivate done/error tasks — preserve logs!
    if (existing.status === 'done' || existing.status === 'error') {
      existing.status = 'running';
      existing.completedAt = null;
      existing.summary = null;
      existing.errorMessage = null;
      existing.inputQuestion = null;
      existing.inputChoices = [];
      persistTasks();
      return existing;
    }
    // Fallthrough: unknown status → collision-avoidant ID (safety net)
    const uniqueId = `${taskId}-${Date.now()}`;
    console.log(`[BG] Task ID collision detected, using: ${uniqueId}`);
    taskId = uniqueId;
  }

  const task: BackgroundTaskState = {
    taskId,
    startedAt: Date.now(),
    logs: [],
    prompt: null,
    status: 'running',
    inputQuestion: null,
    inputChoices: [],
    completedAt: null,
    summary: null,
    errorMessage: null,
  };
  tasks.set(taskId, task);
  persistTasks();
  return task;
}

function completeTask(taskId: string, summary: string | null, errorMessage: string | null): void {
  const task = tasks.get(taskId);
  if (!task) return;

  task.completedAt = Date.now();
  task.summary = summary;
  task.errorMessage = errorMessage;

  // Move to completed history if enabled
  if (settings.keepCompletedTasks) {
    completedTasks.set(taskId, { ...task });

    // Trim old completed tasks
    const maxCompleted = settings.maxCompletedTasks ?? 50;
    if (completedTasks.size > maxCompleted) {
      const sortedEntries = Array.from(completedTasks.entries())
        .sort((a, b) => (a[1].completedAt ?? 0) - (b[1].completedAt ?? 0));
      const toRemove = sortedEntries.slice(0, completedTasks.size - maxCompleted);
      for (const [id] of toRemove) {
        completedTasks.delete(id);
      }
    }
  }

  // Keep in active tasks for potential reactivation (log persistence)
  // Task stays with 'done' status until reactivated or cleaned up
  persistTasks();
}

function removeCompletedTask(taskId: string): boolean {
  const deleted = completedTasks.delete(taskId);
  if (deleted) {
    persistTasks();
  }
  return deleted;
}

function clearCompletedTasks(): void {
  completedTasks.clear();
  persistTasks();
}

function getLatestActiveTask(): BackgroundTaskState | null {
  let latest: BackgroundTaskState | null = null;
  for (const task of tasks.values()) {
    if (task.status === 'running' || task.status === 'waiting_input') {
      if (!latest || task.startedAt > latest.startedAt) {
        latest = task;
      }
    }
  }
  return latest;
}

// ============================================================
// Task Persistence
// ============================================================

async function persistTasks(): Promise<void> {
  try {
    await chrome.storage.local.set({
      activeTasks: Array.from(tasks.values()),
      completedTasks: Array.from(completedTasks.values()),
    });
  } catch {
    // Storage might be full
  }
}

async function loadTasks(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get(['activeTasks', 'completedTasks']);

    // Restore active tasks
    if (Array.isArray(stored.activeTasks)) {
      tasks.clear();
      for (const task of stored.activeTasks) {
        if (task && typeof task.taskId === 'string') {
          tasks.set(task.taskId, task);
        }
      }
    }

    // Restore completed tasks
    if (Array.isArray(stored.completedTasks)) {
      completedTasks.clear();
      for (const task of stored.completedTasks) {
        if (task && typeof task.taskId === 'string') {
          completedTasks.set(task.taskId, task);
        }
      }
    }
  } catch {
    // Ignore load errors
  }
}

// ============================================================
// Storage
// ============================================================

interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitized: Partial<ExtensionSettings>;
}

function validateSettings(stored: unknown): ValidationResult {
  const errors: string[] = [];
  const sanitized: Partial<ExtensionSettings> = {};

  if (!stored || typeof stored !== 'object') {
    return { valid: false, errors: ['Settings must be an object'], sanitized: {} };
  }

  const s = stored as Record<string, unknown>;

  // Validate mode enum
  if (s.mode !== undefined) {
    if (['quiet', 'normal', 'force'].includes(s.mode as string)) {
      sanitized.mode = s.mode as ExtensionSettings['mode'];
    } else {
      errors.push(`Invalid mode: ${s.mode}`);
    }
  }

  // Validate numeric fields with range checks
  if (s.doneCountdownMs !== undefined) {
    const val = Number(s.doneCountdownMs);
    if (!isNaN(val) && val >= 0 && val <= 60000) {
      sanitized.doneCountdownMs = val;
    } else {
      errors.push(`Invalid doneCountdownMs: ${s.doneCountdownMs} (must be 0-60000)`);
    }
  }

  if (s.doneCooldownMs !== undefined) {
    const val = Number(s.doneCooldownMs);
    if (!isNaN(val) && val >= 0 && val <= 3600000) {
      sanitized.doneCooldownMs = val;
    } else {
      errors.push(`Invalid doneCooldownMs: ${s.doneCooldownMs} (must be 0-3600000)`);
    }
  }

  if (s.homeTabId !== undefined) {
    if (s.homeTabId === null || (typeof s.homeTabId === 'number' && !isNaN(s.homeTabId))) {
      sanitized.homeTabId = s.homeTabId as number | null;
    } else {
      errors.push(`Invalid homeTabId: ${s.homeTabId}`);
    }
  }

  if (s.homeWindowId !== undefined) {
    if (s.homeWindowId === null || (typeof s.homeWindowId === 'number' && !isNaN(s.homeWindowId))) {
      sanitized.homeWindowId = s.homeWindowId as number | null;
    } else {
      errors.push(`Invalid homeWindowId: ${s.homeWindowId}`);
    }
  }

  // Validate boolean fields
  const booleanFields = ['enabled', 'enableDoneFocus', 'alwaysFocusOnDone', 'keepCompletedTasks', 'saveErrorLogs', 'logPromptContent'] as const;
  for (const field of booleanFields) {
    if (s[field] !== undefined) {
      if (typeof s[field] === 'boolean') {
        (sanitized as Record<string, unknown>)[field] = s[field];
      } else {
        errors.push(`Invalid ${field}: ${s[field]} (must be boolean)`);
      }
    }
  }

  // Validate language enum
  if (s.language !== undefined) {
    if (['en', 'ja'].includes(s.language as string)) {
      sanitized.language = s.language as ExtensionSettings['language'];
    } else {
      errors.push(`Invalid language: ${s.language}`);
    }
  }

  // Validate theme enum
  if (s.theme !== undefined) {
    if (['dark', 'light'].includes(s.theme as string)) {
      sanitized.theme = s.theme as ExtensionSettings['theme'];
    } else {
      errors.push(`Invalid theme: ${s.theme}`);
    }
  }

  // Validate logVerbosity enum
  if (s.logVerbosity !== undefined) {
    if (['minimal', 'normal', 'verbose'].includes(s.logVerbosity as string)) {
      sanitized.logVerbosity = s.logVerbosity as ExtensionSettings['logVerbosity'];
    } else {
      errors.push(`Invalid logVerbosity: ${s.logVerbosity}`);
    }
  }

  // Validate distractionDomains array
  if (s.distractionDomains !== undefined) {
    if (Array.isArray(s.distractionDomains)) {
      const validDomains = s.distractionDomains.filter(d => typeof d === 'string' && d.length > 0);
      if (validDomains.length === s.distractionDomains.length) {
        sanitized.distractionDomains = validDomains;
      } else {
        errors.push('Some distractionDomains entries are invalid');
        sanitized.distractionDomains = validDomains;
      }
    } else {
      errors.push(`Invalid distractionDomains: must be an array`);
    }
  }

  // Validate URL fields
  if (s.daemonWsUrl !== undefined) {
    if (typeof s.daemonWsUrl === 'string' && isValidWsUrl(s.daemonWsUrl)) {
      sanitized.daemonWsUrl = s.daemonWsUrl;
    } else {
      errors.push(`Invalid daemonWsUrl: ${s.daemonWsUrl}`);
    }
  }

  if (s.daemonHttpUrl !== undefined) {
    if (typeof s.daemonHttpUrl === 'string' && isValidHttpUrl(s.daemonHttpUrl)) {
      sanitized.daemonHttpUrl = s.daemonHttpUrl;
    } else {
      errors.push(`Invalid daemonHttpUrl: ${s.daemonHttpUrl}`);
    }
  }

  // Validate auth token (string, max 256 chars)
  if (s.daemonAuthToken !== undefined) {
    if (typeof s.daemonAuthToken === 'string' && s.daemonAuthToken.length <= 256) {
      sanitized.daemonAuthToken = s.daemonAuthToken;
    } else {
      errors.push(`Invalid daemonAuthToken: must be a string of 256 chars or less`);
    }
  }

  // Validate max values
  if (s.maxCompletedTasks !== undefined) {
    const val = Number(s.maxCompletedTasks);
    if (!isNaN(val) && val >= 0 && val <= 1000) {
      sanitized.maxCompletedTasks = val;
    } else {
      errors.push(`Invalid maxCompletedTasks: ${s.maxCompletedTasks} (must be 0-1000)`);
    }
  }

  if (s.maxErrorLogs !== undefined) {
    const val = Number(s.maxErrorLogs);
    if (!isNaN(val) && val >= 0 && val <= 1000) {
      sanitized.maxErrorLogs = val;
    } else {
      errors.push(`Invalid maxErrorLogs: ${s.maxErrorLogs} (must be 0-1000)`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized,
  };
}

function isValidWsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'ws:' || parsed.protocol === 'wss:';
  } catch {
    return false;
  }
}

function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function loadSettings(): Promise<void> {
  const stored = await chrome.storage.local.get('settings');
  if (stored.settings) {
    const result = validateSettings(stored.settings);
    if (result.errors.length > 0) {
      console.warn('[BG] Settings validation errors:', result.errors);
      // Log errors for debugging
      await logError('unknown', 'Settings validation errors', result.errors.join('; '));
    }
    // Merge sanitized values with defaults (safe merge)
    settings = { ...DEFAULT_SETTINGS, ...result.sanitized };
  } else {
    settings = { ...DEFAULT_SETTINGS };
  }
}

async function saveSettings(): Promise<void> {
  await chrome.storage.local.set({ settings });
}

async function syncFocusSettingsToDaemon(): Promise<void> {
  // Best-effort sync: when SUSHI_FOCUS_SECRET is set on the daemon,
  // this POST will return 401 because the extension cannot provide auth.
  // The daemon falls back to its own .env-based focus settings in that case.
  const httpUrl = settings.daemonHttpUrl ?? DEFAULT_SETTINGS.daemonHttpUrl;
  try {
    const res = await fetch(`${httpUrl}/focus/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: settings.enabled,
        focusOnDone: settings.enableDoneFocus,
      }),
    });
    if (!res.ok) {
      console.warn(`[BG] Daemon rejected focus settings sync: ${res.status}`);
      return;
    }
    console.log('[BG] Synced focus settings to daemon');
  } catch {
    // Daemon may not be running - log only, don't break extension
    console.warn('[BG] Failed to sync focus settings to daemon');
  }
}

// ============================================================
// WebSocket Connection
// ============================================================

function connectWebSocket(): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const wsUrl = settings.daemonWsUrl ?? DEFAULT_SETTINGS.daemonWsUrl;
  console.log(`[BG] Connecting to daemon at ${wsUrl}...`);

  try {
    ws = new WebSocket(wsUrl);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[BG] Failed to create WebSocket:', msg);
    logError('connection', `Failed to create WebSocket: ${msg}`);
    scheduleReconnect();
    return;
  }

  ws.onopen = async () => {
    console.log('[BG] Connected to daemon');
    reconnectAttempts = 0;

    // Fetch daemon health info before broadcasting (so gitBranch is available)
    const httpUrl = settings.daemonHttpUrl ?? DEFAULT_SETTINGS.daemonHttpUrl;
    try {
      const res = await fetch(`${httpUrl}/health`);
      const health: unknown = await res.json();

      // O.2: Validate Health API response structure
      if (isHealthResponse(health)) {
        daemonVersion = health.version;
        daemonGitBranch = health.gitBranch;
      } else {
        console.warn('[BG] Invalid health response structure, using defaults');
        daemonVersion = null;
        daemonGitBranch = null;
      }
    } catch (error) {
      // Daemon might not support these fields yet, use defaults
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.warn('[BG] Failed to fetch health:', msg);
      daemonVersion = null;
      daemonGitBranch = null;
    }

    // Sync focus settings to daemon on reconnect
    syncFocusSettingsToDaemon();

    broadcastConnectionStatus(true);
  };

  ws.onclose = (event) => {
    console.log(`[BG] Disconnected from daemon (code: ${event.code}, reason: ${event.reason || 'none'})`);

    // Log unexpected disconnections
    if (event.code !== 1000 && event.code !== 1001) {
      logError('websocket', `WebSocket closed unexpectedly`, `Code: ${event.code}, Reason: ${event.reason || 'none'}`);
    }

    broadcastConnectionStatus(false);
    scheduleReconnect();
  };

  ws.onerror = (error) => {
    console.error('[BG] WebSocket error:', error);
    // Note: onerror doesn't provide useful error details in browsers
    logError('websocket', 'WebSocket connection error', 'Check if daemon is running');
  };

  ws.onmessage = (event) => {
    try {
      const parsed: unknown = JSON.parse(event.data);

      // O.1: Validate WebSocket message structure
      if (!isDaemonEvent(parsed)) {
        console.warn('[BG] Invalid or unknown daemon event, ignoring:', parsed);
        logError('parse', 'Invalid daemon event received', JSON.stringify(parsed).slice(0, 200));
        return;
      }

      handleDaemonEvent(parsed);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      console.error('[BG] Failed to parse message:', msg);
      logError('parse', `Failed to parse WebSocket message: ${msg}`);
    }
  };
}

function scheduleReconnect(): void {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.log('[BG] Max reconnect attempts reached');
    return;
  }

  reconnectAttempts++;
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
  console.log(`[BG] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);

  setTimeout(() => {
    connectWebSocket();
  }, delay);
}

function broadcastConnectionStatus(connected: boolean): void {
  chrome.runtime.sendMessage({
    type: 'connection_status',
    connected,
    gitBranch: daemonGitBranch,
  }).catch(() => {});
}

// ============================================================
// Event Handlers
// ============================================================

async function handleDaemonEvent(event: DaemonEvent): Promise<void> {
  console.log('[BG] Received event:', event.type);

  // Filter task.log by verbosity before forwarding
  if (event.type === 'task.log') {
    const verbosity = settings.logVerbosity ?? 'normal';
    const shouldLog =
      verbosity === 'verbose' ||
      (verbosity === 'normal' && event.level !== 'debug') ||
      (verbosity === 'minimal' && ['info', 'error', 'success', 'focus'].includes(event.level));

    if (!shouldLog) {
      return;
    }
  }

  // Mask user prompt content before forwarding (privacy)
  let forwardEvent = event;
  if (event.type === 'task.log' && !settings.logPromptContent && event.message.startsWith('[USER] ')) {
    forwardEvent = { ...event, message: '[USER] [Prompt content hidden]' };
  }

  // Forward to side panel (always, regardless of enabled state)
  chrome.runtime.sendMessage(forwardEvent).catch(() => {});

  // State management always runs — only auto-focus is gated by enabled
  switch (event.type) {
    case 'task.started': {
      const existing = tasks.get(event.taskId);
      const task = getOrCreateTask(event.taskId);
      // Preserve logs if task already exists and is active (e.g. re-sent start event)
      if (!existing || existing.status === 'done' || existing.status === 'error') {
        task.startedAt = Date.now();
        task.logs = [];
      }
      task.prompt = event.prompt || task.prompt;
      task.status = 'running';
      task.inputQuestion = null;
      task.inputChoices = [];
      break;
    }

    case 'task.log': {
      // Auto-create task if not exists (handles SW restart or event ordering issues)
      const task = getOrCreateTask(event.taskId);
      task.logs.push({
        level: event.level,
        message: forwardEvent.type === 'task.log' ? forwardEvent.message : event.message,
        ts: Date.now(),
        ...(event.messageKey && { messageKey: event.messageKey }),
        ...(event.messageParams && { messageParams: event.messageParams }),
      });
      // Keep only last 100 logs to prevent memory bloat
      if (task.logs.length > 100) {
        task.logs = task.logs.slice(-100);
      }
      persistTasks();
      break;
    }

    case 'task.need_input': {
      // Auto-create task if not exists (handles SW restart or event ordering issues)
      const task = getOrCreateTask(event.taskId);
      task.status = 'waiting_input';
      task.inputQuestion = event.question;
      task.inputChoices = event.choices;
      await handleNeedInput(event.taskId, event.question);
      break;
    }

    case 'task.done': {
      // Use existing task directly to avoid reactivation cycle on duplicate task.done events
      // (both scripts/claude-code-hooks.json and plugin hooks send /agent/done on Stop)
      const task = tasks.get(event.taskId) ?? getOrCreateTask(event.taskId);
      if (task.status === 'done') {
        // Already completed — skip duplicate processing
        break;
      }
      task.status = 'done';
      await handleDone(event.taskId, event.summary, event.summaryKey);
      // Move to completed history (preserves task for user review)
      completeTask(event.taskId, event.summary, null);
      break;
    }

    case 'task.error': {
      // Use existing task directly to avoid reactivation cycle on duplicate events
      const task = tasks.get(event.taskId) ?? getOrCreateTask(event.taskId);
      if (task.status === 'error') {
        break;
      }
      task.status = 'error';
      const errorMsg = event.messageKey ? bgTranslate(event.messageKey) : event.message;
      await showNotification(`🔴 ${bgTranslate('notification.taskFailed')}`, errorMsg);
      // Log the error
      await logError('api', event.message, event.details, event.taskId);
      // Move to completed history with error
      completeTask(event.taskId, null, event.message);
      break;
    }
  }
}

async function handleNeedInput(_taskId: string, question: string): Promise<void> {
  // Always show notification
  await showNotification(`🟡 ${bgTranslate('notification.inputRequired')}`, question);

  if (!settings.enabled) return;

  // Focus IDE when input is required (always, not gated by enableDoneFocus)
  await focusHomeTab();
}

async function handleDone(taskId: string, summary: string, summaryKey?: string): Promise<void> {
  // Always show notification
  const translatedSummary = summaryKey ? bgTranslate(summaryKey) : summary;
  await showNotification(`✅ ${bgTranslate('notification.taskComplete')}`, translatedSummary);

  if (!settings.enabled) return;

  // Check if auto-focus is disabled for this task
  if (disabledAutoFocusTaskIds.has(taskId)) {
    console.log('[BG] Auto-focus disabled for this task');
    return;
  }

  // Check if done focus is enabled
  if (!settings.enableDoneFocus) {
    console.log('[BG] Done focus disabled');
    return;
  }

  // Check if current tab is on a distraction domain
  let isOnDistraction = false;
  try {
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (currentTab?.url) {
      const url = new URL(currentTab.url);
      isOnDistraction = isHostOnDistractionDomain(url.hostname, settings.distractionDomains);
    }
  } catch {
    // Ignore URL parsing errors
  }

  // Use centralized focus logic to determine if we should trigger focus
  const focusResult = shouldTriggerFocus(
    isOnDistraction,
    settings.alwaysFocusOnDone,
    lastDoneFocusTime,
    settings.doneCooldownMs
  );

  if (!focusResult.shouldFocus) {
    console.log(`[BG] Skipping auto-focus: ${focusResult.reason}`);
    if (focusResult.reason === 'in_cooldown') {
      // Notify side panel to show emphasis only
      chrome.runtime.sendMessage({ type: 'done_cooldown_active' }).catch(() => {});
    }
    return;
  }

  console.log(`[BG] Triggering auto-focus: ${focusResult.reason}`);

  // Check if side panel is open using getContexts (MV3)
  let sidePanelOpen = false;
  try {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: [chrome.runtime.ContextType.SIDE_PANEL],
    });
    sidePanelOpen = contexts.length > 0;
  } catch {
    // getContexts not supported, assume side panel might be open
    sidePanelOpen = true;
  }

  if (sidePanelOpen) {
    // Send countdown to side panel
    console.log('[BG] Side panel open, sending countdown');
    chrome.runtime.sendMessage({
      type: 'start_done_countdown',
      taskId,
      summary: translatedSummary,
      countdownMs: settings.doneCountdownMs,
    }).catch(() => {});
  } else {
    // Side panel not open - execute focus directly after countdown
    console.log('[BG] Side panel closed, executing direct focus after countdown');
    setTimeout(async () => {
      const success = await focusHomeTab();
      if (success) {
        lastDoneFocusTime = Date.now();
      }
    }, settings.doneCountdownMs);
  }
}

// ============================================================
// Focus Actions
// ============================================================

async function focusHomeTab(): Promise<boolean> {
  if (!settings.homeTabId || !settings.homeWindowId) {
    console.log('[BG] Home tab not set');
    return false;
  }

  try {
    // Check if home tab still exists
    const tab = await chrome.tabs.get(settings.homeTabId);
    if (!tab) {
      console.log('[BG] Home tab no longer exists');
      settings.homeTabId = null;
      settings.homeWindowId = null;
      await saveSettings();
      return false;
    }

    // Focus the tab
    await chrome.tabs.update(settings.homeTabId, { active: true });
    await chrome.windows.update(settings.homeWindowId, { focused: true });

    console.log('[BG] Focused home tab');
    return true;
  } catch (error) {
    console.error('[BG] Failed to focus home tab:', error);
    return false;
  }
}

// ============================================================
// Notifications
// ============================================================

async function showNotification(title: string, message: string): Promise<void> {
  try {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title,
      message,
    });
  } catch (error) {
    console.error('[BG] Failed to show notification:', error);
  }
}

// ============================================================
// Message Handlers
// ============================================================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case 'get_connection_status':
        sendResponse({
          connected: ws?.readyState === WebSocket.OPEN,
          version: daemonVersion,
          gitBranch: daemonGitBranch,
        });
        break;

      case 'get_task_status': {
        // Get the latest active task for backward compatibility
        const latestTask = getLatestActiveTask();
        sendResponse({
          // Legacy single-task fields (backward compatibility)
          status: latestTask?.status ?? 'idle',
          taskId: latestTask?.taskId ?? null,
          startedAt: latestTask?.startedAt ?? null,
          prompt: latestTask?.prompt ?? null,
          logs: latestTask?.logs ?? [],
          // New multi-task fields
          tasks: Array.from(tasks.values()),
          completedTasks: Array.from(completedTasks.values()),
        });
        break;
      }

      case 'remove_completed_task': {
        const success = removeCompletedTask(message.taskId);
        sendResponse({ ok: success });
        break;
      }

      case 'clear_completed_tasks': {
        clearCompletedTasks();
        sendResponse({ ok: true });
        break;
      }

      case 'get_error_logs': {
        sendResponse({ errorLogs: [...errorLogs] });
        break;
      }

      case 'clear_error_logs': {
        errorLogs.length = 0;
        chrome.storage.local.remove('errorLogs');
        sendResponse({ ok: true });
        break;
      }

      case 'reset_settings': {
        settings = { ...DEFAULT_SETTINGS };
        await saveSettings();
        sendResponse({ ok: true, settings });
        break;
      }

      case 'get_settings':
        sendResponse({ settings });
        break;

      case 'update_settings': {
        const { valid, errors, sanitized } = validateSettings(message.settings);
        if (!valid) {
          console.warn('[BG] Invalid settings update rejected:', errors);
        }
        // Use sanitized values only (invalid fields are silently dropped)
        const prev = { enabled: settings.enabled, enableDoneFocus: settings.enableDoneFocus };
        settings = { ...settings, ...sanitized };
        await saveSettings();
        if (settings.enabled !== prev.enabled || settings.enableDoneFocus !== prev.enableDoneFocus) {
          syncFocusSettingsToDaemon();
        }
        sendResponse({ ok: true, warnings: errors.length > 0 ? errors : undefined });
        break;
      }

      case 'set_home_tab': {
        const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (currentTab?.id && currentTab?.windowId) {
          settings.homeTabId = currentTab.id;
          settings.homeWindowId = currentTab.windowId;
          await saveSettings();
          sendResponse({ ok: true, tabId: currentTab.id });
        } else {
          sendResponse({ ok: false, error: 'No active tab' });
        }
        break;
      }

      case 'clear_home_tab':
        settings.homeTabId = null;
        settings.homeWindowId = null;
        await saveSettings();
        sendResponse({ ok: true });
        break;

      case 'execute_done_focus': {
        // Always allow focus for done countdown - the taskId is for tracking only.
        // Even if the task was already deleted from the map (after 5s delay),
        // we should still execute the focus since the countdown was legitimately started.
        // This fixes the issue where long countdown (> 5s) would fail with "Task mismatch".
        const success = await focusHomeTab();
        if (success) {
          lastDoneFocusTime = Date.now();
        }
        sendResponse({ ok: success });
        break;
      }

      case 'cancel_done_focus':
        if (message.taskId) {
          disabledAutoFocusTaskIds.add(message.taskId);
        }
        sendResponse({ ok: true });
        break;

      case 'capture_and_send': {
        try {
          // Pre-check: restricted pages where scripting is not allowed
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          console.log('[Context] Active tab:', tab?.id, tab?.url?.slice(0, 80));
          if (!tab?.id || !tab.url) {
            sendResponse({ ok: false, error: 'No active tab' });
            break;
          }

          const restrictedPrefixes = ['chrome://', 'chrome-extension://', 'about:', 'edge://', 'brave://'];
          if (restrictedPrefixes.some(prefix => tab.url!.startsWith(prefix))) {
            sendResponse({ ok: false, error: 'Cannot capture this page' });
            break;
          }

          const captured = await capturePageContent();
          console.log('[Context] Strategy:', captured.strategy);

          const httpUrl = settings.daemonHttpUrl ?? DEFAULT_SETTINGS.daemonHttpUrl;
          console.log('[Context] Sending to:', `${httpUrl}/context`);
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (settings.daemonAuthToken) {
            headers['Authorization'] = `Bearer ${settings.daemonAuthToken}`;
          }
          const resp = await fetch(`${httpUrl}/context`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              url: captured.url,
              title: captured.title,
              content: captured.content,
              selectedText: captured.selectedText,
              strategy: captured.strategy,
            }),
          });
          const data = await resp.json();
          console.log('[Context] Daemon response:', JSON.stringify(data));
          sendResponse({ ok: data.ok });
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error('[Context] Error:', errorMessage);
          sendResponse({ ok: false, error: errorMessage });
        }
        break;
      }

      case 'reconnect':
        connectWebSocket();
        sendResponse({ ok: true });
        break;

      default:
        sendResponse({ ok: false, error: 'Unknown message type' });
    }
  })();

  return true; // Keep channel open for async response
});

// ============================================================
// Tab Event Handlers
// ============================================================

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === settings.homeTabId) {
    console.log('[BG] Home tab was closed');
    settings.homeTabId = null;
    settings.homeWindowId = null;
    saveSettings();
  }
});

// ============================================================
// Initialization
// ============================================================

chrome.runtime.onInstalled.addListener(async () => {
  console.log('[BG] Extension installed');
  await loadSettings();
  await loadTasks();
  await loadErrorLogs();
  await setupKeepAlive();
  await setupCleanup();
  connectWebSocket();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('[BG] Extension started');
  await loadSettings();
  await loadTasks();
  await loadErrorLogs();
  await setupKeepAlive();
  await setupCleanup();
  connectWebSocket();
});

// Initial connection
loadSettings().then(async () => {
  await loadTasks();
  await loadErrorLogs();
  await setupKeepAlive();
  await setupCleanup();
  connectWebSocket();
});
