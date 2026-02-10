import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from '@/i18n/TranslationContext';
import { useTheme } from '@/theme/useTheme';

type SendState = 'idle' | 'sending' | 'sent' | 'error';

interface HeaderProps {
  connected: boolean;
}

export function Header({ connected }: HeaderProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [sendState, setSendState] = useState<SendState>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleSendContext = useCallback(async () => {
    if (sendState === 'sending') return;

    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    setSendState('sending');
    try {
      // Get current tab URL to request only that origin's permission
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) {
        setSendState('error');
        timerRef.current = setTimeout(() => setSendState('idle'), 3000);
        return;
      }

      // Request host permission for just the current tab's host
      // Chrome match patterns don't support port numbers, so use *://<hostname>/*
      let origin: string;
      try {
        const parsed = new URL(tab.url);
        origin = `*://${parsed.hostname}/*`;
      } catch {
        setSendState('error');
        timerRef.current = setTimeout(() => setSendState('idle'), 3000);
        return;
      }

      const granted = await chrome.permissions.request({
        origins: [origin],
      });
      if (!granted) {
        setSendState('error');
        timerRef.current = setTimeout(() => setSendState('idle'), 3000);
        return;
      }

      const response = await chrome.runtime.sendMessage({ type: 'capture_and_send' });
      if (response?.ok) {
        setSendState('sent');
        timerRef.current = setTimeout(() => setSendState('idle'), 2000);
      } else {
        setSendState('error');
        timerRef.current = setTimeout(() => setSendState('idle'), 3000);
      }
    } catch {
      setSendState('error');
      timerRef.current = setTimeout(() => setSendState('idle'), 3000);
    }
  }, [sendState]);

  return (
    <header className="relative overflow-hidden header-glass">
      {/* Noren Style Header */}
      <div className="noren-refined px-4 py-4">
        {/* Noren flaps - 3 flaps, compact */}
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
            {/* Sushi character status indicator */}
            <div className="status-orb-container">
              <div className={`
                status-orb overflow-hidden !w-14 !h-14
                ${connected ? 'status-orb-connected' : 'status-orb-offline'}
              `}>
                <img
                  src={theme === 'dark' ? '/assets/sushi_jiro.png' : '/assets/sushi_taro.png'}
                  alt={theme === 'dark' ? 'Sushi Jiro' : 'Sushi Taro'}
                  className={`w-12 h-12 object-contain ${connected ? 'sushi-wobble' : 'grayscale opacity-50'}`}
                />
              </div>
              {connected && (
                <div className="status-pulse-ring" />
              )}
            </div>

            <div className="flex flex-col">
              <span className={`text-[11px] font-medium ${connected ? 'text-green-300' : 'text-white/50'}`}>
                {connected ? t('header.connected') : t('header.offline')}
              </span>
              <span className="header-title">
                {t('header.daemonName')}
              </span>
            </div>
          </div>

          {/* Send to Claude button */}
          {connected && (
            <button
              onClick={handleSendContext}
              disabled={sendState === 'sending'}
              className={`
                send-context-btn
                ${sendState === 'idle' ? 'send-context-idle' : ''}
                ${sendState === 'sending' ? 'send-context-sending' : ''}
                ${sendState === 'sent' ? 'send-context-sent' : ''}
                ${sendState === 'error' ? 'send-context-error' : ''}
              `}
              title={t('header.sendToClaude')}
            >
              {sendState === 'idle' && (
                <>
                  <span className="send-context-icon">📤</span>
                  {t('header.sendToClaude')}
                </>
              )}
              {sendState === 'sending' && (
                <>
                  <span className="send-context-spinner" />
                  {t('header.sending')}
                </>
              )}
              {sendState === 'sent' && (
                <>
                  <span className="send-context-icon">✅</span>
                  {t('header.sent')}
                </>
              )}
              {sendState === 'error' && (
                <>
                  <span className="send-context-icon">❌</span>
                  {t('header.sendError')}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Wood counter */}
      <div className="wood-counter-refined" />
    </header>
  );
}
