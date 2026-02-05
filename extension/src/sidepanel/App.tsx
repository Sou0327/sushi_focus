import { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
// import { TaskInput } from './components/TaskInput'; // Reserved for future IDE integration
import { TerminalOutput } from './components/TerminalOutput';
import { ActionRequiredModal } from './components/ActionRequiredModal';
import { TaskCompleteModal } from './components/TaskCompleteModal';
import { useTranslation } from '@/i18n/TranslationContext';
import { useTheme } from '@/theme/useTheme';
import type { DaemonEvent, TaskLog, TaskStatus, Choice, ExtensionSettings, BackgroundTaskState } from '@/shared/types';

const DAEMON_API_URL = 'http://127.0.0.1:41593';

// Unique marker for UI-generated synthetic logs (invisible zero-width space)
const SYNTHETIC_LOG_MARKER = '\u200B';

// UI state for each task
interface TaskUIState {
  taskId: string;
  status: TaskStatus;
  prompt: string | null;
  logs: TaskLog[];
  inputQuestion: string | null;
  inputChoices: Choice[];
  progress: { current: number; total: number; label?: string } | null;
  startedAt: number;
  hasSyntheticDoneLog?: boolean; // Track if we've added a synthetic completion log
}

interface AppState {
  connected: boolean;
  tasks: Map<string, TaskUIState>;  // Multi-task management
  doneCountdown: { taskId: string; summary: string; ms: number } | null;
  settings: ExtensionSettings | null;
  gitBranch: string | null;
}

// Get all logs from all tasks, sorted by timestamp
function getAllLogs(tasks: Map<string, TaskUIState>): (TaskLog & { taskId?: string; taskPrompt?: string })[] {
  const showTaskId = tasks.size > 1;
  return Array.from(tasks.values())
    .flatMap(t => t.logs.map(log => ({
      ...log,
      taskId: showTaskId ? t.taskId : undefined,
      taskPrompt: showTaskId ? t.prompt ?? undefined : undefined,
    })))
    .sort((a, b) => a.ts - b.ts);
}

// Get tasks waiting for input, sorted by startedAt
function getPendingInputTasks(tasks: Map<string, TaskUIState>): TaskUIState[] {
  return Array.from(tasks.values())
    .filter(t => t.status === 'waiting_input' && t.inputQuestion)
    .sort((a, b) => a.startedAt - b.startedAt);
}

// Check if any task is active
function hasActiveTasks(tasks: Map<string, TaskUIState>): boolean {
  return Array.from(tasks.values()).some(t => t.status === 'running' || t.status === 'waiting_input');
}

export default function App() {
  const { t: _t } = useTranslation(); // Reserved for future use
  const { theme } = useTheme();
  const [state, setState] = useState<AppState>({
    connected: false,
    tasks: new Map(),
    doneCountdown: null,
    settings: null,
    gitBranch: null,
  });

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Load initial state
  useEffect(() => {
    // Check connection status
    chrome.runtime.sendMessage({ type: 'get_connection_status' }, (response) => {
      if (response) {
        setState(s => ({
          ...s,
          connected: response.connected ?? false,
          gitBranch: response.gitBranch ?? null,
        }));
      }
    });

    // Load settings
    chrome.runtime.sendMessage({ type: 'get_settings' }, (response) => {
      if (response?.settings) {
        setState(s => ({ ...s, settings: response.settings }));
      }
    });

    // Restore task state (logs buffered while side panel was closed)
    chrome.runtime.sendMessage({ type: 'get_task_status' }, (response) => {
      if (response?.tasks && response.tasks.length > 0) {
        // Restore from multi-task array
        const tasksToRemove: string[] = [];
        setState(s => {
          const newTasks = new Map(s.tasks);
          for (const bgTask of response.tasks as BackgroundTaskState[]) {
            const prompt = bgTask.prompt || 'External task';
            const restoredLogs = bgTask.logs?.length
              ? bgTask.logs
              : [{ level: 'info' as const, message: `▶ ${prompt}`, ts: Date.now() }];
            newTasks.set(bgTask.taskId, {
              taskId: bgTask.taskId,
              status: bgTask.status,
              prompt,
              logs: restoredLogs,
              inputQuestion: bgTask.inputQuestion,
              inputChoices: bgTask.inputChoices,
              progress: null,
              startedAt: bgTask.startedAt,
            });
            // Schedule removal for done/error tasks
            if (bgTask.status === 'done' || bgTask.status === 'error') {
              tasksToRemove.push(bgTask.taskId);
            }
          }
          return { ...s, tasks: newTasks };
        });
        // Set removal timers for done/error tasks
        for (const taskId of tasksToRemove) {
          setTimeout(() => {
            setState(s => {
              const newTasks = new Map(s.tasks);
              newTasks.delete(taskId);
              return { ...s, tasks: newTasks };
            });
          }, 5000);
        }
      } else if (response?.taskId) {
        // Backward compatibility with single-task response
        const prompt = response.prompt || 'External task';
        const restoredLogs = response.logs?.length
          ? response.logs
          : [{ level: 'info' as const, message: `▶ ${prompt}`, ts: Date.now() }];
        // Preserve the actual status from response (including 'waiting_input')
        const status = response.status && response.status !== 'idle' ? response.status : 'running';
        setState(s => {
          const newTasks = new Map(s.tasks);
          newTasks.set(response.taskId, {
            taskId: response.taskId,
            status,
            prompt,
            logs: restoredLogs,
            inputQuestion: null,
            inputChoices: [],
            progress: null,
            startedAt: Date.now(),
          });
          return { ...s, tasks: newTasks };
        });
        // Schedule removal for done/error tasks
        if (status === 'done' || status === 'error') {
          setTimeout(() => {
            setState(s => {
              const newTasks = new Map(s.tasks);
              newTasks.delete(response.taskId);
              return { ...s, tasks: newTasks };
            });
          }, 5000);
        }
      }
    });
  }, []);

  // Listen for messages from background
  useEffect(() => {
    const handleMessage = (message: DaemonEvent | Record<string, unknown>) => {
      if (message.type === 'connection_status') {
        setState(s => ({
          ...s,
          connected: message.connected as boolean,
          gitBranch: (message.gitBranch as string | null) ?? s.gitBranch,
        }));
        return;
      }

      if (message.type === 'start_done_countdown') {
        setState(s => ({
          ...s,
          doneCountdown: {
            taskId: message.taskId as string,
            summary: message.summary as string,
            ms: message.countdownMs as number,
          },
        }));
        return;
      }

      if (message.type === 'done_cooldown_active') {
        // Just flash the panel to indicate completion
        document.body.classList.add('animate-pulse-glow');
        setTimeout(() => {
          document.body.classList.remove('animate-pulse-glow');
        }, 2000);
        return;
      }

      // Handle daemon events
      const event = message as DaemonEvent;

      switch (event.type) {
        case 'task.started': {
          const prompt = (event as DaemonEvent & { prompt?: string }).prompt || 'External task';
          setState(s => {
            const newTasks = new Map(s.tasks);
            newTasks.set(event.taskId, {
              taskId: event.taskId,
              status: 'running',
              prompt,
              logs: [{ level: 'info', message: `▶ ${prompt}`, ts: Date.now() }],
              inputQuestion: null,
              inputChoices: [],
              progress: null,
              startedAt: Date.now(),
            });
            return { ...s, tasks: newTasks };
          });
          break;
        }

        case 'task.log':
          setState(s => {
            const newTasks = new Map(s.tasks);
            const task = newTasks.get(event.taskId);
            if (task) {
              newTasks.set(event.taskId, {
                ...task,
                logs: [...task.logs, { level: event.level, message: event.message, ts: Date.now() }],
              });
            } else {
              // Create stub task for unknown taskId (event arrived before task.started)
              newTasks.set(event.taskId, {
                taskId: event.taskId,
                status: 'running',
                prompt: null,
                logs: [{ level: event.level, message: event.message, ts: Date.now() }],
                inputQuestion: null,
                inputChoices: [],
                progress: null,
                startedAt: Date.now(),
              });
            }
            return { ...s, tasks: newTasks };
          });
          break;

        case 'task.need_input':
          setState(s => {
            const newTasks = new Map(s.tasks);
            const task = newTasks.get(event.taskId);
            if (task) {
              newTasks.set(event.taskId, {
                ...task,
                status: 'waiting_input',
                inputQuestion: event.question,
                inputChoices: event.choices,
              });
            } else {
              // Create stub task for unknown taskId (event arrived before task.started)
              newTasks.set(event.taskId, {
                taskId: event.taskId,
                status: 'waiting_input',
                prompt: null,
                logs: [],
                inputQuestion: event.question,
                inputChoices: event.choices,
                progress: null,
                startedAt: Date.now(),
              });
            }
            return { ...s, tasks: newTasks };
          });
          break;

        case 'task.progress':
          setState(s => {
            const newTasks = new Map(s.tasks);
            const task = newTasks.get(event.taskId);
            if (task) {
              newTasks.set(event.taskId, {
                ...task,
                progress: { current: event.current, total: event.total, label: event.label },
              });
            } else {
              // Create stub task for unknown taskId (event arrived before task.started)
              newTasks.set(event.taskId, {
                taskId: event.taskId,
                status: 'running',
                prompt: null,
                logs: [],
                inputQuestion: null,
                inputChoices: [],
                progress: { current: event.current, total: event.total, label: event.label },
                startedAt: Date.now(),
              });
            }
            return { ...s, tasks: newTasks };
          });
          break;

        case 'task.done':
          setState(s => {
            const newTasks = new Map(s.tasks);
            const task = newTasks.get(event.taskId);
            // Use marker prefix for synthetic logs to distinguish from daemon logs
            const syntheticLog = { level: 'info' as const, message: `${SYNTHETIC_LOG_MARKER}✅ ${event.summary}`, ts: Date.now() };
            if (task) {
              newTasks.set(event.taskId, {
                ...task,
                status: 'done',
                logs: [...task.logs, syntheticLog],
                hasSyntheticDoneLog: true,
              });
            } else {
              // Create stub task for unknown taskId (task.started was dropped)
              newTasks.set(event.taskId, {
                taskId: event.taskId,
                status: 'done',
                prompt: null,
                logs: [syntheticLog],
                inputQuestion: null,
                inputChoices: [],
                progress: null,
                startedAt: Date.now(),
                hasSyntheticDoneLog: true,
              });
            }
            return { ...s, tasks: newTasks };
          });
          // Remove task after delay (matches background's 5s delay)
          setTimeout(() => {
            setState(s => {
              const newTasks = new Map(s.tasks);
              newTasks.delete(event.taskId);
              return { ...s, tasks: newTasks };
            });
          }, 5000);
          break;

        case 'task.error':
          setState(s => {
            const newTasks = new Map(s.tasks);
            const task = newTasks.get(event.taskId);
            // Use marker prefix for synthetic logs to distinguish from daemon logs
            const syntheticLog = { level: 'error' as const, message: `${SYNTHETIC_LOG_MARKER}❌ ${event.message}`, ts: Date.now() };
            if (task) {
              newTasks.set(event.taskId, {
                ...task,
                status: 'error',
                logs: [...task.logs, syntheticLog],
                hasSyntheticDoneLog: true,
              });
            } else {
              // Create stub task for unknown taskId (task.started was dropped)
              newTasks.set(event.taskId, {
                taskId: event.taskId,
                status: 'error',
                prompt: null,
                logs: [syntheticLog],
                inputQuestion: null,
                inputChoices: [],
                progress: null,
                startedAt: Date.now(),
                hasSyntheticDoneLog: true,
              });
            }
            return { ...s, tasks: newTasks };
          });
          // Remove task after delay (matches background's 5s delay)
          setTimeout(() => {
            setState(s => {
              const newTasks = new Map(s.tasks);
              newTasks.delete(event.taskId);
              return { ...s, tasks: newTasks };
            });
          }, 5000);
          break;
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  // Poll task status as fallback (sendMessage from SW may not reach side panel reliably)
  useEffect(() => {
    if (!hasActiveTasks(state.tasks)) return;

    const interval = setInterval(() => {
      chrome.runtime.sendMessage({ type: 'get_task_status' }, (response) => {
        if (chrome.runtime.lastError) return;

        // Sync from multi-task response
        if (response?.tasks && response.tasks.length > 0) {
          // Track tasks that need removal timers (status changed to done/error via polling)
          const tasksNeedingRemovalTimer: string[] = [];

          setState(s => {
            const newTasks = new Map(s.tasks);
            const bgTaskIds = new Set((response.tasks as BackgroundTaskState[]).map((t: BackgroundTaskState) => t.taskId));

            // Update or add tasks from background
            for (const bgTask of response.tasks as BackgroundTaskState[]) {
              const localTask = newTasks.get(bgTask.taskId);

              // Detect new logs: use marker to identify synthetic logs, compare count + first/last logs
              const bgFirstLog = bgTask.logs[0];
              const bgLastLog = bgTask.logs[bgTask.logs.length - 1];
              const localNonSyntheticLogs = localTask?.logs.filter((l: TaskLog) =>
                !l.message.startsWith('▶') && !l.message.startsWith(SYNTHETIC_LOG_MARKER)
              ) || [];
              const localFirstLog = localNonSyntheticLogs[0];
              const localLastLog = localNonSyntheticLogs[localNonSyntheticLogs.length - 1];

              // Compare count + first log + last log for robust detection (handles rotation + same-ms logs)
              const hasNewLogs = !localTask ||
                bgTask.logs.length !== localNonSyntheticLogs.length ||
                !localLastLog ||
                (bgLastLog && (bgLastLog.ts !== localLastLog.ts || bgLastLog.message !== localLastLog.message)) ||
                (bgFirstLog && localFirstLog && (bgFirstLog.ts !== localFirstLog.ts || bgFirstLog.message !== localFirstLog.message));

              // Detect status/input changes (even without new logs)
              const hasStatusChange = localTask && localTask.status !== bgTask.status;
              const hasInputChange = localTask && (
                localTask.inputQuestion !== bgTask.inputQuestion ||
                JSON.stringify(localTask.inputChoices) !== JSON.stringify(bgTask.inputChoices)
              );

              // Detect if task needs removal timer:
              // 1. Status changed to done/error (event was received but we're syncing)
              // 2. Task first observed via polling already in done/error (event was dropped)
              const needsRemovalTimer =
                (bgTask.status === 'done' || bgTask.status === 'error') &&
                (!localTask || (localTask.status !== 'done' && localTask.status !== 'error'));

              if (!localTask || hasNewLogs || hasStatusChange || hasInputChange) {
                const prompt = bgTask.prompt || localTask?.prompt || 'External task';
                // Preserve local synthetic logs (marked with SYNTHETIC_LOG_MARKER)
                const localSyntheticLogs = localTask?.logs.filter((l: TaskLog) =>
                  l.message.startsWith(SYNTHETIC_LOG_MARKER)
                ) || [];
                newTasks.set(bgTask.taskId, {
                  taskId: bgTask.taskId,
                  status: bgTask.status,
                  prompt,
                  logs: [
                    { level: 'info' as const, message: `▶ ${prompt}`, ts: localTask?.logs[0]?.ts || bgTask.startedAt },
                    ...bgTask.logs,
                    ...localSyntheticLogs,
                  ],
                  inputQuestion: bgTask.inputQuestion,
                  inputChoices: bgTask.inputChoices,
                  progress: localTask?.progress ?? null,
                  startedAt: bgTask.startedAt,
                  hasSyntheticDoneLog: localTask?.hasSyntheticDoneLog,
                });

                // Schedule removal timer if task is done/error and doesn't already have one
                if (needsRemovalTimer && !localTask?.hasSyntheticDoneLog) {
                  tasksNeedingRemovalTimer.push(bgTask.taskId);
                }
              }
            }

            // Remove tasks that are no longer in background
            for (const taskId of newTasks.keys()) {
              if (!bgTaskIds.has(taskId)) {
                const task = newTasks.get(taskId);
                if (task && task.status !== 'done' && task.status !== 'error') {
                  newTasks.delete(taskId);
                }
              }
            }

            return { ...s, tasks: newTasks };
          });

          // Schedule removal timers for tasks that changed to done/error via polling
          for (const taskId of tasksNeedingRemovalTimer) {
            setTimeout(() => {
              setState(s => {
                const newTasks = new Map(s.tasks);
                newTasks.delete(taskId);
                return { ...s, tasks: newTasks };
              });
            }, 5000);
          }
        } else if (!response?.taskId && state.tasks.size > 0) {
          // No active tasks in background, clear local state
          setState(s => {
            const newTasks = new Map(s.tasks);
            for (const [taskId, task] of newTasks) {
              if (task.status !== 'done' && task.status !== 'error') {
                newTasks.delete(taskId);
              }
            }
            return { ...s, tasks: newTasks };
          });
        }
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [state.tasks]);

  // Computed values
  const allLogs = getAllLogs(state.tasks);
  const pendingInputTasks = getPendingInputTasks(state.tasks);
  const firstPendingTask = pendingInputTasks[0];

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allLogs]);

  // handleRunTask — reserved for future IDE integration
  // const handleRunTask = async (prompt: string, image?: string) => { ... };

  const handleChoice = async (taskId: string, choiceId: string) => {
    if (!taskId) return;

    try {
      await fetch(`${DAEMON_API_URL}/tasks/${taskId}/choice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choiceId }),
      });

      // Update only the specific task
      setState(s => {
        const newTasks = new Map(s.tasks);
        const task = newTasks.get(taskId);
        if (task) {
          newTasks.set(taskId, {
            ...task,
            status: 'running',
            inputQuestion: null,
            inputChoices: [],
          });
        }
        return { ...s, tasks: newTasks };
      });
    } catch (error) {
      console.error('Failed to submit choice:', error);
    }
  };

  // Home tab handlers - hidden, kept for future use
  // const handleSetHomeTab = async () => { ... };
  // const handleClearHomeTab = async () => { ... };

  const handleDoneCountdownComplete = () => {
    if (state.doneCountdown) {
      chrome.runtime.sendMessage({
        type: 'execute_done_focus',
        taskId: state.doneCountdown.taskId,
      });
    }
    setState(s => ({ ...s, doneCountdown: null }));
  };

  const handleDoneCountdownCancel = () => {
    if (state.doneCountdown) {
      chrome.runtime.sendMessage({
        type: 'cancel_done_focus',
        taskId: state.doneCountdown.taskId,
      });
    }
    setState(s => ({ ...s, doneCountdown: null }));
  };

  const handleCancelTask = async (taskId: string) => {
    if (!taskId) return;

    try {
      await fetch(`${DAEMON_API_URL}/agent/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });

      // Remove the specific task
      setState(s => {
        const newTasks = new Map(s.tasks);
        newTasks.delete(taskId);
        return { ...s, tasks: newTasks };
      });
    } catch (error) {
      console.error('Failed to cancel task:', error);
    }
  };

  // 寿司パーティクル生成
  const sushiEmojis = ['🍣', '🍱', '🍙', '🥢', '🍵', '🍶', '🐟', '🦐', '🥒', '🥑'];
  const sushiParticles = Array.from({ length: 15 }, (_, i) => ({
    emoji: sushiEmojis[i % sushiEmojis.length],
    style: {
      left: `${(i * 7) % 100}%`,
      top: `${(i * 13) % 80}%`,
      animationDelay: `${i * 0.5}s`,
      animationDuration: `${15 + (i % 10)}s`,
    },
  }));

  // 回転寿司コンベアの寿司
  const conveyorSushi = ['🍣', '🍱', '🍙', '🥟', '🍤', '🐟', '🍣', '🍱', '🍙', '🥟', '🍤', '🐟'];

  return (
    <div className="flex flex-col h-screen bg-sushi-bg relative overflow-hidden">
      {/* 🍣 浮遊する寿司パーティクル */}
      <div className="sushi-bg-particles">
        {sushiParticles.map((particle, i) => (
          <span
            key={i}
            className="sushi-particle"
            style={particle.style}
          >
            {particle.emoji}
          </span>
        ))}
      </div>

      {/* メインコンテンツ */}
      <div className="relative z-10 flex flex-col h-full pb-14">
        <Header connected={state.connected} />

        {/* TaskInput hidden — reserved for future IDE integration */}

        <div className="flex-1 flex flex-col overflow-hidden">
          <TerminalOutput
            logs={allLogs}
            theme={theme}
            showTaskId={state.tasks.size > 1}
          />
          <div ref={logsEndRef} />
        </div>
      </div>

      {/* 🍣 回転寿司コンベア */}
      <div className="conveyor-container">
        <div className="conveyor-belt">
          {/* 2セット分の寿司（無限ループ用） */}
          {[...conveyorSushi, ...conveyorSushi].map((sushi, i) => (
            <span
              key={i}
              className="conveyor-sushi"
              style={{ animationDelay: `${i * 0.2}s` }}
            >
              {sushi}
            </span>
          ))}
        </div>
      </div>

      {/* Action Required Modal - show first pending task */}
      {firstPendingTask && (
        <ActionRequiredModal
          taskId={firstPendingTask.taskId}
          taskPrompt={firstPendingTask.prompt}
          question={firstPendingTask.inputQuestion!}
          choices={firstPendingTask.inputChoices}
          onChoice={(choiceId) => handleChoice(firstPendingTask.taskId, choiceId)}
          onCancel={() => handleCancelTask(firstPendingTask.taskId)}
          progress={firstPendingTask.progress}
          pendingCount={pendingInputTasks.length}
        />
      )}

      {/* Task Complete Countdown Modal */}
      {state.doneCountdown && (
        <TaskCompleteModal
          summary={state.doneCountdown.summary}
          countdownMs={state.doneCountdown.ms}
          onComplete={handleDoneCountdownComplete}
          onCancel={handleDoneCountdownCancel}
          theme={theme}
        />
      )}
    </div>
  );
}
