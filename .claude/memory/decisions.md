# 技術的意思決定記録

## Decision Log

### D001: モノレポ構成（pnpm workspaces）
- **日付**: 2025-01-26
- **決定**: extension/ と daemon/ を pnpm workspaces で管理
- **理由**: 共通の型定義を共有しつつ、独立したビルド・依存を維持

### D002: Chrome Extension MV3 + Side Panel
- **日付**: 2025-01-26
- **決定**: Manifest V3、Side Panel をメインUI、Popup は最小モード切替
- **理由**: MV3 は Chrome の推奨、Side Panel は常時表示に最適

### D003: Daemon 通信方式
- **日付**: 2025-01-26
- **決定**: REST（HTTP POST）でイベント受信、WebSocket でリアルタイム配信
- **理由**: CLI からは HTTP POST が簡単、拡張機能へはリアルタイム配信が必要
