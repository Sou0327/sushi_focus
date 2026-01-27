import type { TaskStatus } from '@/shared/types';

interface HeaderProps {
  connected: boolean;
  taskStatus: TaskStatus;
  homeTabSet: boolean;
  onSetHomeTab: () => void;
  onClearHomeTab: () => void;
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  idle: 'Idle',
  running: 'Running',
  waiting_input: 'Waiting Input',
  done: 'Complete',
  error: 'Error',
};

export function Header({
  connected,
  taskStatus,
  homeTabSet,
  onSetHomeTab,
  onClearHomeTab,
}: HeaderProps) {
  return (
    <header className="p-3 border-b border-focus-border bg-focus-surface">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          FocusFlow
        </h1>

        <div className="flex items-center gap-2">
          {/* Connection Status */}
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
      </div>

      <div className="flex items-center justify-between">
        {/* Task Status */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Status:</span>
          <span className={`status-badge ${taskStatus}`}>
            {STATUS_LABELS[taskStatus]}
          </span>
        </div>

        {/* Home Tab Button */}
        <div className="flex items-center gap-2">
          {homeTabSet ? (
            <button
              onClick={onClearHomeTab}
              className="text-xs px-2 py-1 rounded bg-focus-surface border border-focus-border text-gray-300 hover:bg-gray-700 flex items-center gap-1"
              title="Clear home tab"
            >
              <span>🏠</span>
              <span>Clear Home</span>
            </button>
          ) : (
            <button
              onClick={onSetHomeTab}
              className="text-xs px-2 py-1 rounded bg-focus-primary text-white hover:bg-blue-600 flex items-center gap-1"
              title="Set this tab as home"
            >
              <span>🏠</span>
              <span>Set as Home</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
