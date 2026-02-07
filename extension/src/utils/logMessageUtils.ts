/**
 * ログメッセージの種類を判定するユーティリティ関数
 */

import { SYNTHETIC_LOG_MARKER } from '@/shared/constants';

/**
 * AI からのメッセージかどうかを判定
 */
export function isAIMessage(message: string): boolean {
  return message.includes('[AI]') || message.includes('Analyzing') || message.includes('Identified');
}

/**
 * ユーザープロンプトかどうかを判定
 */
export function isUserPrompt(message: string): boolean {
  return message.startsWith('[USER] ');
}

/**
 * 成功メッセージかどうかを判定
 * Handles both regular and synthetic (marker-prefixed) success logs
 */
export function isSuccessMessage(message: string): boolean {
  // Strip synthetic marker if present before checking
  const normalized = message.startsWith(SYNTHETIC_LOG_MARKER) ? message.slice(1) : message;
  return normalized.includes('passed') || normalized.includes('success') || normalized.startsWith('✅');
}

/**
 * エラーメッセージかどうかを判定
 * Handles both regular and synthetic (marker-prefixed) error logs
 */
export function isErrorMessage(message: string): boolean {
  // Strip synthetic marker if present before checking
  const normalized = message.startsWith(SYNTHETIC_LOG_MARKER) ? message.slice(1) : message;
  return normalized.startsWith('❌');
}
