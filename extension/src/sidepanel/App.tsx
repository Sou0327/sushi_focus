import { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { TerminalOutput } from './components/TerminalOutput';
import { ActionRequiredModal } from './components/ActionRequiredModal';
import { TaskCompleteModal } from './components/TaskCompleteModal';
import type { DaemonEvent, TaskLog, TaskStatus, Choice, ExtensionSettings } from '@/shared/types';

const DAEMON_API_URL = 'http://127.0.0.1:3000';

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
}

export default function App() {
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
  });

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Load initial state
  useEffect(() => {
    // Check connection status
    chrome.runtime.sendMessage({ type: 'get_connection_status' }, (response) => {
      if (response?.connected !== undefined) {
        setState(s => ({ ...s, connected: response.connected }));
      }
    });

    // Load settings
    chrome.runtime.sendMessage({ type: 'get_settings' }, (response) => {
      if (response?.settings) {
        setState(s => ({ ...s, settings: response.settings }));
      }
    });
  }, []);

  // Listen for messages from background
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === 'connection_status') {
        setState(s => ({ ...s, connected: message.connected }));
        return;
      }

      if (message.type === 'start_done_countdown') {
        setState(s => ({
          ...s,
          doneCountdown: {
            taskId: message.taskId,
            summary: message.summary,
            ms: message.countdownMs,
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
        case 'task.started':
          setState(s => ({
            ...s,
            taskStatus: 'running',
            taskId: event.taskId,
            taskPrompt: (event as any).prompt || 'External task',
            logs: [],
            inputQuestion: null,
            inputChoices: [],
          }));
          break;

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
            setState(s => ({ ...s, taskStatus: 'idle', taskId: null, taskPrompt: null }));
          }, 3000);
          break;
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.logs]);

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

  const handleSetHomeTab = async () => {
    chrome.runtime.sendMessage({ type: 'set_home_tab' }, (response) => {
      if (response?.ok) {
        setState(s => ({
          ...s,
          settings: s.settings ? { ...s.settings, homeTabId: response.tabId } : null,
        }));
      }
    });
  };

  const handleClearHomeTab = async () => {
    chrome.runtime.sendMessage({ type: 'clear_home_tab' }, () => {
      setState(s => ({
        ...s,
        settings: s.settings ? { ...s.settings, homeTabId: null, homeWindowId: null } : null,
      }));
    });
  };

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

  return (
    <div className="flex flex-col h-screen bg-focus-bg">
      <Header
        connected={state.connected}
        taskStatus={state.taskStatus}
        homeTabSet={!!state.settings?.homeTabId}
        onSetHomeTab={handleSetHomeTab}
        onClearHomeTab={handleClearHomeTab}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Status Monitor Panel */}
        <div className="p-4 border-b border-gray-800">
          {state.taskStatus === 'idle' && !state.taskPrompt && (
            <div className="text-center text-gray-500 py-8">
              <div className="text-4xl mb-2">👀</div>
              <p className="text-sm">Waiting for agent activity...</p>
              <p className="text-xs mt-2 text-gray-600">
                Claude Code や Cursor でタスクを実行すると<br/>
                ここに状態が表示されます
              </p>
            </div>
          )}

          {state.taskStatus === 'running' && state.taskPrompt && (
            <div className="bg-blue-900/30 rounded-lg p-3 border border-blue-700/50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-blue-400 text-sm font-medium">Running</span>
              </div>
              <p className="text-white text-sm truncate">{state.taskPrompt}</p>
            </div>
          )}

          {state.taskStatus === 'waiting_input' && (
            <div className="bg-yellow-900/30 rounded-lg p-3 border border-yellow-700/50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                <span className="text-yellow-400 text-sm font-medium">Input Required</span>
              </div>
              <p className="text-white text-sm">{state.inputQuestion}</p>
            </div>
          )}

          {state.taskStatus === 'done' && (
            <div className="bg-green-900/30 rounded-lg p-3 border border-green-700/50">
              <div className="flex items-center gap-2">
                <span className="text-green-400 text-sm font-medium">✓ Completed</span>
              </div>
            </div>
          )}

          {state.taskStatus === 'error' && (
            <div className="bg-red-900/30 rounded-lg p-3 border border-red-700/50">
              <div className="flex items-center gap-2">
                <span className="text-red-400 text-sm font-medium">✕ Error</span>
              </div>
            </div>
          )}
        </div>

        <TerminalOutput logs={state.logs} />
        <div ref={logsEndRef} />
      </div>

      {/* Action Required Modal */}
      {state.taskStatus === 'waiting_input' && state.inputQuestion && (
        <ActionRequiredModal
          question={state.inputQuestion}
          choices={state.inputChoices}
          onChoice={handleChoice}
        />
      )}

      {/* Task Complete Countdown Modal */}
      {state.doneCountdown && (
        <TaskCompleteModal
          summary={state.doneCountdown.summary}
          countdownMs={state.doneCountdown.ms}
          onComplete={handleDoneCountdownComplete}
          onCancel={handleDoneCountdownCancel}
        />
      )}
    </div>
  );
}
