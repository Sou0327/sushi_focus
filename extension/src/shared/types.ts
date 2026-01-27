// ============================================================
// Task & Event Types (shared between extension and daemon)
// ============================================================

export type TaskStatus = 'idle' | 'running' | 'waiting_input' | 'done' | 'error';

export type FocusMode = 'quiet' | 'normal' | 'force';

export interface TaskLog {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  ts: number;
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
}

export interface TaskLogEvent {
  type: 'task.log';
  taskId: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
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
  meta?: {
    changedFiles?: number;
    tests?: 'passed' | 'failed' | 'not_run';
  };
}

export interface TaskErrorEvent {
  type: 'task.error';
  taskId: string;
  message: string;
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
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  mode: 'force',
  homeTabId: null,
  homeWindowId: null,
  enableDoneFocus: true,
  alwaysFocusOnDone: false,
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
};;

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
