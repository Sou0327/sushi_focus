# FocusFlow 🎯

Chrome拡張 + ローカルDaemon による「ながら開発OS」。
エディタでAIエージェント（Claude Code, Cursor等）が作業する間、別サイト閲覧を許容しつつ、入力が必要な瞬間・完了時に自動で開発タブへ復帰させる。

## アーキテクチャ

```
┌─────────────────┐     HTTP POST      ┌─────────────────┐    WebSocket    ┌─────────────────┐
│   Claude Code   │ ───────────────▶ │     Daemon      │ ───────────────▶ │  Chrome拡張     │
│   Cursor 等     │   /agent/start    │  localhost:3000 │  task.started   │  Side Panel     │
│                 │   /agent/log      │                 │  task.log       │  監視ダッシュボード │
│                 │   /agent/need-input│                │  task.need_input│                 │
│                 │   /agent/done     │                 │  task.done      │                 │
└─────────────────┘                   └─────────────────┘                 └─────────────────┘
```

**エディタで作業 → Daemonに通知 → 拡張が状態表示＆自動復帰**

## 前提条件

- **Node.js** 20以上
- **pnpm** 9以上（なければ `npm install -g pnpm` でインストール）
- **Google Chrome** ブラウザ

## クイックスタート

### Step 1: 依存関係のインストール

```bash
cd FocusFlow
pnpm install
```

### Step 2: ビルド

```bash
# Daemon（ローカルサーバー）をビルド
pnpm build:daemon

# Chrome拡張をビルド
pnpm build:extension
```

### Step 3: Daemonを起動

```bash
pnpm dev:daemon
```

以下のメッセージが表示されれば成功：

```text
╔═══════════════════════════════════════════════════════════╗
║                    FocusFlow Daemon                        ║
║                      v0.1.0                              ║
╠═══════════════════════════════════════════════════════════╣
║  HTTP API: http://127.0.0.1:3000                          ║
║  WebSocket: ws://127.0.0.1:3000/ws                        ║
╚═══════════════════════════════════════════════════════════╝
```

> **注意**: Daemonは別ターミナルで起動したままにしておいてください。

### Step 4: Chrome拡張をインストール

1. Chromeで `chrome://extensions` を開く
2. 右上の「**デベロッパーモード**」をONにする
3. 「**パッケージ化されていない拡張機能を読み込む**」をクリック
4. `FocusFlow/extension/dist` フォルダを選択
5. FocusFlowアイコンが追加されていることを確認

### Step 5: Side Panelを開く

1. Chromeのツールバーで FocusFlow アイコンをクリック
2. ポップアップが表示される
3. 「**Open Panel**」ボタンをクリック
4. 右側にSide Panelが開く

または、Chrome右上の「サイドパネル」アイコン（📋）から FocusFlow を選択。

### Step 6: ホームタブを設定

1. 開発で使うタブ（VSCode、ターミナルなど）を開く
2. Side Panelの「**Set as Home**」ボタンをクリック
3. このタブが「ホームタブ」として登録される

> ホームタブ = 入力待ち/完了時に自動で戻ってくるタブ

## 使い方

### エージェントからDaemonに通知

エディタ（Claude Code, Cursor等）の作業状況をDaemonに送信すると、拡張機能に表示されます。

#### curl で直接送信

```bash
# タスク開始
curl -X POST http://127.0.0.1:3000/agent/start \
  -H "Content-Type: application/json" \
  -d '{"taskId":"task-1","prompt":"Fix authentication bug"}'

# ログ出力
curl -X POST http://127.0.0.1:3000/agent/log \
  -H "Content-Type: application/json" \
  -d '{"taskId":"task-1","message":"Analyzing codebase..."}'

# 入力待ち（自動復帰トリガー）
curl -X POST http://127.0.0.1:3000/agent/need-input \
  -H "Content-Type: application/json" \
  -d '{"taskId":"task-1","question":"Which approach should I use?"}'

# タスク完了（自動復帰トリガー）
curl -X POST http://127.0.0.1:3000/agent/done \
  -H "Content-Type: application/json" \
  -d '{"taskId":"task-1","summary":"Fixed 3 files"}'
```

#### スクリプトを使用

```bash
# タスク開始
./scripts/focusflow-notify.sh start --prompt "Fix authentication bug"

# ログ出力
./scripts/focusflow-notify.sh log --message "Analyzing codebase..."

# 入力待ち
./scripts/focusflow-notify.sh need-input --question "Which approach?"

# 完了
./scripts/focusflow-notify.sh done --summary "Fixed 3 files"
```

### Claude Code との連携

1. `~/.claude/settings.json` にhooksを追加:

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -X POST http://127.0.0.1:3000/agent/log -H 'Content-Type: application/json' -d '{\"taskId\":\"claude\",\"message\":\"Notification\"}' > /dev/null 2>&1 || true"
          }
        ]
      }
    ]
  }
}
```

2. セッション開始時にタスク開始を通知:

```bash
curl -X POST http://127.0.0.1:3000/agent/start \
  -H "Content-Type: application/json" \
  -d '{"taskId":"claude","prompt":"Claude Code Session"}'
```

### 入力が必要な場合（need_input）

- エージェントが `/agent/need-input` を送信すると、モーダルが表示される
- Forceモードの場合、自動でホームタブに戻る

### タスク完了時（done）

- 脱線サイト（YouTube等）を見ている時に `/agent/done` が来ると：
  1. 1.5秒のカウントダウンが表示される
  2. 「Cancel」を押さなければ自動でホームタブに戻る
- 開発サイトを見ている時は通知のみ（自動復帰なし）

## Daemon API

### External Agent API（IDE連携用）

外部エージェント（Claude Code, Cursor等）からイベントを送信するためのエンドポイント。

| エンドポイント | メソッド | 説明 |
| -------------- | -------- | ---- |
| `/health` | GET | ヘルスチェック（`{ok, version, gitBranch}`） |
| `/agent/start` | POST | タスク開始 |
| `/agent/log` | POST | ログ出力 |
| `/agent/need-input` | POST | 入力待ち（自動復帰トリガー） |
| `/agent/done` | POST | タスク完了（自動復帰トリガー） |
| `/agent/cancel` | POST | タスクキャンセル |
| `/agent/progress` | POST | 進捗報告 |

#### リクエスト形式

```typescript
// POST /agent/start
{ taskId?: string, prompt: string, repoId?: string, image?: string }

// POST /agent/log
{ taskId: string, message: string, level?: "info" | "warn" | "error" | "debug" }

// POST /agent/need-input
{ taskId: string, question: string, choices?: { id: string, label: string }[] }

// POST /agent/done
{ taskId: string, summary?: string, filesModified?: number }

// POST /agent/cancel
{ taskId: string }

// POST /agent/progress
{ taskId: string, current: number, total: number, label?: string }
```

### Internal Task API（内部タスク管理）

Daemon内部でタスクを作成・管理するためのエンドポイント。

| エンドポイント | メソッド | 説明 |
| -------------- | -------- | ---- |
| `/tasks` | POST | タスク作成（`{repoId, prompt}`） |
| `/tasks/current` | GET | 現在のタスク取得 |
| `/tasks/:id/cancel` | POST | タスクキャンセル |
| `/tasks/:id/choice` | POST | 入力待ちへの選択肢送信（`{choiceId}`） |
| `/repos` | GET | リポジトリ一覧 |

### Focus Settings API（IDE自動フォーカス設定）

Daemon側でIDEウィンドウに自動フォーカスする機能の制御。`.env` で初期値設定。

| エンドポイント | メソッド | 説明 |
| -------------- | -------- | ---- |
| `/focus/settings` | GET | 現在のフォーカス設定取得 |
| `/focus/settings` | POST | フォーカス設定更新 |
| `/focus/now` | POST | 手動で即座にIDEにフォーカス |

```bash
# .env 設定例
FOCUS_ENABLED=true         # フォーカス機能の有効/無効
FOCUS_APP=Cursor           # フォーカス対象アプリ（Code, Cursor, Terminal, iTerm）
FOCUS_ON_NEED_INPUT=true   # need-input時に自動フォーカスするか
FOCUS_ON_DONE=true         # done時に自動フォーカスするか
```

### WebSocketイベント型

Daemonが `ws://127.0.0.1:3000/ws` を通じてブロードキャストするイベント。

```typescript
type DaemonEvent =
  | { type: 'task.started',    taskId: string, repoId: string, startedAt: number, hasImage?: boolean }
  | { type: 'task.log',        taskId: string, level: string, message: string }
  | { type: 'task.need_input', taskId: string, question: string, choices: {id: string, label: string}[] }
  | { type: 'task.done',       taskId: string, summary: string, meta?: { changedFiles?: number, tests?: string } }
  | { type: 'task.error',      taskId: string, message: string, details?: string }
  | { type: 'task.progress',   taskId: string, current: number, total: number, label?: string }
```

## モード設定

ポップアップまたはOptionsで切り替え可能：

| モード | 動作 |
| ------ | ---- |
| **Quiet** | 通知のみ（自動復帰なし） |
| **Normal** | 通知 + Side Panel強調（自動復帰なし） |
| **Force** | 通知 + 自動復帰（推奨） |

## 脱線ドメイン

以下のサイトを閲覧中にタスクが完了すると、自動復帰が発動します：

- netflix.com
- tiktok.com
- youtube.com
- x.com / twitter.com
- instagram.com
- twitch.tv
- reddit.com

Options画面（⚙️ Settings）から追加・削除可能。

## トラブルシューティング

### 「Offline」と表示される

Daemonが起動していない可能性があります：

```bash
# Daemonを起動
pnpm dev:daemon
```

### Side Panelが開かない

1. `chrome://extensions` で拡張を再読み込み
2. Chromeを再起動

### ビルドエラーが出る

```bash
# node_modulesを削除して再インストール
rm -rf node_modules extension/node_modules daemon/node_modules
pnpm install
pnpm build
```

## 開発者向け

### 開発モード

```bash
# Daemon（ホットリロード）
pnpm dev:daemon

# 拡張の変更後は手動リロード
# chrome://extensions で FocusFlow の🔄ボタンをクリック
```

### プロジェクト構造

```text
FocusFlow/
├── extension/          # Chrome拡張 (MV3)
│   ├── src/
│   │   ├── background/ # Service Worker
│   │   ├── sidepanel/  # 監視ダッシュボード
│   │   ├── popup/      # モード切替
│   │   ├── options/    # 設定画面
│   │   └── shared/     # 共有型定義
│   └── dist/           # ビルド出力
├── daemon/             # ローカル常駐サーバー
│   └── src/
│       ├── server/     # Express + WebSocket
│       └── task/       # タスク管理
├── scripts/            # 連携スクリプト
│   ├── focusflow-notify.sh    # 通知スクリプト
│   └── claude-code-hooks.json # Claude Code hooks例
└── package.json        # ワークスペース設定
```

## ライセンス

MIT
