import { describe, it, expect } from 'vitest';
import { isDaemonEvent, isHealthResponse } from './typeGuards';

describe('isDaemonEvent', () => {
  it('有効な task.started イベントを認識する', () => {
    expect(
      isDaemonEvent({
        type: 'task.started',
        taskId: 'task-123',
        repoId: 'repo-1',
      })
    ).toBe(true);
  });

  it('有効な task.log イベントを認識する', () => {
    expect(
      isDaemonEvent({
        type: 'task.log',
        taskId: 'task-123',
        level: 'info',
        message: 'Test message',
      })
    ).toBe(true);

    expect(
      isDaemonEvent({
        type: 'task.log',
        taskId: 'task-123',
        level: 'warn',
        message: 'Warning message',
      })
    ).toBe(true);

    expect(
      isDaemonEvent({
        type: 'task.log',
        taskId: 'task-123',
        level: 'error',
        message: 'Error message',
      })
    ).toBe(true);

    expect(
      isDaemonEvent({
        type: 'task.log',
        taskId: 'task-123',
        level: 'debug',
        message: 'Debug message',
      })
    ).toBe(true);

    expect(
      isDaemonEvent({
        type: 'task.log',
        taskId: 'task-123',
        level: 'success',
        message: 'Task complete!',
      })
    ).toBe(true);

    expect(
      isDaemonEvent({
        type: 'task.log',
        taskId: 'task-123',
        level: 'focus',
        message: 'Returning focus to IDE...',
      })
    ).toBe(true);

    expect(
      isDaemonEvent({
        type: 'task.log',
        taskId: 'task-123',
        level: 'command',
        message: '$ pnpm build',
      })
    ).toBe(true);
  });

  it('有効な task.need_input イベントを認識する', () => {
    expect(
      isDaemonEvent({
        type: 'task.need_input',
        taskId: 'task-123',
        question: 'What is your name?',
      })
    ).toBe(true);
  });

  it('有効な task.done イベントを認識する', () => {
    expect(
      isDaemonEvent({
        type: 'task.done',
        taskId: 'task-123',
        summary: 'Task completed successfully',
      })
    ).toBe(true);
  });

  it('有効な task.error イベントを認識する', () => {
    expect(
      isDaemonEvent({
        type: 'task.error',
        taskId: 'task-123',
        message: 'Something went wrong',
      })
    ).toBe(true);
  });

  it('有効な task.progress イベントを認識する', () => {
    expect(
      isDaemonEvent({
        type: 'task.progress',
        taskId: 'task-123',
        current: 5,
        total: 10,
      })
    ).toBe(true);
  });

  it('不正な構造を拒否する', () => {
    expect(isDaemonEvent(null)).toBe(false);
    expect(isDaemonEvent(undefined)).toBe(false);
    expect(isDaemonEvent('string')).toBe(false);
    expect(isDaemonEvent(123)).toBe(false);
    expect(isDaemonEvent([])).toBe(false);
    expect(isDaemonEvent({})).toBe(false);
    expect(isDaemonEvent({ type: 123 })).toBe(false);
  });

  it('不正な event タイプを拒否する', () => {
    expect(isDaemonEvent({ type: 'unknown.event' })).toBe(false);
    expect(isDaemonEvent({ type: 'task.unknown' })).toBe(false);
  });

  it('必須フィールドが欠落したイベントを拒否する', () => {
    // task.started: taskId と repoId が必須
    expect(isDaemonEvent({ type: 'task.started', taskId: 'id' })).toBe(false);
    expect(isDaemonEvent({ type: 'task.started', repoId: 'repo' })).toBe(false);

    // task.log: taskId, level, message が必須
    expect(isDaemonEvent({ type: 'task.log', taskId: 'id' })).toBe(false);
    expect(isDaemonEvent({ type: 'task.log', taskId: 'id', level: 'info' })).toBe(
      false
    );

    // 不正な level 値
    expect(
      isDaemonEvent({
        type: 'task.log',
        taskId: 'id',
        level: 'invalid',
        message: 'msg',
      })
    ).toBe(false);
  });
});

describe('isHealthResponse', () => {
  it('有効なレスポンスを認識する', () => {
    expect(
      isHealthResponse({
        ok: true,
        version: '1.0.0',
        gitBranch: 'main',
      })
    ).toBe(true);

    expect(
      isHealthResponse({
        ok: true,
        version: '1.0.0',
        gitBranch: null,
      })
    ).toBe(true);

    expect(
      isHealthResponse({
        ok: false,
        version: '0.0.1',
        gitBranch: 'feature/test',
      })
    ).toBe(true);
  });

  it('不正な構造を拒否する', () => {
    expect(isHealthResponse(null)).toBe(false);
    expect(isHealthResponse(undefined)).toBe(false);
    expect(isHealthResponse('string')).toBe(false);
    expect(isHealthResponse(123)).toBe(false);
    expect(isHealthResponse([])).toBe(false);
  });

  it('必須フィールドが欠落したレスポンスを拒否する', () => {
    expect(isHealthResponse({})).toBe(false);
    expect(isHealthResponse({ ok: true })).toBe(false);
    expect(isHealthResponse({ ok: true, version: '1.0.0' })).toBe(false);
  });

  it('不正な型のフィールドを持つレスポンスを拒否する', () => {
    expect(
      isHealthResponse({ ok: 'true', version: '1.0.0', gitBranch: null })
    ).toBe(false);
    expect(
      isHealthResponse({ ok: true, version: 123, gitBranch: null })
    ).toBe(false);
    expect(
      isHealthResponse({ ok: true, version: '1.0.0', gitBranch: 123 })
    ).toBe(false);
  });
});
