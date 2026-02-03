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

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  const isRunning = taskStatus === 'running' || taskStatus === 'waiting_input';

  return (
    <div className="w-[340px] bg-focus-bg font-display overflow-hidden relative">
      {/* 🍣 浮遊する寿司背景 */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {['🍣', '🍱', '🍙', '🥢'].map((emoji, i) => (
          <span
            key={i}
            className="sushi-particle text-xl"
            style={{
              left: `${i * 25 + 10}%`,
              top: `${(i * 20) % 80}%`,
              animationDelay: `${i * 0.7}s`,
            }}
          >
            {emoji}
          </span>
        ))}
      </div>

      {/* 🏮 暖簾ヘッダー */}
      <div className="noren px-5 py-5 relative">
        {/* 暖簾の垂れ */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-around">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="noren-flap w-5 h-3"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>

        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4">
            {/* 提灯風ロゴ */}
            <div className="lantern">
              <div className={`
                w-12 h-12 rounded-full flex items-center justify-center text-3xl
                ${connected
                  ? 'bg-gradient-to-br from-sushi-wasabi/40 to-sushi-wasabiDark/40'
                  : 'bg-gradient-to-br from-sushi-tuna/40 to-sushi-tunaDeep/40'
                }
              `}>
                <span className={connected ? 'hover-spin cursor-pointer' : ''}>
                  {connected ? '🍣' : '🚫'}
                </span>
              </div>
            </div>
            <div>
              <div className="text-xl font-black text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.3)]">
                {t('common.focusFlow')}
              </div>
              <div className={`text-xs font-black tracking-widest uppercase ${connected ? 'neon-text-wasabi' : 'text-sushi-ginger'}`}>
                {enabled ? t('popup.active') : t('popup.paused')}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* テーマ切替 - 醤油/シャリ */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-black/20 hover:bg-black/30 transition-all duration-200 hover:scale-110 click-bounce"
              title={t(`theme.${theme === 'dark' ? 'light' : 'dark'}`)}
            >
              <span className="text-xl">{theme === 'dark' ? '🍚' : '🫘'}</span>
            </button>

            {/* 有効/無効トグル - 寿司プレート風 */}
            <button
              onClick={toggleEnabled}
              className={`
                relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer rounded-full
                border-2 transition-all duration-300 click-bounce
                ${enabled
                  ? 'bg-gradient-to-r from-sushi-wasabi to-sushi-wasabiDark border-sushi-wasabi/50'
                  : 'bg-sushi-wood/50 border-sushi-wood/30'
                }
              `}
            >
              <span
                className={`
                  pointer-events-none inline-block h-5 w-5 transform rounded-full
                  bg-white shadow-lg transition-all duration-300 mt-0.5
                  ${enabled ? 'translate-x-7' : 'translate-x-0.5'}
                `}
              >
                <span className="flex items-center justify-center h-full text-xs">
                  {enabled ? '🍣' : '💤'}
                </span>
              </span>
            </button>
          </div>
        </div>

        {/* 🏮 提灯デコレーション */}
        <div className="absolute top-2 right-3 flex gap-2">
          {['🏮'].map((lantern, i) => (
            <span
              key={i}
              className="text-xl lantern opacity-70"
              style={{ animationDelay: `${i * 0.3}s` }}
            >
              {lantern}
            </span>
          ))}
        </div>
      </div>

      {/* 木のカウンター縁 */}
      <div className="wood-counter h-3" />

      {/* 🍱 ステータス表示 - 注文票風 */}
      <div className="p-5 relative z-10">
        <div className="sushi-geta p-5">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b-2 border-dashed border-focus-border">
            <span className="text-lg">📋</span>
            <span className="text-xs font-black text-muted uppercase tracking-[0.15em]">
              {t('popup.status')}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${connected ? 'bg-sushi-wasabi animate-pulse' : 'bg-sushi-tuna'}`} />
              <span className="text-[10px] font-bold text-muted uppercase">
                {connected ? t('popup.daemonConnected') : t('popup.daemonOffline')}
              </span>
            </div>
          </div>

          {isRunning ? (
            <div className="flex items-center gap-4">
              <div className="relative">
                <span className="text-4xl spinning-sushi inline-block">🍣</span>
                {taskStatus === 'waiting_input' && (
                  <span className="absolute -top-1 -right-1 notification-badge">❗</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-black text-sushi-salmon truncate mb-1">
                  {t('popup.agentPrefix')} {taskName || t('popup.activeTaskFallback')}
                </div>
                <div className="text-xs text-muted flex items-center gap-2">
                  <span className="neon-text-wasabi text-xs">{t('popup.activeTask')}</span>
                  {taskElapsed && (
                    <>
                      <span className="text-dim">·</span>
                      <span className="font-mono font-bold">{taskElapsed}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <span className="text-4xl">
                {taskStatus === 'done' ? (
                  <span className="celebrate inline-block">✅</span>
                ) : taskStatus === 'error' ? (
                  <span className="inline-block animate-pulse">❌</span>
                ) : (
                  <span className="steam-container inline-block">
                    🍵
                    <span className="steam">〜</span>
                    <span className="steam">〜</span>
                  </span>
                )}
              </span>
              <div className="min-w-0">
                <div className={`text-sm font-black ${
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

      {/* 🥢 クイックアクション */}
      <div className="px-5 pb-5 relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🥢</span>
          <span className="text-[10px] text-muted uppercase tracking-[0.15em] font-black">
            {t('popup.quickActions')}
          </span>
        </div>

        <button
          onClick={openSidePanel}
          className="w-full btn-secondary flex items-center justify-between group mb-3 py-3"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl group-hover:animate-pulse">🍱</span>
            <span className="text-sm font-black">
              {t('popup.openSidePanel')}
            </span>
          </div>
          <span className="text-muted group-hover:text-heading group-hover:translate-x-1 transition-all">→</span>
        </button>
      </div>

      {/* 🍵 フッター - 木札風 */}
      <div className="px-5 pb-5 pt-3 border-t-2 border-dashed border-focus-border relative z-10">
        <button
          onClick={openOptions}
          className="flex items-center justify-between w-full py-2 group"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl group-hover:hover-spin">📜</span>
            <span className="text-sm font-bold text-muted group-hover:text-subtle transition-colors">
              {t('common.settings')}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-dim font-mono px-2 py-1 bg-focus-surface rounded-lg border border-focus-border">
              v0.1.0
            </span>
            <span className="text-muted group-hover:text-subtle group-hover:translate-x-1 transition-all">→</span>
          </div>
        </button>
      </div>
    </div>
  );
}
