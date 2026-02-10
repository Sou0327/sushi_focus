import { useState, useEffect } from 'react';
import { useTranslation } from '@/i18n/TranslationContext';
import { useTheme } from '@/theme/useTheme';
import { SushiTaro } from '@/shared/components/SushiTaro';
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

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  const isRunning = taskStatus === 'running' || taskStatus === 'waiting_input';

  return (
    <div className="w-[340px] bg-sushi-bg font-display overflow-hidden relative">
      {/* Header */}
      <div className="noren px-5 py-4 relative">
        <div className="absolute bottom-0 left-0 right-0 flex justify-around pointer-events-none">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="noren-flap-refined"
              style={{ animationDelay: `${i * 0.3}s` }}
            />
          ))}
        </div>

        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className={`
              w-12 h-12 rounded-full flex items-center justify-center overflow-hidden
              ${connected
                ? 'bg-sushi-wasabi/20 shadow-[0_0_8px_rgba(124,179,66,0.3)]'
                : 'bg-sushi-tuna/20 grayscale opacity-60'
              }
            `}>
              <img
                src={theme === 'dark' ? '/assets/sushi_jiro.png' : '/assets/sushi_taro.png'}
                alt={theme === 'dark' ? 'Sushi Jiro' : 'Sushi Taro'}
                className={`w-10 h-10 object-contain ${connected ? 'hover-spin cursor-pointer' : ''}`}
              />
            </div>
            <div>
              <div className="text-lg font-bold text-white">
                {t('common.sushiFocus')}
              </div>
              <div className={`text-[11px] font-medium ${connected ? 'text-green-300' : 'text-white/50'}`}>
                {enabled ? t('popup.active') : t('popup.paused')}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-black/20 hover:bg-black/30 transition-colors"
              title={t(`theme.${theme === 'dark' ? 'light' : 'dark'}`)}
            >
              <span className="text-lg">{theme === 'dark' ? '☀️' : '🌙'}</span>
            </button>

            <button
              onClick={toggleEnabled}
              className={`
                relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full
                border transition-colors
                ${enabled
                  ? 'bg-sushi-wasabi border-sushi-wasabi/50'
                  : 'bg-white/20 border-white/20'
                }
              `}
            >
              <span
                className={`
                  pointer-events-none inline-block h-5 w-5 transform rounded-full
                  bg-white shadow transition-transform mt-0.5
                  ${enabled ? 'translate-x-5' : 'translate-x-0.5'}
                `}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Wood counter edge */}
      <div className="h-1 bg-gradient-to-r from-sushi-woodDark via-sushi-wood to-sushi-woodDark" />

      {/* Status */}
      <div className="p-4 relative z-10">
        <div className="sushi-geta p-4">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-sushi-border">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              {t('popup.status')}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-sushi-wasabi' : 'bg-sushi-tuna'}`} />
              <span className="text-[10px] font-medium text-muted">
                {connected ? t('popup.daemonConnected') : t('popup.daemonOffline')}
              </span>
            </div>
          </div>

          {isRunning ? (
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <SushiTaro size="xl" className="spinning-sushi" theme={theme} />
                {taskStatus === 'waiting_input' && (
                  <span className="absolute -top-1 -right-1 notification-badge">!</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-sushi-salmon truncate mb-0.5">
                  {t('popup.agentPrefix')} {taskName || t('popup.activeTaskFallback')}
                </div>
                <div className="text-xs text-muted flex items-center gap-2">
                  <span className="text-sushi-wasabi text-xs font-medium">{t('popup.activeTask')}</span>
                  {taskElapsed && (
                    <>
                      <span className="text-dim">·</span>
                      <span className="font-mono">{taskElapsed}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-3xl shrink-0">
                {taskStatus === 'done' ? '✅' : taskStatus === 'error' ? '❌' : '🍵'}
              </span>
              <div className="min-w-0">
                <div className={`text-sm font-semibold ${
                  taskStatus === 'done' ? 'text-sushi-wasabi' :
                  taskStatus === 'error' ? 'text-sushi-tuna' :
                  'text-subtle'
                }`}>
                  {taskStatus === 'done' ? t('popup.taskComplete') :
                   taskStatus === 'error' ? t('popup.taskError') :
                   t('popup.noActiveTask')}
                </div>
                <div className="text-xs text-muted">
                  {taskStatus === 'idle' && (connected ? t('terminal.ready') : t('popup.daemonOffline'))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 pb-4 relative z-10">
        <button
          onClick={openSidePanel}
          className="w-full flex items-center justify-between group py-3 px-4 bg-sushi-surface border border-sushi-border rounded-lg hover:bg-sushi-border/50 transition-colors"
        >
          <span className="text-sm font-medium text-heading">
            {t('popup.openSidePanel')}
          </span>
          <span className="text-muted group-hover:text-heading group-hover:translate-x-1 transition-all">→</span>
        </button>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4 pt-2 border-t border-sushi-border relative z-10">
        <button
          onClick={openOptions}
          className="flex items-center justify-between w-full py-2 group"
        >
          <span className="text-sm text-muted group-hover:text-subtle transition-colors">
            {t('common.settings')}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-dim font-mono px-2 py-0.5 bg-sushi-surface rounded border border-sushi-border">
              v{chrome.runtime.getManifest().version}
            </span>
            <span className="text-muted group-hover:text-subtle group-hover:translate-x-1 transition-all">→</span>
          </div>
        </button>
      </div>
    </div>
  );
}
