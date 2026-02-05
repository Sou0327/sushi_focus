import { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/i18n/TranslationContext';
import { SushiTaro } from '@/shared/components/SushiTaro';
import type { TaskLog, Theme } from '@/shared/types';
import { isAIMessage, isUserPrompt, isSuccessMessage } from '@/utils/logMessageUtils';

// Extended TaskLog with optional task identification
interface ExtendedTaskLog extends TaskLog {
  taskId?: string;
  taskPrompt?: string;
}

interface TerminalOutputProps {
  logs: ExtendedTaskLog[];
  theme: Theme;
  showTaskId?: boolean;
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
      return { labelColor: 'text-sushi-salmon', label: '注文', isCommand: false, isAI: false };
    case 'warn':
      return { labelColor: 'text-sushi-warning', label: '確認', isCommand: false, isAI: false };
    case 'error':
      return { labelColor: 'text-sushi-tuna', label: '問題', isCommand: false, isAI: false };
    case 'debug':
      return { labelColor: 'text-muted', label: 'メモ', isCommand: false, isAI: false };
    default:
      return { labelColor: 'text-muted', label: level.toUpperCase(), isCommand: false, isAI: false };
  }
}

// Generate a short task badge from taskId
function getTaskBadge(taskId: string | undefined): string {
  if (!taskId) return '';
  // Use first 4 characters of taskId for a short identifier
  return taskId.slice(0, 4).toUpperCase();
}

// Color palette for task badges
const TASK_COLORS = [
  'bg-blue-500/20 text-blue-400 border-blue-500/40',
  'bg-purple-500/20 text-purple-400 border-purple-500/40',
  'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
  'bg-pink-500/20 text-pink-400 border-pink-500/40',
  'bg-orange-500/20 text-orange-400 border-orange-500/40',
];

function getTaskColor(taskId: string | undefined): string {
  if (!taskId) return TASK_COLORS[0];
  // Hash taskId to get consistent color
  const hash = taskId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return TASK_COLORS[hash % TASK_COLORS.length];
}

export function TerminalOutput({ logs, theme, showTaskId = false }: TerminalOutputProps) {
  const { t } = useTranslation();
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Update current time every second for the blinking cursor timestamp
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom when logs change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (logs.length === 0) {
    return (
      <div className="flex-1 mx-3 mb-3 terminal-container overflow-hidden flex flex-col">
        {/* 注文票ヘッダー - クリーンで視認性高く */}
        <div className="terminal-header">
          <div className="flex items-center gap-2">
            <span className="text-lg">📋</span>
            <span className="terminal-header-title">{t('terminal.title')}</span>
          </div>
        </div>

        {/* 待機状態 - エレガントに */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center idle-state">
            {/* 寿司太郎 - サイズ調整 */}
            <div className="relative mb-4 inline-block">
              <SushiTaro size="2xl" className="sushi-float" theme={theme} />
              <span className="sparkle-dot sparkle-dot-1">✨</span>
              <span className="sparkle-dot sparkle-dot-2">✨</span>
            </div>

            <p className="text-lg font-bold text-heading mb-1">{t('terminal.ready')}</p>
            <p className="text-xs text-muted">{t('terminal.readyHint')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 mx-4 mb-4 sushi-geta overflow-hidden flex flex-col">
      {/* 注文票ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3 border-b-2 border-dashed border-sushi-border bg-gradient-to-r from-sushi-surface/80 via-sushi-surface to-sushi-surface/80">
        <div className="flex items-center gap-3">
          <span className="text-xl">📋</span>
          <span className="text-sm font-black text-heading tracking-wider">{t('terminal.title')}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sushi-salmon text-lg animate-pulse">🔥</span>
          <span className="text-xs font-mono font-bold px-3 py-1 bg-sushi-salmon/20 rounded-full text-sushi-salmon border border-sushi-salmon/30">
            {logs.length} 件
          </span>
        </div>
      </div>

      {/* ログエントリ - 伝票スタイル */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-3">
        {logs.map((log, index) => {
          const style = getLogStyle(log.level, log.message);
          const ai = isAIMessage(log.message);
          const user = isUserPrompt(log.message);
          const success = isSuccessMessage(log.message);

          // Task badge component (only shown when multiple tasks)
          const taskBadge = showTaskId && log.taskId ? (
            <span
              className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${getTaskColor(log.taskId)}`}
              title={log.taskPrompt || log.taskId}
            >
              {getTaskBadge(log.taskId)}
            </span>
          ) : null;

          if (style.isCommand) {
            return (
              <div
                key={index}
                className="group flex gap-3 py-3 px-4 bg-gradient-to-r from-sushi-wood/20 to-transparent rounded-xl border-l-4 border-sushi-wood hover:bg-sushi-wood/30 transition-all duration-200 hover:scale-[1.01]"
              >
                <span className="text-muted select-none shrink-0 text-xs font-bold">{formatTime(log.ts)}</span>
                {taskBadge}
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-lg">💻</span>
                  <span className="text-heading font-bold">{log.message}</span>
                </div>
              </div>
            );
          }

          if (user) {
            return (
              <div
                key={index}
                className="group py-3 px-4 bg-gradient-to-r from-sushi-wasabi/15 to-sushi-wasabi/5 rounded-xl border-l-4 border-sushi-wasabi hover:from-sushi-wasabi/25 hover:to-sushi-wasabi/10 transition-all duration-200 hover:scale-[1.01]"
              >
                <div className="flex gap-3 items-start">
                  <span className="text-muted select-none shrink-0 text-xs font-bold">{formatTime(log.ts)}</span>
                  {taskBadge}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">👤</span>
                      <span className="text-sushi-wasabi font-black text-xs px-3 py-1 bg-sushi-wasabi/20 rounded-full border border-sushi-wasabi/40 uppercase tracking-wider">
                        お客様
                      </span>
                    </div>
                    <span className="text-sushi-wasabi font-medium block mt-1">{log.message.replace('[USER] ', '')}</span>
                  </div>
                </div>
              </div>
            );
          }

          if (ai) {
            return (
              <div
                key={index}
                className="group py-3 px-4 bg-gradient-to-r from-sushi-salmon/15 to-sushi-salmon/5 rounded-xl border-l-4 border-sushi-salmon hover:from-sushi-salmon/25 hover:to-sushi-salmon/10 transition-all duration-200 hover:scale-[1.01]"
              >
                <div className="flex gap-3 items-start">
                  <span className="text-muted select-none shrink-0 text-xs font-bold">{formatTime(log.ts)}</span>
                  {taskBadge}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <SushiTaro size="md" className="hover-spin cursor-pointer" theme={theme} />
                      <span className="text-sushi-salmon font-black text-xs px-3 py-1 bg-sushi-salmon/20 rounded-full border border-sushi-salmon/40 uppercase tracking-wider">
                        板前
                      </span>
                      <span className="text-xs text-sushi-salmon/60">握り中...</span>
                    </div>
                    <span className="text-subtle font-medium block mt-1">{log.message.replace('[AI] ', '')}</span>
                  </div>
                </div>
              </div>
            );
          }

          if (success) {
            return (
              <div
                key={index}
                className="group py-3 px-4 bg-gradient-to-r from-sushi-wasabi/20 to-sushi-wasabi/5 rounded-xl border-l-4 border-sushi-wasabi hover:from-sushi-wasabi/30 hover:to-sushi-wasabi/10 transition-all duration-200 hover:scale-[1.02]"
              >
                <div className="flex gap-3 items-center">
                  <span className="text-muted select-none shrink-0 text-xs font-bold">{formatTime(log.ts)}</span>
                  {taskBadge}
                  <div className="flex-1 flex items-center gap-3">
                    <span className="text-2xl celebrate">🎉</span>
                    <div>
                      <span className="text-sushi-wasabi font-black text-xs px-3 py-1 bg-sushi-wasabi/30 rounded-full border border-sushi-wasabi/50 uppercase tracking-wider">
                        ✅ 完了！
                      </span>
                      <span className="text-sushi-wasabi font-bold block mt-1">{log.message}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={index}
              className="group flex gap-3 py-2 px-4 bg-sushi-surface/50 rounded-xl border-l-4 border-sushi-border hover:bg-sushi-surface/80 transition-all duration-200"
            >
              <span className="text-muted select-none shrink-0 text-xs">{formatTime(log.ts)}</span>
              {taskBadge}
              <div className="flex-1 flex gap-2 items-start">
                <span className={`font-bold text-xs px-2 py-0.5 rounded-full ${style.labelColor} bg-sushi-surface/80 border border-sushi-border`}>
                  {style.label}
                </span>
                <span className="text-subtle break-all">{log.message}</span>
              </div>
            </div>
          );
        })}

        {/* Blinking cursor - 箸置き風 */}
        <div className="flex gap-3 py-3 px-4 items-center">
          <span className="text-muted select-none shrink-0 text-xs font-bold">{formatTime(currentTime)}</span>
          <div className="flex items-center gap-2">
            <span className="text-sushi-salmon text-xl animate-pulse">🥢</span>
            <div className="flex gap-0.5">
              <span className="w-3 h-5 bg-sushi-salmon/80 rounded-sm animate-cursor-blink" />
              <span className="w-1 h-5 bg-sushi-salmon/40 rounded-sm animate-cursor-blink" style={{ animationDelay: '0.1s' }} />
            </div>
            <span className="text-xs text-muted italic">お次のご注文をどうぞ...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
