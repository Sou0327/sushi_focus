import { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
// import { TaskInput } from './components/TaskInput'; // Reserved for future IDE integration
import { TerminalOutput } from './components/TerminalOutput';
import { ActionRequiredModal } from './components/ActionRequiredModal';
import { TaskCompleteModal } from './components/TaskCompleteModal';
import { useTranslation } from '@/i18n/TranslationContext';
import { useTheme } from '@/theme/useTheme';
import type { DaemonEvent, TaskLog, TaskStatus, Choice, ExtensionSettings } from '@/shared/types';

const DAEMON_API_URL = 'http://127.0.0.1:41593';

interface AppState {
  connected: boolean;
  taskStatus: TaskStatus;
  taskId: string | null;
  taskPrompt: string | null;
  logs: TaskLog[];
  inputQuestion: string | null;
  inputChoices: Choice[];
  doneCountdown: { taskId: string; summary: string; ms: number } | null;
  settings: ExtensionSettings | null;
  progress: { current: number; total: number; label?: string } | null;
  gitBranch: string | null;
}

export default function App() {
  const { t: _t } = useTranslation(); // Reserved for future use
  const { theme } = useTheme();
  const [state, setState] = useState<AppState>({
    connected: false,
    taskStatus: 'idle',
    taskId: null,
    taskPrompt: null,
    logs: [],
    inputQuestion: null,
    inputChoices: [],
    doneCountdown: null,
    settings: null,
    progress: null,
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
      if (response?.taskId) {
        const prompt = response.prompt || 'External task';
        const restoredLogs = response.logs?.length
          ? response.logs
          : [{ level: 'info' as const, message: `▶ ${prompt}`, ts: Date.now() }];
        setState(s => ({
          ...s,
          taskStatus: response.status === 'running' ? 'running' : s.taskStatus,
          taskId: response.taskId,
          taskPrompt: prompt,
          logs: restoredLogs,
        }));
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
          setState(s => ({
            ...s,
            taskStatus: 'running',
            taskId: event.taskId,
            taskPrompt: prompt,
            logs: [{ level: 'info', message: `▶ ${prompt}`, ts: Date.now() }],
            inputQuestion: null,
            inputChoices: [],
            progress: null,
          }));
          break;
        }

        case 'task.log':
          setState(s => ({
            ...s,
            logs: [...s.logs, { level: event.level, message: event.message, ts: Date.now() }],
          }));
          break;

        case 'task.need_input':
          setState(s => ({
            ...s,
            taskStatus: 'waiting_input',
            inputQuestion: event.question,
            inputChoices: event.choices,
          }));
          break;

        case 'task.progress':
          setState(s => ({
            ...s,
            progress: { current: event.current, total: event.total, label: event.label },
          }));
          break;

        case 'task.done':
          setState(s => ({
            ...s,
            taskStatus: 'done',
            logs: [...s.logs, { level: 'info', message: `✅ ${event.summary}`, ts: Date.now() }],
          }));
          // Reset after a moment
          setTimeout(() => {
            setState(s => ({
              ...s,
              taskStatus: 'idle',
              taskId: null,
              taskPrompt: null,
              inputQuestion: null,
              inputChoices: [],
              progress: null,
            }));
          }, 3000);
          break;

        case 'task.error':
          setState(s => ({
            ...s,
            taskStatus: 'error',
            logs: [...s.logs, { level: 'error', message: `❌ ${event.message}`, ts: Date.now() }],
          }));
          setTimeout(() => {
            setState(s => ({ ...s, taskStatus: 'idle', taskId: null, taskPrompt: null, progress: null }));
          }, 3000);
          break;
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  // Poll task status as fallback (sendMessage from SW may not reach side panel reliably)
  useEffect(() => {
    if (state.taskStatus !== 'running' && state.taskStatus !== 'waiting_input') return;

    const interval = setInterval(() => {
      chrome.runtime.sendMessage({ type: 'get_task_status' }, (response) => {
        if (chrome.runtime.lastError) return;
        if (!response?.taskId) {
          // Task ended while we weren't notified
          setState(s => s.taskId ? ({
            ...s,
            taskStatus: 'idle',
            taskId: null,
            taskPrompt: null,
            progress: null,
          }) : s);
          return;
        }
        // Sync logs from buffer if we have fewer
        if (response.logs && response.logs.length > 0) {
          setState(s => {
            // Background buffer has authoritative log count (excluding our synthetic ▶ line)
            const bgCount = response.logs.length;
            const localReal = s.logs.filter((l: TaskLog) => !l.message.startsWith('▶')).length;
            if (bgCount > localReal) {
              // Prepend ▶ line, then use background buffer
              const prompt = response.prompt || s.taskPrompt || 'External task';
              return {
                ...s,
                logs: [
                  { level: 'info' as const, message: `▶ ${prompt}`, ts: s.logs[0]?.ts || Date.now() },
                  ...response.logs,
                ],
              };
            }
            return s;
          });
        }
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [state.taskStatus]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.logs]);

  // handleRunTask — reserved for future IDE integration
  // const handleRunTask = async (prompt: string, image?: string) => { ... };

  const handleChoice = async (choiceId: string) => {
    if (!state.taskId) return;

    try {
      await fetch(`${DAEMON_API_URL}/tasks/${state.taskId}/choice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choiceId }),
      });

      setState(s => ({
        ...s,
        inputQuestion: null,
        inputChoices: [],
        taskStatus: 'running',
      }));
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

  const handleCancelTask = async () => {
    if (!state.taskId) return;

    try {
      await fetch(`${DAEMON_API_URL}/agent/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: state.taskId }),
      });

      setState(s => ({
        ...s,
        taskStatus: 'idle',
        taskId: null,
        taskPrompt: null,
        inputQuestion: null,
        inputChoices: [],
        progress: null,
      }));
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
          <TerminalOutput logs={state.logs} theme={theme} />
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

      {/* Action Required Modal */}
      {state.taskStatus === 'waiting_input' && state.inputQuestion && (
        <ActionRequiredModal
          question={state.inputQuestion}
          choices={state.inputChoices}
          onChoice={handleChoice}
          onCancel={handleCancelTask}
          progress={state.progress}
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
