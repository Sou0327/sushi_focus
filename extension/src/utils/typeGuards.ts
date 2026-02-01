import type { DaemonEvent, HealthResponse } from '@/shared/types';

/**
 * Valid daemon event types.
 */
export const VALID_EVENT_TYPES = [
  'task.started',
  'task.log',
  'task.need_input',
  'task.done',
  'task.error',
  'task.progress',
] as const;

/**
 * Validates that unknown data conforms to DaemonEvent structure.
 * Prevents processing of malformed or malicious WebSocket messages.
 */
export function isDaemonEvent(data: unknown): data is DaemonEvent {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // Check required 'type' field
  if (typeof obj.type !== 'string') {
    return false;
  }

  // Validate event type is known
  if (!VALID_EVENT_TYPES.includes(obj.type as (typeof VALID_EVENT_TYPES)[number])) {
    return false;
  }

  // Type-specific validation
  switch (obj.type) {
    case 'task.started':
      return typeof obj.taskId === 'string' && typeof obj.repoId === 'string';
    case 'task.log':
      return (
        typeof obj.taskId === 'string' &&
        typeof obj.level === 'string' &&
        ['info', 'warn', 'error', 'debug'].includes(obj.level) &&
        typeof obj.message === 'string'
      );
    case 'task.need_input':
      return typeof obj.taskId === 'string' && typeof obj.question === 'string';
    case 'task.done':
      return typeof obj.taskId === 'string' && typeof obj.summary === 'string';
    case 'task.error':
      return typeof obj.taskId === 'string' && typeof obj.message === 'string';
    case 'task.progress':
      return (
        typeof obj.taskId === 'string' &&
        typeof obj.current === 'number' &&
        typeof obj.total === 'number'
      );
    default:
      return false;
  }
}

/**
 * Validates Health API response structure.
 * Returns safe defaults if validation fails.
 */
export function isHealthResponse(data: unknown): data is HealthResponse {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  return (
    typeof obj.ok === 'boolean' &&
    typeof obj.version === 'string' &&
    (obj.gitBranch === null || typeof obj.gitBranch === 'string')
  );
}
