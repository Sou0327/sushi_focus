import type { DaemonEvent, ExtensionSettings, BackgroundTaskState } from '@/shared/types';
import { isDaemonEvent, isHealthResponse } from '@/utils/typeGuards';
import { isHostOnDistractionDomain, shouldTriggerFocus } from '@/utils/focusLogic';

// ============================================================
// Keep-Alive (MV3 Service Worker stays active)
// ============================================================

const KEEP_ALIVE_ALARM = 'sushi-focus-keepalive';
const KEEP_ALIVE_INTERVAL_MINUTES = 0.4; // 24 seconds

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
});

// ============================================================
// State
// ============================================================

let ws: WebSocket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const DAEMON_WS_URL = 'ws://127.0.0.1:41593/ws';

let settings: ExtensionSettings = {
  mode: 'normal',
  homeTabId: null,
  homeWindowId: null,
  enableDoneFocus: true,
  alwaysFocusOnDone: true,
  doneCountdownMs: 1500,
  doneCooldownMs: 45000,
  distractionDomains: [
    'netflix.com',
    'tiktok.com',
    'youtube.com',
    'x.com',
    'twitter.com',
    'instagram.com',
    'twitch.tv',
    'reddit.com',
  ],
  enabled: true,
  language: 'en',
  theme: 'dark',
  logVerbosity: 'normal',
};

let lastDoneFocusTime = 0;
const disabledAutoFocusTaskIds = new Set<string>();
let daemonVersion: string | null = null;
let daemonGitBranch: string | null = null;

// Multi-task state management
const tasks = new Map<string, BackgroundTaskState>();

function getOrCreateTask(taskId: string): BackgroundTaskState {
  let task = tasks.get(taskId);
  if (!task) {
    task = {
      taskId,
      startedAt: Date.now(),
      logs: [],
      prompt: null,
      status: 'running',
      inputQuestion: null,
      inputChoices: [],
    };
    tasks.set(taskId, task);
  }
  return task;
}

function removeTask(taskId: string): void {
  tasks.delete(taskId);
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
// Storage
// ============================================================

function validateSettings(stored: unknown): boolean {
  if (!stored || typeof stored !== 'object') return false;
  const s = stored as Partial<ExtensionSettings>;

  // Validate mode enum
  if (s.mode !== undefined && !['quiet', 'normal', 'force'].includes(s.mode)) return false;

  // Validate numeric fields
  if (s.doneCountdownMs !== undefined && (typeof s.doneCountdownMs !== 'number' || isNaN(s.doneCountdownMs))) return false;
  if (s.doneCooldownMs !== undefined && (typeof s.doneCooldownMs !== 'number' || isNaN(s.doneCooldownMs))) return false;
  if (s.homeTabId !== undefined && s.homeTabId !== null && typeof s.homeTabId !== 'number') return false;
  if (s.homeWindowId !== undefined && s.homeWindowId !== null && typeof s.homeWindowId !== 'number') return false;

  // Validate boolean fields
  if (s.enabled !== undefined && typeof s.enabled !== 'boolean') return false;
  if (s.enableDoneFocus !== undefined && typeof s.enableDoneFocus !== 'boolean') return false;
  if (s.alwaysFocusOnDone !== undefined && typeof s.alwaysFocusOnDone !== 'boolean') return false;

  // Validate language enum
  if (s.language !== undefined && !['en', 'ja'].includes(s.language)) return false;

  // Validate theme enum
  if (s.theme !== undefined && !['dark', 'light'].includes(s.theme)) return false;

  // Validate logVerbosity enum
  if (s.logVerbosity !== undefined && !['minimal', 'normal', 'verbose'].includes(s.logVerbosity)) return false;

  // Validate distractionDomains array
  if (s.distractionDomains !== undefined) {
    if (!Array.isArray(s.distractionDomains)) return false;
    if (!s.distractionDomains.every(d => typeof d === 'string')) return false;
  }

  return true;
}

async function loadSettings(): Promise<void> {
  const stored = await chrome.storage.local.get('settings');
  if (stored.settings && validateSettings(stored.settings)) {
    settings = { ...settings, ...stored.settings };
  } else if (stored.settings) {
    console.warn('[BG] Invalid settings detected, using defaults');
  }
}

async function saveSettings(): Promise<void> {
  await chrome.storage.local.set({ settings });
}

// ============================================================
// WebSocket Connection
// ============================================================

function connectWebSocket(): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  console.log('[BG] Connecting to daemon...');
  ws = new WebSocket(DAEMON_WS_URL);

  ws.onopen = async () => {
    console.log('[BG] Connected to daemon');
    reconnectAttempts = 0;

    // Fetch daemon health info before broadcasting (so gitBranch is available)
    try {
      const res = await fetch('http://127.0.0.1:41593/health');
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
    } catch {
      // Daemon might not support these fields yet, use defaults
      daemonVersion = null;
      daemonGitBranch = null;
    }

    broadcastConnectionStatus(true);
  };

  ws.onclose = () => {
    console.log('[BG] Disconnected from daemon');
    broadcastConnectionStatus(false);
    scheduleReconnect();
  };

  ws.onerror = (error) => {
    console.error('[BG] WebSocket error:', error);
  };

  ws.onmessage = (event) => {
    try {
      const parsed: unknown = JSON.parse(event.data);

      // O.1: Validate WebSocket message structure
      if (!isDaemonEvent(parsed)) {
        console.warn('[BG] Invalid or unknown daemon event, ignoring:', parsed);
        return;
      }

      handleDaemonEvent(parsed);
    } catch (e) {
      console.error('[BG] Failed to parse message:', e);
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
      (verbosity === 'minimal' && (event.level === 'info' || event.level === 'error'));

    if (!shouldLog) {
      return;
    }
  }

  // Forward to side panel (always, regardless of enabled state)
  chrome.runtime.sendMessage(event).catch(() => {});

  // State management always runs — only auto-focus is gated by enabled
  switch (event.type) {
    case 'task.started': {
      const task = getOrCreateTask(event.taskId);
      task.startedAt = Date.now();
      task.logs = [];
      task.prompt = event.prompt || null;
      task.status = 'running';
      task.inputQuestion = null;
      task.inputChoices = [];
      break;
    }

    case 'task.log': {
      // Auto-create task if not exists (handles SW restart or event ordering issues)
      const task = getOrCreateTask(event.taskId);
      task.logs.push({ level: event.level, message: event.message, ts: Date.now() });
      // Keep only last 100 logs to prevent memory bloat
      if (task.logs.length > 100) {
        task.logs = task.logs.slice(-100);
      }
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
      // Auto-create task if not exists (handles SW restart)
      const task = getOrCreateTask(event.taskId);
      task.status = 'done';
      await handleDone(event.taskId, event.summary);
      // Remove task after a delay to allow UI to display completion
      setTimeout(() => removeTask(event.taskId), 5000);
      break;
    }

    case 'task.error': {
      // Auto-create task if not exists (handles SW restart)
      const task = getOrCreateTask(event.taskId);
      task.status = 'error';
      await showNotification('🔴 Task Failed', event.message);
      // Remove task after a delay
      setTimeout(() => removeTask(event.taskId), 5000);
      break;
    }
  }
}

async function handleNeedInput(_taskId: string, question: string): Promise<void> {
  // Always show notification
  await showNotification('🟡 Input Required', question);

  if (!settings.enabled) return;

  // Focus IDE when input is required (always, not gated by enableDoneFocus)
  await focusHomeTab();
}

async function handleDone(taskId: string, summary: string): Promise<void> {
  // Always show notification
  await showNotification('✅ Task Complete', summary);

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

  // Start countdown (handled by side panel)
  chrome.runtime.sendMessage({
    type: 'start_done_countdown',
    taskId,
    summary,
    countdownMs: settings.doneCountdownMs,
  }).catch(() => {});
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
          // New multi-task field
          tasks: Array.from(tasks.values()),
        });
        break;
      }

      case 'get_settings':
        sendResponse({ settings });
        break;

      case 'update_settings':
        settings = { ...settings, ...message.settings };
        await saveSettings();
        sendResponse({ ok: true });
        break;

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
  await setupKeepAlive();
  connectWebSocket();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('[BG] Extension started');
  await loadSettings();
  await setupKeepAlive();
  connectWebSocket();
});

// Initial connection
loadSettings().then(async () => {
  await setupKeepAlive();
  connectWebSocket();
});
