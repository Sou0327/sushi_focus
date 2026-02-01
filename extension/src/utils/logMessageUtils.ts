/**
 * ログメッセージの種類を判定するユーティリティ関数
 */

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
 */
export function isSuccessMessage(message: string): boolean {
  return message.includes('passed') || message.includes('success') || message.startsWith('✅');
}
