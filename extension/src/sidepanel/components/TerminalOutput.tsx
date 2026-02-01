import { useTranslation } from '@/i18n/TranslationContext';
import type { TaskLog } from '@/shared/types';

interface TerminalOutputProps {
  logs: TaskLog[];
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
    return { labelColor: '', label: '', isCommand: true, isAI: false };
  }
  switch (level) {
    case 'info':
      return { labelColor: 'text-blue-400', label: 'INFO', isCommand: false, isAI: false };
    case 'warn':
      return { labelColor: 'text-amber-400', label: 'WARN', isCommand: false, isAI: false };
    case 'error':
      return { labelColor: 'text-red-400', label: 'ERROR', isCommand: false, isAI: false };
    case 'debug':
      return { labelColor: 'text-muted', label: 'DEBUG', isCommand: false, isAI: false };
    default:
      return { labelColor: 'text-muted', label: level.toUpperCase(), isCommand: false, isAI: false };
  }
}

function isAIMessage(message: string): boolean {
  return message.includes('[AI]') || message.includes('Analyzing') || message.includes('Identified');
}

function isSuccessMessage(message: string): boolean {
  return message.includes('passed') || message.includes('success') || message.startsWith('✅');
}

export function TerminalOutput({ logs }: TerminalOutputProps) {
  const { t } = useTranslation();

  if (logs.length === 0) {
    return (
      <div className="flex-1 mx-4 mb-4 bg-terminal-bg border border-focus-border rounded-xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-focus-border">
          <span className="text-[10px] font-mono text-text-secondary tracking-widest uppercase">{t('terminal.title')}</span>
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500/60" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <span className="w-3 h-3 rounded-full bg-green-500/60" />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center text-text-secondary p-8">
          <div className="text-center font-mono text-sm">
            <p className="mb-1">{t('terminal.ready')}</p>
            <p className="text-xs text-dim">{t('terminal.readyHint')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 mx-4 mb-4 bg-terminal-bg border border-focus-border rounded-xl overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-focus-border">
        <span className="text-[10px] font-mono text-text-secondary tracking-widest uppercase">{t('terminal.title')}</span>
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500/60" />
          <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
          <span className="w-3 h-3 rounded-full bg-green-500/60" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-3">
        {logs.map((log, index) => {
          const style = getLogStyle(log.level, log.message);
          const ai = isAIMessage(log.message);
          const success = isSuccessMessage(log.message);

          if (style.isCommand) {
            return (
              <div key={index} className="group flex gap-3 py-1 hover:bg-white/5 rounded px-2 -mx-2 transition-colors">
                <span className="text-dim select-none shrink-0">[{formatTime(log.ts)}]</span>
                <div className="flex-1">
                  <span className="text-heading font-medium">{log.message}</span>
                </div>
              </div>
            );
          }

          if (ai) {
            return (
              <div key={index} className="group py-1 hover:bg-white/5 rounded px-2 -mx-2 transition-colors">
                <div className="flex gap-3">
                  <span className="text-dim select-none shrink-0">[{formatTime(log.ts)}]</span>
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-purple-400 text-sm animate-pulse">psychology</span>
                    <span className="text-purple-400 font-bold text-xs">AI</span>
                    <span className="text-subtle ml-1">{log.message.replace('[AI] ', '')}</span>
                  </div>
                </div>
                {log.message.includes('Identified') && (
                  <div className="ml-[88px] mt-1 pl-3 border-l-2 border-purple-500/40 text-muted italic text-xs">
                    {log.message}
                  </div>
                )}
              </div>
            );
          }

          return (
            <div key={index} className="group flex gap-3 py-1 hover:bg-white/5 rounded px-2 -mx-2 transition-colors">
              <span className="text-dim select-none shrink-0">[{formatTime(log.ts)}]</span>
              <div className="flex-1 flex gap-2">
                <span className={`font-bold text-xs ${success ? 'text-emerald-400' : style.labelColor}`}>
                  {success ? 'SUCCESS' : style.label}
                </span>
                <span className={`break-all ${success ? 'text-emerald-300' : 'text-subtle'}`}>{log.message}</span>
              </div>
            </div>
          );
        })}
        {/* Blinking cursor */}
        <div className="flex gap-3 py-1 px-2 -mx-2">
          <span className="text-dim select-none shrink-0">[{formatTime(Date.now())}]</span>
          <span className="w-2 h-4 bg-focus-primary animate-cursor-blink" />
        </div>
      </div>
    </div>
  );
}
