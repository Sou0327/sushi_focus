// ============================================================
// Task & Event Types (shared between extension and daemon)
// ============================================================

export type TaskStatus = 'idle' | 'running' | 'waiting_input' | 'done' | 'error';

export type FocusMode = 'quiet' | 'normal' | 'force';

export interface TaskLog {
  level: 'info' | 'warn' | 'error' | 'debug' | 'success' | 'focus' | 'command';
  message: string;
  ts: number;
  messageKey?: string;
  messageParams?: Record<string, string | number>;
}

export interface Choice {
  id: string;
  label: string;
}

export interface Task {
  id: string;
  repoId: string;
  prompt: string;
  status: TaskStatus;
  createdAt: number;
  updatedAt: number;
  logs: TaskLog[];
  summary?: string;
  image?: string;
  autoFocusDisabled?: boolean;
}

export interface Repo {
  repoId: string;
  name: string;
  path: string;
  defaultBranch?: string;
}

// ============================================================
// WebSocket Event Types
// ============================================================

export interface TaskStartedEvent {
  type: 'task.started';
  taskId: string;
  repoId: string;
  startedAt: number;
  hasImage?: boolean;
  prompt?: string;
}

export interface TaskLogEvent {
  type: 'task.log';
  taskId: string;
  level: 'info' | 'warn' | 'error' | 'debug' | 'success' | 'focus' | 'command';
  message: string;
  messageKey?: string;
  messageParams?: Record<string, string | number>;
}

export interface TaskNeedInputEvent {
  type: 'task.need_input';
  taskId: string;
  question: string;
  choices: Choice[];
}

export interface TaskDoneEvent {
  type: 'task.done';
  taskId: string;
  summary: string;
  summaryKey?: string;
  meta?: {
    changedFiles?: number;
    tests?: 'passed' | 'failed' | 'not_run';
  };
}

export interface TaskErrorEvent {
  type: 'task.error';
  taskId: string;
  message: string;
  messageKey?: string;
  details?: string;
}

export interface TaskProgressEvent {
  type: 'task.progress';
  taskId: string;
  current: number;
  total: number;
  label?: string;
}

export type DaemonEvent =
  | TaskStartedEvent
  | TaskLogEvent
  | TaskNeedInputEvent
  | TaskDoneEvent
  | TaskErrorEvent
  | TaskProgressEvent;

// ============================================================
// Storage Types
// ============================================================

export type Language = 'en' | 'ja';
export type Theme = 'dark' | 'light';
export type LogVerbosity = 'minimal' | 'normal' | 'verbose';

export interface ExtensionSettings {
  mode: FocusMode;
  homeTabId: number | null;
  homeWindowId: number | null;
  enableDoneFocus: boolean;
  alwaysFocusOnDone: boolean;
  doneCountdownMs: number;
  doneCooldownMs: number;
  distractionDomains: string[];
  enabled: boolean;
  language: Language;
  theme: Theme;
  logVerbosity: LogVerbosity;
  // WebSocket URL (configurable)
  daemonWsUrl: string;
  daemonHttpUrl: string;
  // Task history settings
  keepCompletedTasks: boolean;
  maxCompletedTasks: number;
  // Error log settings
  saveErrorLogs: boolean;
  maxErrorLogs: number;
  // Privacy
  logPromptContent: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  mode: 'normal',
  homeTabId: null,
  homeWindowId: null,
  enableDoneFocus: true,
  alwaysFocusOnDone: true,
  doneCountdownMs: 1500,
  doneCooldownMs: 45000,
  distractionDomains: [
    'netflix.com',
    'tiktok.com',
    'youtube.com',
    'x.com',
    'twitter.com',
    'instagram.com',
    'twitch.tv',
    'reddit.com',
  ],
  enabled: true,
  language: 'en',
  theme: 'light',
  logVerbosity: 'normal',
  // WebSocket URL defaults
  daemonWsUrl: 'ws://127.0.0.1:41593/ws',
  daemonHttpUrl: 'http://127.0.0.1:41593',
  // Task history defaults
  keepCompletedTasks: true,
  maxCompletedTasks: 50,
  // Error log defaults
  saveErrorLogs: true,
  maxErrorLogs: 100,
  // Privacy defaults
  logPromptContent: false,
};

// ============================================================
// API Types
// ============================================================

export interface CreateTaskRequest {
  repoId: string;
  prompt: string;
  mode?: 'normal' | 'debug';
}

export interface CreateTaskResponse {
  taskId: string;
}

export interface ChoiceRequest {
  choiceId: string;
}

export interface ApiResponse {
  ok: boolean;
  error?: string;
}

export interface HealthResponse {
  ok: boolean;
  version: string;
  gitBranch: string | null;
}

// ============================================================
// Multi-Task State Types
// ============================================================

export interface BackgroundTaskState {
  taskId: string;
  startedAt: number;
  logs: TaskLog[];
  prompt: string | null;
  status: TaskStatus;
  inputQuestion: string | null;
  inputChoices: Choice[];
  // Task history fields
  completedAt: number | null;
  summary: string | null;
  errorMessage: string | null;
}

// ============================================================
// Error Log Types
// ============================================================

export type ErrorCategory = 'connection' | 'websocket' | 'parse' | 'api' | 'unknown';

export interface ErrorLogEntry {
  id: string;
  timestamp: number;
  category: ErrorCategory;
  message: string;
  details?: string;
  taskId?: string;
}

export interface TaskStatusResponse {
  // Legacy single-task fields (for backward compatibility)
  status: TaskStatus;
  taskId: string | null;
  startedAt: number | null;
  prompt: string | null;
  logs: TaskLog[];
  // New multi-task fields
  tasks: BackgroundTaskState[];
  completedTasks: BackgroundTaskState[];
}
