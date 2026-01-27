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

export function TerminalOutput({ logs }: TerminalOutputProps) {
  if (logs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 p-4">
        <div className="text-center">
          <div className="text-4xl mb-2">🎯</div>
          <p>Ready to focus</p>
          <p className="text-sm mt-1">Enter a prompt or select a preset to start</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 font-mono text-sm bg-focus-bg">
      {logs.map((log, index) => (
        <div key={index} className={`log-entry ${log.level} flex gap-2 py-0.5`}>
          <span className="text-gray-600 select-none">{formatTime(log.ts)}</span>
          <span className="flex-1 break-all">{log.message}</span>
        </div>
      ))}
    </div>
  );
}
