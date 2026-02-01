# FocusFlow

[![CI](https://github.com/Sou0327/focus_flow/actions/workflows/ci.yml/badge.svg)](https://github.com/Sou0327/focus_flow/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[日本語](README.ja.md)

A Chrome Extension + Local Daemon system for "distraction-aware development." It monitors AI agent work status and automatically returns browser focus to your development tab when input is required or tasks complete.

> **Note**: Currently supports **Claude Code** only. Cursor and other AI agent support is planned for future releases.

## Architecture

```
┌─────────────────┐     HTTP POST      ┌─────────────────┐    WebSocket    ┌─────────────────┐
│   Claude Code   │ ───────────────▶ │     Daemon      │ ───────────────▶ │  Chrome Ext     │
│                 │   /agent/start    │  localhost:41593 │  task.started   │  Side Panel     │
│                 │   /agent/log      │                 │  task.log       │  Dashboard      │
│                 │   /agent/need-input│                │  task.need_input│                 │
│                 │   /agent/done     │                 │  task.done      │                 │
└─────────────────┘                   └─────────────────┘                 └─────────────────┘
```

**Editor work → Daemon notification → Extension shows status & auto-returns focus**

## Prerequisites

- **Node.js** 20+
- **pnpm** 9+ (install with `npm install -g pnpm`)
- **Google Chrome** browser

## Quick Start

### Step 1: Install Dependencies

```bash
cd FocusFlow
pnpm install
```

### Step 2: Build

```bash
# Build daemon (local server)
pnpm build:daemon

# Build Chrome extension
pnpm build:extension
```

### Step 3: Start Daemon

```bash
pnpm dev:daemon
```

You should see:

```text
╔═══════════════════════════════════════════════════════════╗
║                    FocusFlow Daemon                        ║
║                      v0.1.0                              ║
╠═══════════════════════════════════════════════════════════╣
║  HTTP API: http://127.0.0.1:41593                          ║
║  WebSocket: ws://127.0.0.1:41593/ws                        ║
╚═══════════════════════════════════════════════════════════╝
```

> **Note**: Keep the daemon running in a separate terminal.

### Step 4: Install Chrome Extension

1. Open `chrome://extensions` in Chrome
2. Enable "**Developer mode**" (top right)
3. Click "**Load unpacked**"
4. Select the `FocusFlow/extension/dist` folder
5. Verify the FocusFlow icon appears in your toolbar

### Step 5: Open Side Panel

1. Click the FocusFlow icon in Chrome toolbar
2. Click "**Open Panel**" in the popup
3. Side Panel opens on the right

Or click the Side Panel icon (📋) in Chrome and select FocusFlow.

## Usage

### Sending Events from Your Agent

Send work status from your editor (Claude Code, Cursor, etc.) to the daemon:

#### Using curl

```bash
# Start task
curl -X POST http://127.0.0.1:41593/agent/start \
  -H "Content-Type: application/json" \
  -d '{"taskId":"task-1","prompt":"Fix authentication bug"}'

# Log output
curl -X POST http://127.0.0.1:41593/agent/log \
  -H "Content-Type: application/json" \
  -d '{"taskId":"task-1","message":"Analyzing codebase..."}'

# Need input (triggers auto-return)
curl -X POST http://127.0.0.1:41593/agent/need-input \
  -H "Content-Type: application/json" \
  -d '{"taskId":"task-1","question":"Which approach should I use?"}'

# Task complete (triggers auto-return)
curl -X POST http://127.0.0.1:41593/agent/done \
  -H "Content-Type: application/json" \
  -d '{"taskId":"task-1","summary":"Fixed 3 files"}'
```

#### Using the Script

```bash
# Start task
./scripts/focusflow-notify.sh start --prompt "Fix authentication bug"

# Log output
./scripts/focusflow-notify.sh log --message "Analyzing codebase..."

# Need input
./scripts/focusflow-notify.sh need-input --question "Which approach?"

# Complete
./scripts/focusflow-notify.sh done --summary "Fixed 3 files"
```

### Claude Code Integration

1. Add hooks to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -X POST http://127.0.0.1:41593/agent/log -H 'Content-Type: application/json' -d '{\"taskId\":\"claude\",\"message\":\"Notification\"}' > /dev/null 2>&1 || true"
          }
        ]
      }
    ]
  }
}
```

2. Notify task start at session beginning:

```bash
curl -X POST http://127.0.0.1:41593/agent/start \
  -H "Content-Type: application/json" \
  -d '{"taskId":"claude","prompt":"Claude Code Session"}'
```

### Input Required (need_input)

- When agent sends `/agent/need-input`, a modal appears
- Automatically returns focus to IDE

### Task Complete (done)

- When browsing distraction sites (YouTube, etc.) and `/agent/done` arrives:
  1. 1.5-second countdown displays
  2. Automatically returns focus to IDE unless "Cancel" is pressed
- When on development sites, only shows notification (no auto-return)

## Daemon API

### External Agent API (for IDE Integration)

Endpoints for external agents (Claude Code, Cursor, etc.) to send events.

| Endpoint | Method | Description |
| -------- | ------ | ----------- |
| `/health` | GET | Health check (`{ok, version, gitBranch}`) |
| `/agent/start` | POST | Start task |
| `/agent/log` | POST | Log output |
| `/agent/need-input` | POST | Need input (triggers auto-return) |
| `/agent/done` | POST | Task complete (triggers auto-return) |
| `/agent/cancel` | POST | Cancel task |
| `/agent/progress` | POST | Report progress |

#### Request Format

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

### Internal Task API

Endpoints for internal task management.

| Endpoint | Method | Description |
| -------- | ------ | ----------- |
| `/tasks` | POST | Create task (`{repoId, prompt}`) |
| `/tasks/current` | GET | Get current task |
| `/tasks/:id/cancel` | POST | Cancel task |
| `/tasks/:id/choice` | POST | Send choice for input (`{choiceId}`) |
| `/repos` | GET | List repositories |

### Focus Settings API

Control auto-focus to IDE window. Set initial values in `.env`.

| Endpoint | Method | Description |
| -------- | ------ | ----------- |
| `/focus/settings` | GET | Get current focus settings |
| `/focus/settings` | POST | Update focus settings |
| `/focus/now` | POST | Manually focus IDE immediately |

```bash
# .env example
FOCUS_ENABLED=true         # Enable/disable focus feature
FOCUS_APP=Cursor           # Target app (Code, Cursor, Terminal, iTerm)
FOCUS_ON_NEED_INPUT=true   # Auto-focus on need-input
FOCUS_ON_DONE=true         # Auto-focus on done
```

### WebSocket Event Types

Events broadcast by daemon via `ws://127.0.0.1:41593/ws`.

```typescript
type DaemonEvent =
  | { type: 'task.started',    taskId: string, repoId: string, startedAt: number, hasImage?: boolean }
  | { type: 'task.log',        taskId: string, level: string, message: string }
  | { type: 'task.need_input', taskId: string, question: string, choices: {id: string, label: string}[] }
  | { type: 'task.done',       taskId: string, summary: string, meta?: { changedFiles?: number, tests?: string } }
  | { type: 'task.error',      taskId: string, message: string, details?: string }
  | { type: 'task.progress',   taskId: string, current: number, total: number, label?: string }
```

## Troubleshooting

### "Offline" Status Displayed

Daemon may not be running:

```bash
# Start daemon
pnpm dev:daemon
```

### Side Panel Won't Open

1. Reload extension at `chrome://extensions`
2. Restart Chrome

### Build Errors

```bash
# Remove node_modules and reinstall
rm -rf node_modules extension/node_modules daemon/node_modules
pnpm install
pnpm build
```

## Development

### Development Mode

```bash
# Daemon (hot reload)
pnpm dev:daemon

# After extension changes, manually reload
# Click the 🔄 button on FocusFlow at chrome://extensions
```

### Project Structure

```text
FocusFlow/
├── extension/          # Chrome Extension (MV3)
│   ├── src/
│   │   ├── background/ # Service Worker
│   │   ├── sidepanel/  # Dashboard
│   │   ├── popup/      # Mode switcher
│   │   ├── options/    # Settings page
│   │   └── shared/     # Shared type definitions
│   └── dist/           # Build output
├── daemon/             # Local server
│   └── src/
│       ├── server/     # Express + WebSocket
│       └── task/       # Task management
├── scripts/            # Integration scripts
│   ├── focusflow-notify.sh    # Notification script
│   └── claude-code-hooks.json # Claude Code hooks example
└── package.json        # Workspace config
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

MIT
