# FocusFlow 実装プラン

## 🎯 Project: FocusFlow

### Overview

- **Purpose**: 開発中の待ち時間で別サイト閲覧を許容しながら、入力が必要な瞬間・完了時に開発タブへ自動復帰させる
- **Target**: ローカルでエージェント（Claude Code CLI等）を使う個人開発者・エンジニア
- **Reference**: なし（オリジナルコンセプト）
- **Scope**: MVP（基本機能の実装）

### Tech Stack

- **Chrome拡張**: TypeScript + React + Vite
- **Daemon**: Node.js + Express + ws（WebSocket）
- **ビルド**: Vite (Chrome Extension)
- **UI**: Tailwind CSS

### 設計ドキュメント

- `implement_design.md` - 詳細仕様書
- `screen_image/` - UI理想図

---

## 🔴 Phase 1: プロジェクト基盤セットアップ `cc:TODO`

### 1.1 プロジェクト構造作成

- [ ] モノレポ構造の作成（extension/ + daemon/）
- [ ] package.json 初期化（ワークスペース設定）
- [ ] TypeScript設定（tsconfig.json）
- [ ] ESLint + Prettier 設定
- [ ] Git init & .gitignore

### 1.2 Chrome拡張プロジェクト初期化 `[feature:a11y]`

- [ ] Vite + React + TypeScript セットアップ
- [ ] manifest.json (MV3) 作成
  - permissions: tabs, windows, notifications, storage, sidePanel
  - host_permissions: localhost
- [ ] Tailwind CSS セットアップ
- [ ] ディレクトリ構造作成
  - src/background/
  - src/sidepanel/
  - src/popup/
  - src/options/
  - src/shared/

### 1.3 Daemon プロジェクト初期化

- [ ] Node.js + TypeScript セットアップ
- [ ] Express + ws (WebSocket) 依存追加
- [ ] ディレクトリ構造作成
  - src/server/
  - src/task/
  - src/types/

---

## 🟡 Phase 2: Daemon 基本実装 `cc:TODO`

### 2.1 HTTP API 基盤 `[feature:tdd]`

#### テストケース設計

| Test Case | Input | Expected Output | Notes |
|-----------|-------|-----------------|-------|
| GET /health 正常 | - | `{ ok: true, version: "0.1.0" }` | ヘルスチェック |
| GET /repos 正常 | - | `[{ repoId, name, path }]` | リポジトリ一覧 |
| POST /tasks 正常 | `{ repoId, prompt, mode }` | `{ taskId: "t_xxx" }` | タスク作成 |
| POST /tasks 不正入力 | `{}` | 400エラー | バリデーション |
| POST /tasks/:id/cancel | taskId | `{ ok: true }` | タスク中止 |
| POST /tasks/:id/choice | `{ choiceId }` | `{ ok: true }` | 選択肢送信 |

#### 実装タスク

- [ ] Express サーバー基盤作成
- [ ] GET /health エンドポイント
- [ ] GET /repos エンドポイント（設定ファイル読み込み）
- [ ] POST /tasks エンドポイント
- [ ] POST /tasks/:id/cancel エンドポイント
- [ ] POST /tasks/:id/choice エンドポイント

### 2.2 WebSocket サーバー `[feature:tdd]`

#### テストケース設計

| Test Case | Input | Expected Output | Notes |
|-----------|-------|-----------------|-------|
| 接続確立 | ws://localhost:3000/ws | connection event | WebSocket接続 |
| task.started イベント | タスク開始 | `{ type: "task.started", ... }` | |
| task.log イベント | ログ出力 | `{ type: "task.log", ... }` | |
| task.need_input イベント | 入力要求 | `{ type: "task.need_input", ... }` | |
| task.done イベント | タスク完了 | `{ type: "task.done", ... }` | |
| task.error イベント | エラー発生 | `{ type: "task.error", ... }` | |

#### 実装タスク

- [ ] WebSocket サーバー初期化（ws ライブラリ）
- [ ] クライアント接続管理
- [ ] イベント配信機能（broadcast）
- [ ] 型定義（WebSocketイベント型）

### 2.3 タスク実行エンジン

- [ ] Task データモデル実装
- [ ] CLI spawn 機能（child_process）
- [ ] stdout/stderr キャプチャ → WebSocket配信
- [ ] 状態遷移管理（idle → running → waiting_input/done/error）
- [ ] ダミーイベント生成（テスト用）

---

## 🟡 Phase 3: Chrome拡張 Background Service Worker `cc:TODO`

### 3.1 Service Worker 基盤 `[feature:security]`

- [ ] Background script エントリーポイント作成
- [ ] WebSocket クライアント接続
- [ ] 接続状態管理（Connected / Offline）
- [ ] 自動再接続（指数バックオフ）

### 3.2 chrome.storage 管理

- [ ] 設定スキーマ定義
  - mode: "quiet" | "normal" | "force"
  - homeTabId, homeWindowId
  - enableDoneFocus
  - doneCountdownMs (default: 1500)
  - doneCooldownMs (default: 45000)
  - distractionDomains[]
- [ ] 設定読み書きユーティリティ

### 3.3 通知機能

- [ ] chrome.notifications API ラッパー
- [ ] need_input 通知（🟡 入力が必要）
- [ ] done 通知（✅ 完了）
- [ ] error 通知（🔴 失敗）

---

## 🟡 Phase 4: Side Panel UI 実装 `cc:TODO`

### 4.1 Side Panel 基盤 `[feature:a11y]`

- [ ] Side Panel HTML/React エントリーポイント
- [ ] Background との Message 通信
- [ ] 共通コンポーネント作成
  - StatusBadge (Connected/Offline/Running/etc.)
  - Button
  - Input

### 4.2 ヘッダーコンポーネント

- [ ] 接続状態表示（緑●CONNECTED / 赤●OFFLINE）
- [ ] "FocusFlow Daemon" タイトル
- [ ] ブランチ表示（feat/xxx）

### 4.3 実行パネルコンポーネント

- [ ] プロンプト入力欄（textarea）
- [ ] Run ボタン（▶）
- [ ] 画像添付アイコン（任意）
- [ ] プリセットボタン
  - 🐛 Fix Bug
  - 🧪 Run Tests
  - 🔄 Refactor

### 4.4 ターミナル出力コンポーネント

- [ ] TERMINAL OUTPUT セクション
- [ ] タイムスタンプ付きログ表示
- [ ] ログレベル別カラーリング
  - INFO: 白
  - AI: 緑（🤖）
  - SUCCESS: 緑
  - WARN: 黄
  - ERROR: 赤
- [ ] 自動スクロール

### 4.5 ホームタブ設定

- [ ] 「Set current tab as Home」ボタン
- [ ] 現在のタブをホームとして保存
- [ ] ホーム設定済み状態の表示

---

## 🟡 Phase 5: need_input 機能実装 `cc:TODO`

### 5.1 Action Required モーダル `[feature:a11y]`

- [ ] モーダルオーバーレイコンポーネント
- [ ] ヘッダー: "Action Required" + 質問文
- [ ] diff プレビュー表示
  - ファイル名
  - 変更行ハイライト（緑: 追加）
- [ ] ボタン群
  - ✓ Apply（青）
  - ▶ Skip（グレー）
  - Cancel Task（赤テキスト）
- [ ] SESSION PROGRESS バー（Paused状態）

### 5.2 自動復帰ロジック（need_input）`[feature:tdd]`

#### テストケース設計

| Test Case | Input | Expected Output | Notes |
|-----------|-------|-----------------|-------|
| Forceモード + need_input | need_input イベント | ホームタブに復帰 | 即座に復帰 |
| Normalモード + need_input | need_input イベント | 通知のみ | 復帰しない |
| Quietモード + need_input | need_input イベント | 通知のみ | 復帰しない |
| ホームタブ未設定 | need_input イベント | 通知 + パネル強調 | 復帰しない |

#### 実装タスク

- [ ] need_input イベントハンドラ
- [ ] chrome.tabs.update による復帰
- [ ] chrome.windows.update によるフォーカス
- [ ] 通知発行

### 5.3 選択肢送信

- [ ] Apply/Skip クリック → POST /tasks/:id/choice
- [ ] Cancel Task → POST /tasks/:id/cancel
- [ ] モーダル閉じる → タスク状態更新

---

## 🟡 Phase 6: done 復帰機能実装 `cc:TODO`

### 6.1 Task Complete モーダル `[feature:a11y]`

- [ ] モーダルコンポーネント（グラデーションボーダー）
- [ ] チェックマークアイコン（緑）
- [ ] "Task Complete!" メッセージ
- [ ] "Returning to Home tab in X.Xs..." カウントダウン
- [ ] 「✋ Stay Here (Cancel)」ボタン
- [ ] "Press Esc to cancel" ヒント

### 6.2 脱線ドメイン判定 `[feature:tdd]`

#### テストケース設計

| Test Case | Input | Expected Output | Notes |
|-----------|-------|-----------------|-------|
| youtube.com | アクティブタブURL | true | 脱線判定 |
| www.youtube.com | アクティブタブURL | true | サブドメイン対応 |
| netflix.com | アクティブタブURL | true | |
| github.com | アクティブタブURL | false | 開発サイト |
| localhost | アクティブタブURL | false | ローカル開発 |
| カスタムドメイン追加 | 設定変更後 | 判定に反映 | |

#### 実装タスク

- [ ] 脱線ドメインリスト管理
- [ ] ホスト名抽出・マッチング関数
- [ ] アクティブタブURL取得

### 6.3 カウントダウン・復帰ロジック `[feature:tdd]`

#### テストケース設計

| Test Case | Condition | Expected Behavior | Notes |
|-----------|-----------|-------------------|-------|
| 正常復帰 | Force + 脱線中 + クールダウン外 | 1.5秒後に復帰 | |
| キャンセル | カウントダウン中にキャンセル | 復帰しない | |
| クールダウン中 | 前回復帰から45秒以内 | 復帰しない（強調のみ）| |
| 非脱線サイト | 開発サイト閲覧中 | 復帰しない | |
| Normalモード | mode = normal | 復帰しない（通知のみ）| |
| ホームタブアクティブ | 既にホームタブ | 復帰しない | |

#### 実装タスク

- [ ] done イベントハンドラ
- [ ] カウントダウンタイマー（1.5秒デフォルト）
- [ ] キャンセル処理（タスクIDごとに無効化フラグ）
- [ ] クールダウンタイマー管理（45秒デフォルト）
- [ ] 復帰実行（chrome.tabs/windows API）

---

## 🟢 Phase 7: Options 画面実装 `cc:TODO`

### 7.1 Options ページ基盤 `[feature:a11y]`

- [ ] Options HTML/React エントリーポイント
- [ ] サイドバーナビゲーション
  - Focus Rules
  - Timer Config
  - Blocklist
  - General Settings
- [ ] ヘッダー: Settings > Focus Behavior

### 7.2 Focus Settings セクション

- [ ] Focus Behavior
  - Auto-return to IDE（トグル）
  - AI Gen Blocking（トグル）
- [ ] Cooldown & Timing
  - RETURN COUNTDOWN（数値入力 + "seconds"）
  - FOCUS COOLDOWN（数値入力 + "minutes"）

### 7.3 Distraction Domains セクション

- [ ] ドメイン追加フォーム（入力 + "+ Add"ボタン）
- [ ] BLOCKED LIST
  - ドメインタグ表示（× で削除可能）
  - デフォルト: youtube.com, x.com, reddit.com, facebook.com 等
- [ ] Reset Defaults ボタン
- [ ] Save Changes ボタン

### 7.4 Daemon状態表示

- [ ] 左下: Daemon Active / Inactive バッジ
- [ ] バージョン表示（v0.1.0）
- [ ] localhost:3000 表示

---

## 🟢 Phase 8: Popup 実装（最小）`cc:TODO`

### 8.1 Popup UI `[feature:a11y]`

- [ ] Popup HTML/React エントリーポイント
- [ ] 接続状態表示（Connected / Offline）
- [ ] モード切替ボタン
  - Quiet
  - Normal
  - Force
- [ ] 現在タスク状態（1行）

---

## 🔵 Phase 9: 仕上げ `cc:TODO`

### 9.1 エラーハンドリング強化

- [ ] WebSocket切断時の自動再接続
- [ ] ホームタブ閉鎖時の graceful degradation
- [ ] Daemon未起動時のUI表示

### 9.2 ビルド・パッケージング

- [ ] Chrome拡張ビルドスクリプト
- [ ] Daemon起動スクリプト
- [ ] README.md 作成

### 9.3 テスト

- [ ] 手動テストシナリオ実行
- [ ] エッジケース確認
  - ホームタブ未設定
  - WebSocket切断
  - クールダウン連発防止

### 9.4 レビュー

- [ ] `/harness-review` によるコードレビュー
- [ ] セキュリティチェック（127.0.0.1のみlistenなど）

---

## 📊 工数見積もり（参考）

| Phase | 内容 | 見積もり |
|-------|------|---------|
| Phase 1 | 基盤セットアップ | 0.5日 |
| Phase 2 | Daemon基本実装 | 1.5日 |
| Phase 3 | Background SW | 1日 |
| Phase 4 | Side Panel UI | 1.5日 |
| Phase 5 | need_input機能 | 1日 |
| Phase 6 | done復帰機能 | 1.5日 |
| Phase 7 | Options画面 | 1日 |
| Phase 8 | Popup | 0.5日 |
| Phase 9 | 仕上げ | 1日 |
| **合計** | | **約9.5日** |

---

## 📝 Notes

- Phase 1-4 が MVP の最小動作
- Phase 5-6 がコア価値（自動復帰）
- Phase 7-8 は設定・操作性向上
