import { describe, it, expect } from 'vitest';
import { isAIMessage, isUserPrompt, isSuccessMessage } from './logMessageUtils';

describe('isAIMessage', () => {
  it('[AI] プレフィックス付きメッセージを認識する', () => {
    expect(isAIMessage('[AI] Processing request')).toBe(true);
  });

  it('Analyzing を含むメッセージを認識する', () => {
    expect(isAIMessage('Analyzing code structure...')).toBe(true);
  });

  it('Identified を含むメッセージを認識する', () => {
    expect(isAIMessage('Identified 3 potential issues')).toBe(true);
  });

  it('通常のログメッセージを AI として認識しない', () => {
    expect(isAIMessage('Tool: Read completed')).toBe(false);
    expect(isAIMessage('Server started on port 3000')).toBe(false);
  });
});

describe('isUserPrompt', () => {
  it('[USER] プレフィックス付きメッセージを認識する', () => {
    expect(isUserPrompt('[USER] 認証機能を実装して')).toBe(true);
    expect(isUserPrompt('[USER] Fix the bug in login')).toBe(true);
  });

  it('プレフィックスが正確に一致する場合のみ認識する', () => {
    // スペースなしは認識しない
    expect(isUserPrompt('[USER]No space')).toBe(false);
  });

  it('メッセージ途中の [USER] は認識しない', () => {
    expect(isUserPrompt('Message from [USER] here')).toBe(false);
  });

  it('通常のログメッセージをユーザープロンプトとして認識しない', () => {
    expect(isUserPrompt('Tool: Read completed')).toBe(false);
    expect(isUserPrompt('[AI] Analyzing...')).toBe(false);
  });
});

describe('isSuccessMessage', () => {
  it('passed を含むメッセージを認識する', () => {
    expect(isSuccessMessage('All tests passed')).toBe(true);
    expect(isSuccessMessage('Validation passed')).toBe(true);
  });

  it('success を含むメッセージを認識する', () => {
    expect(isSuccessMessage('Build successful')).toBe(true);
    expect(isSuccessMessage('Task completed with success')).toBe(true);
  });

  it('✅ で始まるメッセージを認識する', () => {
    expect(isSuccessMessage('✅ All checks passed')).toBe(true);
  });

  it('通常のログメッセージを成功として認識しない', () => {
    expect(isSuccessMessage('Tool: Read completed')).toBe(false);
    expect(isSuccessMessage('Processing...')).toBe(false);
  });
});
