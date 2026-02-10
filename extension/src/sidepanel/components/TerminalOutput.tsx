import { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/i18n/TranslationContext';
import { SushiTaro } from '@/shared/components/SushiTaro';
import type { TaskLog, Theme } from '@/shared/types';
import { isAIMessage, isUserPrompt, isSuccessMessage } from '@/utils/logMessageUtils';

interface TerminalOutputProps {
  logs: TaskLog[];
  theme: Theme;
}

function formatTime(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getLogStyle(level: string, message: string) {
  if (message.startsWith('$') || message.startsWith('>')) {
    return { labelColor: '', labelKey: '', isCommand: true, isAI: false };
  }
  switch (level) {
    case 'info':
      return { labelColor: 'text-sushi-salmon', labelKey: 'terminal.logLevel.info', isCommand: false, isAI: false };
    case 'warn':
      return { labelColor: 'text-sushi-warning', labelKey: 'terminal.logLevel.warn', isCommand: false, isAI: false };
    case 'error':
      return { labelColor: 'text-sushi-tuna', labelKey: 'terminal.logLevel.error', isCommand: false, isAI: false };
    case 'debug':
      return { labelColor: 'text-muted', labelKey: 'terminal.logLevel.debug', isCommand: false, isAI: false };
    case 'success':
      return { labelColor: 'text-sushi-wasabi', labelKey: 'terminal.logLevel.success', isCommand: false, isAI: false };
    case 'focus':
      return { labelColor: 'text-sushi-salmon', labelKey: 'terminal.logLevel.focus', isCommand: false, isAI: false };
    case 'command':
      return { labelColor: '', labelKey: '', isCommand: true, isAI: false };
    default:
      return { labelColor: 'text-muted', labelKey: '', isCommand: false, isAI: false };
  }
}

export function TerminalOutput({ logs, theme }: TerminalOutputProps) {
  const { t } = useTranslation();
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (logs.length === 0) {
    return (
      <div className="flex-1 mx-3 mb-3 terminal-container overflow-hidden flex flex-col">
        <div className="terminal-header">
          <span className="terminal-header-title">{t('terminal.title')}</span>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center idle-state">
            <div className="relative mb-4 inline-block">
              <SushiTaro size="2xl" className="sushi-float" theme={theme} />
            </div>

            <p className="text-base font-semibold text-heading mb-1">{t('terminal.ready')}</p>
            <p className="text-xs text-muted">{t('terminal.readyHint')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 mx-3 mb-3 sushi-geta overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-sushi-border">
        <span className="text-sm font-semibold text-heading">{t('terminal.title')}</span>
        <span className="text-xs font-mono text-muted">
          {t('terminal.itemCount').replace('{count}', String(logs.length))}
        </span>
      </div>

      {/* Log entries */}
      <div ref={scrollRef} role="log" aria-live="polite" className="flex-1 overflow-y-auto p-3 font-mono text-sm space-y-0.5">
        {logs.map((log, index) => {
          const style = getLogStyle(log.level, log.message);
          const ai = isAIMessage(log.message);
          const user = isUserPrompt(log.message);
          const success = isSuccessMessage(log.message);

          const displayMessage = log.messageKey
            ? t(log.messageKey, log.messageParams)
            : log.message;

          if (log.level === 'command' || style.isCommand) {
            return (
              <div
                key={index}
                className="log-entry-appear flex gap-2 py-1.5 px-3 border-l-2 border-sushi-wood/60 hover:bg-sushi-surface/60 transition-colors rounded-r-md"
              >
                <span className="text-[10px] text-muted select-none shrink-0 tabular-nums leading-[20px]">{formatTime(log.ts)}</span>
                <span className="text-heading font-medium text-[13px] leading-[20px]">{displayMessage}</span>
              </div>
            );
          }

          if (log.level === 'focus') {
            return (
              <div
                key={index}
                className="log-entry-appear flex gap-2 py-1.5 px-3 border-l-2 border-sushi-salmon hover:bg-sushi-salmon/5 transition-colors rounded-r-md"
              >
                <span className="text-[10px] text-muted select-none shrink-0 tabular-nums leading-[20px]">{formatTime(log.ts)}</span>
                <span className="text-[11px] font-medium text-sushi-salmon/80 shrink-0 leading-[20px]">{t('terminal.logLevel.focus')}</span>
                <span className="text-sushi-salmon text-[13px] leading-[20px] break-all">{displayMessage}</span>
              </div>
            );
          }

          if (user) {
            return (
              <div
                key={index}
                className="log-entry-appear flex gap-2 py-1.5 px-3 border-l-2 border-sushi-wasabi hover:bg-sushi-wasabi/5 transition-colors rounded-r-md"
              >
                <span className="text-[10px] text-muted select-none shrink-0 tabular-nums leading-[20px]">{formatTime(log.ts)}</span>
                <span className="text-[11px] font-medium text-sushi-wasabi/80 shrink-0 leading-[20px]">{t('terminal.badge.customer')}</span>
                <span className="text-sushi-wasabi text-[13px] leading-[20px] break-all">{displayMessage.replace('[USER] ', '')}</span>
              </div>
            );
          }

          if (ai) {
            return (
              <div
                key={index}
                className="log-entry-appear flex gap-2 py-1.5 px-3 border-l-2 border-sushi-salmon hover:bg-sushi-salmon/5 transition-colors rounded-r-md items-start"
              >
                <span className="text-[10px] text-muted select-none shrink-0 tabular-nums leading-[20px]">{formatTime(log.ts)}</span>
                <SushiTaro size="sm" className="shrink-0 mt-0.5" theme={theme} />
                <span className="text-[11px] font-medium text-sushi-salmon/80 shrink-0 leading-[20px]">{t('terminal.badge.chef')}</span>
                <span className="text-subtle text-[13px] leading-[20px] break-all">{displayMessage.replace('[AI] ', '')}</span>
              </div>
            );
          }

          if (log.level === 'success' || success) {
            return (
              <div
                key={index}
                className="log-entry-appear flex gap-2 py-1.5 px-3 border-l-2 border-sushi-wasabi bg-sushi-wasabi/8 hover:bg-sushi-wasabi/12 transition-colors rounded-r-md items-center"
              >
                <span className="text-[10px] text-muted select-none shrink-0 tabular-nums leading-[20px]">{formatTime(log.ts)}</span>
                <span className="text-base celebrate shrink-0">🎉</span>
                <span className="text-[11px] font-medium text-sushi-wasabi shrink-0 leading-[20px]">{t('terminal.badge.successDone')}</span>
                <span className="text-sushi-wasabi text-[13px] leading-[20px] break-all">{displayMessage}</span>
              </div>
            );
          }

          return (
            <div
              key={index}
              className="log-entry-appear flex gap-2 py-1.5 px-3 border-l-2 border-sushi-border hover:bg-sushi-surface/60 transition-colors rounded-r-md"
            >
              <span className="text-[10px] text-muted select-none shrink-0 tabular-nums leading-[20px]">{formatTime(log.ts)}</span>
              <span className={`text-[11px] font-medium shrink-0 leading-[20px] ${style.labelColor}`}>
                {style.labelKey ? t(style.labelKey) : log.level.toUpperCase()}
              </span>
              <span className="text-subtle text-[13px] break-all leading-[20px]">{displayMessage}</span>
            </div>
          );
        })}

        {/* Blinking cursor */}
        <div className="flex gap-2 py-1.5 px-3 items-center">
          <span className="text-[10px] text-muted select-none shrink-0 tabular-nums">{formatTime(currentTime)}</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-4 bg-sushi-salmon/70 rounded-sm animate-cursor-blink" />
            <span className="text-[11px] text-muted">{t('terminal.nextOrder')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
