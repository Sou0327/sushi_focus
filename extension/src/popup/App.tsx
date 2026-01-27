import { useState, useEffect } from 'react';
import type { FocusMode, TaskStatus, ExtensionSettings } from '@/shared/types';

const MODE_LABELS: Record<FocusMode, { label: string; icon: string; desc: string }> = {
  quiet: { label: 'Quiet', icon: '🔇', desc: 'Notifications only' },
  normal: { label: 'Normal', icon: '🔔', desc: 'Notifications + Panel highlight' },
  force: { label: 'Force', icon: '🎯', desc: 'Auto-return to home tab' },
};

const STATUS_LABELS: Record<TaskStatus, { label: string; icon: string }> = {
  idle: { label: 'Idle', icon: '⏸️' },
  running: { label: 'Running', icon: '⚙️' },
  waiting_input: { label: 'Waiting Input', icon: '🟡' },
  done: { label: 'Complete', icon: '✅' },
  error: { label: 'Error', icon: '❌' },
};

export default function App() {
  const [connected, setConnected] = useState(false);
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('idle');

  useEffect(() => {
    // Get connection status
    chrome.runtime.sendMessage({ type: 'get_connection_status' }, (response) => {
      if (response?.connected !== undefined) {
        setConnected(response.connected);
      }
    });

    // Get settings
    chrome.runtime.sendMessage({ type: 'get_settings' }, (response) => {
      if (response?.settings) {
        setSettings(response.settings);
      }
    });

    // Listen for updates
    const handleMessage = (message: any) => {
      if (message.type === 'connection_status') {
        setConnected(message.connected);
      } else if (message.type === 'task.started') {
        setTaskStatus('running');
      } else if (message.type === 'task.need_input') {
        setTaskStatus('waiting_input');
      } else if (message.type === 'task.done') {
        setTaskStatus('done');
        setTimeout(() => setTaskStatus('idle'), 3000);
      } else if (message.type === 'task.error') {
        setTaskStatus('error');
        setTimeout(() => setTaskStatus('idle'), 3000);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  const handleModeChange = (mode: FocusMode) => {
    if (!settings) return;

    const newSettings = { ...settings, mode };
    setSettings(newSettings);

    chrome.runtime.sendMessage({
      type: 'update_settings',
      settings: { mode },
    });
  };

  const openSidePanel = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.id) {
        chrome.sidePanel.open({ tabId: tab.id });
      }
    });
  };

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  const reconnect = () => {
    chrome.runtime.sendMessage({ type: 'reconnect' });
  };

  const currentMode = settings?.mode || 'force';
  const currentStatus = STATUS_LABELS[taskStatus];

  return (
    <div className="w-72 p-4 bg-focus-bg text-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          FocusFlow
        </h1>

        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              connected ? 'bg-focus-success' : 'bg-focus-error'
            }`}
          />
          <span className="text-xs text-gray-400">
            {connected ? 'Connected' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Reconnect Button (if offline) */}
      {!connected && (
        <button
          onClick={reconnect}
          className="w-full mb-4 btn-secondary text-sm"
        >
          🔄 Reconnect to Daemon
        </button>
      )}

      {/* Current Status */}
      <div className="card mb-4">
        <div className="text-xs text-gray-400 mb-1">Current Status</div>
        <div className="flex items-center gap-2">
          <span className="text-xl">{currentStatus.icon}</span>
          <span className={`status-badge ${taskStatus}`}>
            {currentStatus.label}
          </span>
        </div>
      </div>

      {/* Focus Mode Selector */}
      <div className="mb-4">
        <div className="text-xs text-gray-400 mb-2">Focus Mode</div>
        <div className="flex flex-col gap-1">
          {(Object.keys(MODE_LABELS) as FocusMode[]).map((mode) => {
            const info = MODE_LABELS[mode];
            const isActive = currentMode === mode;

            return (
              <button
                key={mode}
                onClick={() => handleModeChange(mode)}
                className={`flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${
                  isActive
                    ? 'bg-focus-primary text-white'
                    : 'bg-focus-surface text-gray-300 hover:bg-gray-700'
                }`}
              >
                <span className="text-lg">{info.icon}</span>
                <div>
                  <div className="text-sm font-medium">{info.label}</div>
                  <div className="text-xs opacity-70">{info.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button onClick={openSidePanel} className="btn-primary flex-1 text-sm">
          📋 Open Panel
        </button>
        <button onClick={openOptions} className="btn-secondary flex-1 text-sm">
          ⚙️ Settings
        </button>
      </div>
    </div>
  );
}
