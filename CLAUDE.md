# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FocusFlow is a Chrome Extension (MV3) + local Node.js daemon system for "distraction-aware development." It monitors AI agent (Claude Code, Cursor) work status and auto-returns browser focus to the dev tab when input is needed or tasks complete.

## Commands

```bash
# Install dependencies
pnpm install

# Development (daemon + extension watch mode)
pnpm dev

# Development (individual)
pnpm dev:daemon        # Daemon with tsx watch
pnpm dev:extension     # Extension with Vite watch

# Build
pnpm build             # Both daemon + extension
pnpm build:daemon
pnpm build:extension

# Quality
pnpm lint              # ESLint across all workspaces
pnpm typecheck         # TypeScript type checking (no emit)
```

After building the extension, load `extension/dist/` as unpacked extension in `chrome://extensions`.

## Architecture

```
Claude Code/Cursor  →  POST /agent/*  →  Daemon (Express+WS)  →  Chrome Extension
                        localhost:3000      broadcasts events      Side Panel UI
```

**Monorepo** (pnpm workspaces): `extension/` and `daemon/`

### Daemon (`daemon/`)
- Express HTTP server + WebSocket server on port 3000
- REST endpoints: `/agent/start`, `/agent/log`, `/agent/need-input`, `/agent/done`, `/health`
- `TaskManager` handles task lifecycle (idle → running → waiting_input/done/error)
- Broadcasts events to all connected WebSocket clients
- ESM modules, Node.js 20+

### Chrome Extension (`extension/`)
- **Manifest V3** with separate HTML entry points (no SPA router)
- `src/background/` — Service Worker: WebSocket client, state management, tab control, auto-reconnect with exponential backoff, chrome.alarms keep-alive
- `src/sidepanel/` — Dashboard UI: real-time log streaming, task status, modal overlays
- `src/popup/` — Quick mode switcher (Quiet/Normal/Force)
- `src/options/` — Settings: focus behavior, distraction domain list, timers
- `src/shared/` — Shared TypeScript type definitions
- React 18 + Vite + @crxjs/vite-plugin for MV3 bundling

### Scripts (`scripts/`)
- `focusflow-notify.sh` — CLI for sending events to daemon
- `claude-code-hooks.json` — Example Claude Code hooks config (reference only)

### Claude Code Hooks
FocusFlow uses Claude Code hooks to detect session events.

**Important**: Hooks must be defined in `.claude/settings.local.json`, NOT in `~/.claude/hooks.json` or `scripts/claude-code-hooks.json`.

```json
// .claude/settings.local.json
{
  "hooks": {
    "SessionStart": [...],      // Session started
    "UserPromptSubmit": [...],  // User sent a prompt
    "PostToolUse": [...],       // Tool execution completed
    "Stop": [...],              // Session ended
    "PreCompact": [...]         // Before context compaction
  }
}
```

Hooks use `jq` to parse stdin JSON and `curl` to send events to daemon.

## Coding Principles

- **YAGNI**: 将来使うかもしれない機能は実装しない
- **DRY**: 重複コードは必ず関数化・モジュール化する
- **KISS**: 複雑な解決策より単純な解決策を優先する

## Key Conventions

- **TypeScript strict mode** throughout (base config in `tsconfig.base.json`)
- **Path alias**: `@/*` → `extension/src/*` (extension only)
- **Module system**: ESM everywhere (`"type": "module"`)
- **Styling**: Tailwind CSS utility-first with custom dark theme palette (`focus-primary`, `focus-bg` etc.) defined in `extension/tailwind.config.js`
- **State storage**: `chrome.storage.local` for extension settings; in-memory for daemon
- **Communication**: Background service worker acts as message-passing hub between extension components
- **Language**: UI text and documentation are in Japanese
