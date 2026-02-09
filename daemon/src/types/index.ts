// ============================================================
// Task & Event Types (Daemon)
// ============================================================

export type TaskStatus = 'idle' | 'running' | 'waiting_input' | 'done' | 'error';

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
  process?: import('child_process').ChildProcess;
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

export type ExtractionStrategy = 'selection' | 'semantic' | 'density' | 'fallback';

export interface BrowserContext {
  url: string;
  title: string;
  content: string;
  selectedText?: string;
  timestamp: number;
  strategy?: ExtractionStrategy;
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
