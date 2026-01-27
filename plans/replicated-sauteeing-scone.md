# FocusFlow 実装プラン

## 概要

Chrome拡張 + ローカルDaemon による「ながら開発OS」を構築する。
開発の待ち時間に別サイト閲覧を許容しつつ、入力が必要な瞬間・完了時に自動で開発タブへ復帰させる。

## 参照ドキュメント

- `implement_design.md` - 詳細仕様書（20セクション）
- `screen_image/` - UI理想図（4画面）
- `Plans.md` - タスク詳細リスト

---

## Phase 1: プロジェクト基盤セットアップ

### 1.1 モノレポ構造作成

```
FocusFlow/
├── extension/          # Chrome拡張
│   ├── src/
│   │   ├── background/
│   │   ├── sidepanel/
│   │   ├── popup/
│   │   ├── options/
│   │   └── shared/
│   ├── manifest.json
│   ├── vite.config.ts
│   └── package.json
├── daemon/             # ローカル常駐サーバー
│   ├── src/
│   │   ├── server/
│   │   ├── task/
│   │   └── types/
│   └── package.json
├── package.json        # ワークスペース設定
└── tsconfig.base.json
```

### 1.2 作成ファイル一覧

| ファイル | 内容 |
|---------|------|
| `package.json` | pnpm workspaces 設定 |
| `tsconfig.base.json` | 共通TypeScript設定 |
| `extension/manifest.json` | MV3 マニフェスト |
| `extension/vite.config.ts` | Chrome拡張ビルド設定 |
| `extension/tailwind.config.js` | Tailwind設定 |
| `daemon/package.json` | Daemon依存関係 |
| `daemon/tsconfig.json` | Daemon TS設定 |

### 1.3 依存関係

**extension/**:
- vite, @crxjs/vite-plugin
- react, react-dom
- typescript
- tailwindcss, postcss, autoprefixer

**daemon/**:
- express
- ws (WebSocket)
- typescript, ts-node

---

## Phase 2: Daemon 基本実装

### 2.1 HTTP API

| Endpoint | Method | 機能 |
|----------|--------|------|
| `/health` | GET | ヘルスチェック |
| `/repos` | GET | リポジトリ一覧 |
| `/tasks` | POST | タスク作成 |
| `/tasks/:id/cancel` | POST | タスク中止 |
| `/tasks/:id/choice` | POST | 選択肢送信 |

### 2.2 WebSocket イベント

| イベント | トリガー |
|---------|---------|
| `task.started` | タスク開始時 |
| `task.log` | ログ出力時 |
| `task.need_input` | 入力要求時 |
| `task.done` | タスク完了時 |
| `task.error` | エラー発生時 |

### 2.3 作成ファイル

- `daemon/src/server/index.ts` - Express + WebSocket サーバー
- `daemon/src/task/TaskManager.ts` - タスク管理
- `daemon/src/task/TaskRunner.ts` - CLI実行
- `daemon/src/types/index.ts` - 型定義

---

## Phase 3: Chrome拡張 Background

### 作成ファイル

- `extension/src/background/index.ts` - Service Worker
- `extension/src/background/websocket.ts` - WebSocket クライアント
- `extension/src/background/storage.ts` - chrome.storage 管理
- `extension/src/background/notifications.ts` - 通知機能
- `extension/src/shared/types.ts` - 共有型定義

---

## Phase 4: Side Panel UI

### コンポーネント構成

```
SidePanel/
├── App.tsx
├── components/
│   ├── Header.tsx          # 接続状態、ブランチ表示
│   ├── TaskInput.tsx       # プロンプト入力、プリセット
│   ├── TerminalOutput.tsx  # ログ表示
│   └── HomeButton.tsx      # ホームタブ設定
└── hooks/
    └── useWebSocket.ts
```

### 作成ファイル

- `extension/src/sidepanel/index.html`
- `extension/src/sidepanel/main.tsx`
- `extension/src/sidepanel/App.tsx`
- 上記コンポーネント各種

---

## Phase 5-6: need_input / done 機能

### need_input モーダル

- `ActionRequiredModal.tsx` - diff表示、Apply/Skip ボタン

### done モーダル

- `TaskCompleteModal.tsx` - カウントダウン、キャンセル

### 自動復帰ロジック

- `extension/src/background/focusManager.ts`
  - 脱線ドメイン判定
  - カウントダウン管理
  - クールダウン管理
  - chrome.tabs/windows API 呼び出し

---

## Phase 7-8: Options / Popup

### Options 画面

- サイドバー: Focus Rules, Timer Config, Blocklist, General Settings
- Focus Settings セクション
- Distraction Domains セクション

### Popup

- 接続状態
- モード切替（Quiet/Normal/Force）
- 現在タスク状態

---

## 実装順序（並列化考慮）

```
[Parallel Group 1]
├── extension/package.json + vite.config.ts
├── daemon/package.json + tsconfig.json
└── root package.json + tsconfig.base.json

[Sequential]
└── pnpm install

[Parallel Group 2]
├── daemon/src/server/index.ts
├── daemon/src/types/index.ts
└── extension/manifest.json

[Sequential]
└── daemon/src/task/TaskManager.ts

[Parallel Group 3]
├── extension/src/background/index.ts
├── extension/src/sidepanel/App.tsx
└── extension/src/shared/types.ts

...以降、依存関係に基づき並列/順次実行
```

---

## 検証方法

### Phase 1 完了時

```bash
cd extension && pnpm build  # Chrome拡張ビルド成功
cd daemon && pnpm build     # Daemon ビルド成功
```

### Phase 2 完了時

```bash
cd daemon && pnpm start
curl http://localhost:3000/health  # { "ok": true }
```

### Phase 4 完了時

1. Chrome に拡張をロード
2. Side Panel を開く
3. Connected 状態を確認
4. ログがリアルタイム表示されることを確認

### Phase 5-6 完了時

1. need_input イベント発行 → Action Required モーダル表示
2. 脱線サイト閲覧中に done → カウントダウン → 自動復帰
3. キャンセルボタン → 復帰しない
4. クールダウン中 → 復帰しない（強調のみ）

---

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| Chrome拡張 | TypeScript + React + Vite |
| スタイル | Tailwind CSS |
| Daemon | Node.js + Express + ws |
| ビルド | pnpm workspaces |

---

## 次のアクション

`/work` で Phase 1 から実装開始
