import { useState, useEffect } from 'react';
import { useTranslation } from '@/i18n/TranslationContext';
import { useTheme } from '@/theme/useTheme';
import type { TaskStatus, ExtensionSettings, Theme } from '@/shared/types';

function formatElapsed(t: (key: string) => string, startedAt: number): string {
  const seconds = Math.floor((Date.now() - startedAt) / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) {
    return t('popup.elapsedMinutes').replace('{mins}', String(mins)).replace('{secs}', String(secs));
  }
  return t('popup.elapsedSeconds').replace('{secs}', String(secs));
}

export default function App() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [connected, setConnected] = useState(false);
  const [_settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('idle');
  const [taskName, setTaskName] = useState<string | null>(null);
  const [taskElapsed, setTaskElapsed] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [taskStartedAt, setTaskStartedAt] = useState<number | null>(null);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'get_connection_status' }, (response) => {
      if (response?.connected !== undefined) {
        setConnected(response.connected);
      }
    });

    chrome.runtime.sendMessage({ type: 'get_settings' }, (response) => {
      if (response?.settings) {
        setSettings(response.settings);
        if (response.settings.enabled !== undefined) {
          setEnabled(response.settings.enabled);
        }
      }
    });

    chrome.runtime.sendMessage({ type: 'get_task_status' }, (response) => {
      if (response?.status === 'running') {
        setTaskStatus('running');
        setTaskStartedAt(response.startedAt || null);
      }
    });

    const handleMessage = (message: Record<string, unknown>) => {
      if (message.type === 'connection_status') {
        setConnected(message.connected as boolean);
      } else if (message.type === 'task.started') {
        setTaskStatus('running');
        setTaskName((message.prompt as string) || null);
        setTaskStartedAt((message.startedAt as number) || Date.now());
      } else if (message.type === 'task.need_input') {
        setTaskStatus('waiting_input');
      } else if (message.type === 'task.done') {
        setTaskStatus('done');
        setTimeout(() => {
          setTaskStatus('idle');
          setTaskName(null);
          setTaskElapsed(null);
          setTaskStartedAt(null);
        }, 3000);
      } else if (message.type === 'task.error') {
        setTaskStatus('error');
        setTimeout(() => {
          setTaskStatus('idle');
          setTaskName(null);
          setTaskElapsed(null);
          setTaskStartedAt(null);
        }, 3000);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  useEffect(() => {
    if (!taskStartedAt || (taskStatus !== 'running' && taskStatus !== 'waiting_input')) {
      return;
    }

    const updateElapsed = () => {
      setTaskElapsed(formatElapsed(t, taskStartedAt));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => {
      clearInterval(interval);
      setTaskElapsed(null);
    };
  }, [taskStartedAt, taskStatus, t]);

  const toggleEnabled = () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    chrome.runtime.sendMessage({ type: 'update_settings', settings: { enabled: newEnabled } });
  };

  const toggleTheme = () => {
    const newTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    chrome.runtime.sendMessage({ type: 'update_settings', settings: { theme: newTheme } });
  };

  const openSidePanel = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.id) {
        chrome.sidePanel.open({ tabId: tab.id });
      }
    });
  };

  // setTabAsHome - hidden, kept for future use
  // const setTabAsHome = () => { ... };

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  const isRunning = taskStatus === 'running' || taskStatus === 'waiting_input';

  return (
    <div className="w-[300px] bg-focus-bg font-display">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-focus-primary text-xl">
            shield
          </span>
          <span className="font-semibold text-base text-heading">{t('common.focusFlow')}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-1 text-muted hover:text-heading transition-colors rounded-lg"
            title={t(`theme.${theme === 'dark' ? 'light' : 'dark'}`)}
          >
            <span className="material-symbols-outlined text-lg">
              {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
          <span className="text-xs text-muted uppercase tracking-wider">
            {enabled ? t('popup.active') : t('popup.paused')}
          </span>
          <button
            onClick={toggleEnabled}
            className={`
              relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full
              border-2 border-transparent transition-colors duration-200 ease-in-out
              ${enabled ? 'bg-focus-primary' : 'bg-focus-border'}
            `}
          >
            <span
              className={`
                pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full
                bg-white shadow transition duration-200 ease-in-out
                ${enabled ? 'translate-x-4' : 'translate-x-0'}
              `}
            />
          </button>
        </div>
      </div>

      {/* Operating Mode - removed (simplified to single option in settings) */}

      {/* Status */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-muted uppercase tracking-wider font-medium">
            {t('popup.status')}
          </span>
          <span
            className={`w-2 h-2 rounded-full ${
              connected ? 'bg-focus-success' : 'bg-focus-error'
            }`}
          />
        </div>

        <div className="bg-focus-surface border border-focus-border rounded-xl p-3">
          {isRunning ? (
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-focus-primary text-xl">
                smart_toy
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-heading truncate">
                  {t('popup.agentPrefix')} {taskName || t('popup.activeTaskFallback')}
                </div>
                <div className="text-xs text-muted">
                  {t('popup.activeTask')}{taskElapsed ? ` · ${taskElapsed}` : ''}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-muted text-xl">
                {taskStatus === 'done' ? 'check_circle' : taskStatus === 'error' ? 'error' : 'hourglass_empty'}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-subtle">
                  {taskStatus === 'done' ? t('popup.taskComplete') : taskStatus === 'error' ? t('popup.taskError') : t('popup.noActiveTask')}
                </div>
                <div className="text-xs text-muted">
                  {connected ? t('popup.daemonConnected') : t('popup.daemonOffline')}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 pb-3">
        <div className="text-[10px] text-muted uppercase tracking-wider font-medium mb-2">
          {t('popup.quickActions')}
        </div>
        <div className="flex flex-col gap-1.5">
          <button
            onClick={openSidePanel}
            className="flex items-center justify-between w-full bg-focus-surface border border-focus-border rounded-xl px-3 py-2.5 hover:bg-surface-highlight transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-muted text-lg group-hover:text-focus-primary transition-colors">
                side_navigation
              </span>
              <span className="text-sm text-subtle group-hover:text-heading transition-colors">
                {t('popup.openSidePanel')}
              </span>
            </div>
            <span className="material-symbols-outlined text-dim text-base">
              chevron_right
            </span>
          </button>

          {/* Home Tab button hidden - IDE auto-focus is simpler */}
          {/* <button
            onClick={setTabAsHome}
            className="flex items-center justify-between w-full bg-focus-surface border border-focus-border rounded-xl px-3 py-2.5 hover:bg-surface-highlight transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-muted text-lg group-hover:text-focus-primary transition-colors">
                home
              </span>
              <span className="text-sm text-subtle group-hover:text-heading transition-colors">
                {t('popup.setTabAsHome')}
              </span>
            </div>
            <span className="material-symbols-outlined text-dim text-base">
              chevron_right
            </span>
          </button> */}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-3 pt-1 border-t border-focus-border">
        <button
          onClick={openOptions}
          className="flex items-center justify-between w-full py-1.5 group"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-muted text-base group-hover:text-subtle transition-colors">
              settings
            </span>
            <span className="text-sm text-muted group-hover:text-subtle transition-colors">
              {t('common.settings')}
            </span>
          </div>
          <span className="text-xs text-dim">v0.1.0</span>
        </button>
      </div>
    </div>
  );
}
