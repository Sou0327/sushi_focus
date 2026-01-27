# FocusFlow（仮） 仕様書（Chrome拡張 + ローカル常駐Daemon）

開発者がローカルでエージェント（Claude Code CLI 等）を動かしつつ、ビルド/生成/テストの待ち時間は Netflix / TikTok など別サイトを見てOK。  
**「入力が必要になった瞬間」や「完了した瞬間」にだけ、開発タブへ自然に復帰させる**ことで、開発の手を止めない“ながら開発OS”を提供する。

---

## 1. 目的 / コンセプト

### 目的

- 開発中の待ち時間（生成・ビルド・テスト）で別サイト閲覧を許容しながら、**必要な瞬間に確実に開発へ戻す**
- 選択待ちでタスクが止まる、完了を見逃す、SNSで脱線して戻れない…を根本解消

### コア価値

- **Side Panel 常駐の進捗表示**
- **入力が必要なときは必ず戻す**
- **完了したときも戻す（ただし脱線中のみ）**
- **戻し方は“うざくならない設計”**（カウントダウン + キャンセル + クールダウン）

---

## 2. 対象ユーザー

- ローカルで開発する個人開発者 / エンジニア
- エージェント（Claude Code / 他CLI）による修正・テスト・生成を多用する層

---

## 3. スコープ

### MVPに含める

- Chrome拡張（Side Panel / Popup / Options / Background）
- ローカル常駐Daemon（HTTP + WebSocket）
- タスク実行（CLI spawn）
- ログのリアルタイムストリーミング
- `need_input`（入力要求）での自動復帰
- `done`（完了）での自動復帰（脱線中のみ + 1.5秒カウントダウン + キャンセル）
- `done` の戻しクールダウン（初期45秒）
- ホームタブ登録（戻り先固定）

### 今回は後回し（v1以降）

- diff のリッチプレビュー
- git commit / PR作成
- タスク履歴検索
- 自動要約の高度化
- フルスクリーン/別アプリ最前面の強制復帰最適化

---

## 4. システム構成（アーキテクチャ）

### コンポーネント

1. **Chrome拡張**

- Side Panel：常駐UI（メイン）
- Popup：最小操作（モード切替・接続状態）
- Options：設定（ドメインリスト・戻し挙動）
- Background (Service Worker)：通知・タブ制御・状態保持

2. **ローカル常駐Daemon**

- HTTP API：タスク作成、選択肢送信、状態取得
- WebSocket：ログ/状態イベントのリアルタイム配信
- CLI 実行：child_process で agent CLI を spawn

### 通信

- 拡張 → Daemon：HTTP（タスク作成/キャンセル/選択）
- Daemon → 拡張：WebSocket（ログ/状態/割り込みイベント）

---

## 5. 動作モード（ユーザー設定）

ユーザーが「どれくらい強く戻すか」を選べる。

### モード種類

- **静か（Quiet）**：通知のみ（タブ復帰なし）
- **普通（Normal）**：通知 + Side Panel強調（タブ復帰なし）
- **強制（Force）**：通知 + **ホームタブへ復帰**

> **本仕様での“自動復帰”は Force モード時のみ実行**  
> Quiet/Normal は通知・パネル強調で対応

---

## 6. 自動復帰（フォーカス）仕様

### 6.1 戻るトリガー（確定）

1. **`need_input`（入力が必要）**

- **常に戻す（最優先）**
- すぐ復帰（カウントダウン無し）

2. **`done`（完了）**

- **脱線サイト閲覧中のみ戻す**
- **1.5秒カウントダウン → 復帰**
- カウントダウン中はキャンセル可能

---

## 6.2 脱線サイト判定（doneのみ適用）

### デフォルト脱線ドメイン一覧（Optionsで編集可）

- netflix.com
- tiktok.com
- youtube.com
- x.com
- twitter.com
- instagram.com
- twitch.tv
- reddit.com

### 判定ロジック

- 現在アクティブタブの URL の hostname が `distractionDomains[]` に一致（または末尾一致）したら脱線中
- 例：`www.youtube.com` → `youtube.com` として一致扱い

---

## 6.3 done 復帰の “うざくならない制御”

### カウントダウン（確定）

- done受信時、脱線中かつクールダウン外なら
- Side Panel にオーバーレイ表示：
  - 「完了しました！1.5秒後に戻ります…」
  - 「キャンセル」ボタン
- 1.5秒経過後に復帰実行

### キャンセル挙動（確定）

- **キャンセルされたタスクIDは、そのタスク中 `done` による自動復帰を無効化**
- 以降は通知 + Side Panel強調のみ

（任意・v1）

- 「5分スヌーズ」も追加可能

---

## 6.4 クールダウン（連発防止）

### 初期値（確定）

- `done` 復帰が発生した後、**45秒間は次のdone復帰を抑制**
- 抑制中のdoneは
  - 通知 + Side Panel点滅（強調）のみ
  - 復帰はしない

### 設定可能項目

- 30 / 45 / 60 / 120 秒 等

---

## 6.5 戻り先（ホームタブ）固定

### ホームタブ方式（確定）

- Side Panel に「**このタブをホームにする**」ボタン
- 押した時点の `homeTabId` と `homeWindowId` を保存
- 自動復帰は **常にホームへ戻す**

### 例外

- すでにホームタブがアクティブなら復帰しない（通知・強調のみ）

---

## 6.6 タブ復帰の実装仕様（Chrome API）

Forceモードで実行する復帰処理：

1. ホームタブをアクティブ化

- `chrome.tabs.update(homeTabId, { active: true })`

2. ホームのウィンドウをフォーカス

- `chrome.windows.update(homeWindowId, { focused: true })`

> OSの制約により、Chromeが非アクティブ（別アプリ最前面）時に100%前面化できない場合がある  
> その場合でも **通知 + Side Panel** で成立する設計にする

---

## 7. 画面仕様（UI）

### 7.1 Side Panel（メイン）

#### A) ヘッダー

- 接続状態：Connected / Offline
- タスク状態：Idle / Running / Waiting Input / Done / Error
- 対象Repo / ブランチ（表示可能なら）

#### B) 実行パネル

- プロンプト入力欄（「このエラー直して」「テスト回して」等）
- `Run` ボタン
- プリセット（MVPは3つ）
  - 修正（Fix）
  - テスト（Test）
  - リファクタ（Refactor）

#### C) 進捗ログ領域

- リアルタイムログ表示（最新が下に追加）
- “要点だけ”トグル（MVPでは単なるフィルタでも可）

#### D) need_input パネル（Waiting Input時のみ表示）

- 質問文
- 選択肢ボタン（A/B/C 等）
- 「追加案を出す」
- 「中止」

#### E) done オーバーレイ（条件成立時のみ）

- ✅ 完了サマリー
- 1.5秒カウントダウン表示
- 「キャンセル」

---

### 7.2 Popup（最小）

- 接続状態（daemon alive?）
- モード切替（Quiet / Normal / Force）
- 現在タスクの状態（1行）

---

### 7.3 Options（設定）

#### 戻し設定

- need_input で戻す（固定ON）
- done で戻す（ON/OFF）
- done は脱線サイトのときだけ戻す（固定ON：今回方針）
- done カウントダウン秒数（初期1.5）
- done クールダウン（初期45）

#### 脱線サイト一覧

- ドメイン追加/削除（テキストリスト）

---

## 8. 状態遷移（Task Lifecycle）

Idle
↓ Run
Running
├─ task.need_input → WaitingInput
│ ↓ choice
│ Running
├─ task.done → Done → Idle
└─ task.error → Error → Idle

---

## 9. Daemon（ローカル常駐）要件

### 9.1 必須機能

- エージェントCLIを spawn して実行する
- stdout/stderr を取り込み WebSocket に流す
- 状態遷移管理（running / waiting_input / done / error）
- タスク作成/キャンセル/選択肢入力の受付

### 9.2 CLI実行

- Node.js で `child_process.spawn()` を基本とする
- CLI名は抽象化（例：`agentCommand`）
- repoPath 上で実行できること

---

## 10. API仕様（HTTP）

### `GET /health`

- Daemon稼働確認
- Response: `{ ok: true, version: "x.y.z" }`

### `GET /repos`（任意）

- 登録済みRepo一覧
- Response: `[{ repoId, name, path }]`

### `POST /tasks`

- タスク作成
- Body:

  ```json
  { "repoId": "r1", "prompt": "テスト回して", "mode": "normal" }
  ```

- Response:

  ```json
  { "taskId": "t_123" }
  ```

### `POST /tasks/:id/cancel`

- タスク中止
- Response:

  ```json
  { "ok": true }
  ```

### `POST /tasks/:id/choice`

- 入力要求への回答
- Body:

  ```json
  { "choiceId": "apply" }
  ```

- Response:

  ```json
  { "ok": true }
  ```

---

## 11. イベント仕様（WebSocket /ws）

### `task.started`

```json
{ "type": "task.started", "taskId": "t_123", "repoId": "r1" }
```

### `task.log`

```json
{ "type": "task.log", "taskId": "t_123", "level": "info", "message": "Running..." }
```

### `task.need_input`

```json
{
  "type": "task.need_input",
  "taskId": "t_123",
  "question": "この修正を適用しますか？",
  "choices": [
    { "id": "apply", "label": "適用する" },
    { "id": "skip", "label": "スキップ" }
  ]
}
```

### `task.done`

```json
{
  "type": "task.done",
  "taskId": "t_123",
  "summary": "修正完了。3ファイル変更。テスト未実行。",
  "meta": { "changedFiles": 3, "tests": "not_run" }
}
```

### `task.error`

```json
{
  "type": "task.error",
  "taskId": "t_123",
  "message": "Tests failed",
  "details": "..."
}
```

---

## 12. データモデル

### Task

- `id`: string
- `repoId`: string
- `prompt`: string
- `status`: `"idle"` | `"running"` | `"waiting_input"` | `"done"` | `"error"`
- `createdAt`: number
- `updatedAt`: number
- `logs`: `{level, message, ts}[]`（保持は最新100行程度でOK）
- `summary?`: string
- `autoFocusDisabled?`: boolean（このタスク中done復帰を無効化）

### Repo

- `repoId`: string
- `name`: string
- `path`: string
- `defaultBranch?`: string

---

## 13. 拡張の設定保存（chrome.storage）

### 保存項目

- `mode`: `"quiet"` | `"normal"` | `"force"`
- `homeTabId`: number
- `homeWindowId`: number
- `enableDoneFocus`: boolean
- `doneCountdownMs`: number（初期1500）
- `doneCooldownMs`: number（初期45000）
- `distractionDomains`: string[]

---

## 14. 権限 / Manifest（MV3）

### permissions

- `tabs`
- `windows`
- `notifications`
- `storage`
- `sidePanel`

### host_permissions

- `http://127.0.0.1:*/*`
- `http://localhost:*/*`

---

## 15. 通知仕様

### 通知対象

- `need_input`：必ず通知
- `done`：通知（常に）
- `error`：通知（常に）

### 通知内容（例）

- `need_input`：🟡 入力が必要：◯◯
- `done`：✅ 完了：◯◯
- `error`：🔴 失敗：◯◯

---

## 16. 自動復帰ロジック（拡張側アルゴリズム）

### need_input

1. 通知を出す
2. Forceモードなら即ホームへ復帰
3. Side Panelに選択肢UI表示

### done

1. 通知を出す
2. Forceモードでなければ終了（通知/強調のみ）
3. クールダウン内なら復帰しない（強調のみ）
4. 現在アクティブタブURLを取得
5. 脱線ドメインでなければ復帰しない（強調のみ）
6. カウントダウン開始（1.5秒）
7. キャンセルされなければホームへ復帰
8. 復帰したらクールダウン開始

---

## 17. エッジケース / 例外処理

- **ホームタブ未設定：**
  - 復帰はしない（通知 + Side Panel強調のみ）
  - Side Panelに「ホームタブ未設定」表示

- **Daemon未起動：**
  - 接続状態を Offline 表示
  - `/health` 再試行（一定間隔）

- **WebSocket切断：**
  - 自動再接続（指数バックオフ）

- **タスク中にユーザーが手動でホームタブを閉じた：**
  - `homeTabId` を無効化し復帰停止

- **OS/ブラウザ制限で前面化できない：**
  - 通知 + Side Panelで代替（機能は成立）

---

## 18. セキュリティ要件

- Daemonは `127.0.0.1` のみ listen（外部公開しない）
- 拡張の host permissions は localhost のみに限定
- 認証（MVPでは省略可、将来トークンで保護も検討）
- ログの保存は最小限（必要ならユーザーが明示的に保存）

---

## 19. 受け入れ基準（Acceptance Criteria）

- Side Panelが常時表示でき、タスク実行ログがリアルタイムに流れる
- `need_input` を受信したら通知が出て、Forceモードならホームタブへ復帰する
- `done` を受信したら通知が出る
- `done` は 脱線ドメイン閲覧中のみ、Forceモードで 1.5秒後にホームタブへ復帰する
- `done` 復帰は 45秒クールダウンで連発しない
- `done` カウントダウンは キャンセルでき、キャンセルしたタスク中は done復帰しない
- ホームタブ未設定/閉鎖時は復帰せず通知で成立する

---

## 20. 実装優先度（MVP作成順）

1. Daemon：`/health` + `/ws` + ダミーイベント
2. Side Panel：接続表示 + ログ表示
3. `need_input`：選択UI + 通知
4. ホームタブ登録 + storage保存
5. Force復帰（`need_input`）
6. `done` 復帰（脱線判定 + 1.5秒カウントダウン + キャンセル + クールダウン）
7. Options：脱線ドメイン編集 + クールダウン変更
