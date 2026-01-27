import type { DaemonEvent, ExtensionSettings } from '@/shared/types';

// ============================================================
// Keep-Alive (MV3 Service Worker stays active)
// ============================================================

const KEEP_ALIVE_ALARM = 'focusflow-keepalive';
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
const DAEMON_WS_URL = 'ws://127.0.0.1:3000/ws';

let settings: ExtensionSettings = {
  mode: 'force',
  homeTabId: null,
  homeWindowId: null,
  enableDoneFocus: true,
  alwaysFocusOnDone: false,
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
};

let lastDoneFocusTime = 0;
let currentTaskId: string | null = null;
let disabledAutoFocusTaskIds = new Set<string>();
let taskStartedAt: number | null = null;
let daemonVersion: string | null = null;
let daemonGitBranch: string | null = null;

// ============================================================
// Storage
// ============================================================

async function loadSettings(): Promise<void> {
  const stored = await chrome.storage.local.get('settings');
  if (stored.settings) {
    settings = { ...settings, ...stored.settings };
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
      const res = await fetch('http://127.0.0.1:3000/health');
      const health = await res.json();
      daemonVersion = health.version || null;
      daemonGitBranch = health.gitBranch || null;
    } catch {
      // Daemon might not support these fields yet
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
      const data = JSON.parse(event.data) as DaemonEvent;
      handleDaemonEvent(data);
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

  // Forward to side panel (always, regardless of enabled state)
  chrome.runtime.sendMessage(event).catch(() => {});

  // State management always runs — only auto-focus is gated by enabled
  switch (event.type) {
    case 'task.started':
      currentTaskId = event.taskId;
      taskStartedAt = Date.now();
      break;

    case 'task.need_input':
      await handleNeedInput(event.taskId, event.question);
      break;

    case 'task.done':
      await handleDone(event.taskId, event.summary);
      taskStartedAt = null;
      currentTaskId = null;
      break;

    case 'task.error':
      await showNotification('🔴 Task Failed', event.message);
      taskStartedAt = null;
      currentTaskId = null;
      break;
  }
}

async function handleNeedInput(_taskId: string, question: string): Promise<void> {
  // Always show notification
  await showNotification('🟡 Input Required', question);

  if (!settings.enabled) return;

  // Force mode: immediately focus home tab
  if (settings.mode === 'force') {
    await focusHomeTab();
  }
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

  // Check mode
  if (settings.mode !== 'force') {
    console.log('[BG] Not in force mode, skipping auto-focus');
    return;
  }

  // Check if done focus is enabled
  if (!settings.enableDoneFocus) {
    console.log('[BG] Done focus disabled');
    return;
  }

  // Check cooldown
  const now = Date.now();
  if (now - lastDoneFocusTime < settings.doneCooldownMs) {
    console.log('[BG] In cooldown period, skipping auto-focus');
    // Notify side panel to show emphasis only
    chrome.runtime.sendMessage({ type: 'done_cooldown_active' }).catch(() => {});
    return;
  }

  // Check if currently on distraction site (skip check if alwaysFocusOnDone is enabled)
  if (!settings.alwaysFocusOnDone) {
    const isDistracted = await checkDistraction();
    if (!isDistracted) {
      console.log('[BG] Not on distraction site, skipping auto-focus');
      return;
    }
  }

  // Start countdown (handled by side panel)
  chrome.runtime.sendMessage({
    type: 'start_done_countdown',
    taskId,
    summary,
    countdownMs: settings.doneCountdownMs,
  }).catch(() => {});
}

async function checkDistraction(): Promise<boolean> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return false;

    const url = new URL(tab.url);
    const hostname = url.hostname.toLowerCase();

    return settings.distractionDomains.some(domain => {
      const d = domain.toLowerCase();
      return hostname === d || hostname.endsWith('.' + d);
    });
  } catch {
    return false;
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

      case 'get_task_status':
        sendResponse({
          status: currentTaskId ? 'running' : 'idle',
          taskId: currentTaskId,
          startedAt: taskStartedAt,
        });
        break;

      case 'get_settings':
        sendResponse({ settings });
        break;

      case 'update_settings':
        settings = { ...settings, ...message.settings };
        await saveSettings();
        sendResponse({ ok: true });
        break;

      case 'set_home_tab':
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

      case 'clear_home_tab':
        settings.homeTabId = null;
        settings.homeWindowId = null;
        await saveSettings();
        sendResponse({ ok: true });
        break;

      case 'execute_done_focus':
        if (message.taskId === currentTaskId || !currentTaskId) {
          const success = await focusHomeTab();
          if (success) {
            lastDoneFocusTime = Date.now();
          }
          sendResponse({ ok: success });
        } else {
          sendResponse({ ok: false, error: 'Task mismatch' });
        }
        break;

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
