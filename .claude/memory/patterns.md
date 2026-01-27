# 再利用可能パターン

## プロジェクト固有パターン

### P001: Chrome Extension メッセージ通信
```typescript
// Background → Side Panel / Popup
chrome.runtime.sendMessage({ type: "EVENT_TYPE", payload: data });

// Side Panel / Popup → Background
chrome.runtime.sendMessage({ type: "REQUEST_TYPE" }, (response) => { ... });
```

### P002: WebSocket イベント形式
```typescript
interface WSEvent {
  type: "task.started" | "task.log" | "task.need_input" | "task.done" | "task.error";
  taskId: string;
  timestamp: string;
  data: Record<string, unknown>;
}
```

### P003: Daemon REST エンドポイント
```
POST /agent/start      → タスク開始通知
POST /agent/log        → ログ出力
POST /agent/need-input → 入力要求
POST /agent/done       → タスク完了
GET  /health           → ヘルスチェック
```

## 命名規則

- コンポーネント: PascalCase（`TaskCompleteModal.tsx`）
- フック: camelCase with `use` prefix
- 型定義: `src/shared/types.ts`
- パスエイリアス: `@/*` → `extension/src/*`
