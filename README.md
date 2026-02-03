# Sushi Focus 🍣

[![CI](https://github.com/Sou0327/focus_flow/actions/workflows/ci.yml/badge.svg)](https://github.com/Sou0327/focus_flow/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[日本語](README.ja.md)

A Chrome Extension + Local Daemon system for "omakase-style development." Like a skilled itamae (sushi chef), it keeps your focus sharp while AI agents prepare your code. Auto-returns you to the counter when your order is ready! 🍣

> **Note**: Currently supports **Claude Code** only. Cursor and other AI agent support is planned for future releases.

## Architecture

```
┌─────────────────┐     HTTP POST      ┌─────────────────┐    WebSocket    ┌─────────────────┐
│   Claude Code   │ ───────────────▶ │     Itamae      │ ───────────────▶ │  Chrome Ext     │
│   (Your Agent)  │   /agent/start    │  localhost:41593 │  task.started   │  Sushi Counter  │
│                 │   /agent/log      │   (Kitchen)     │  task.log       │  Dashboard      │
│                 │   /agent/need-input│                │  task.need_input│                 │
│                 │   /agent/done     │                 │  task.done      │                 │
└─────────────────┘                   └─────────────────┘                 └─────────────────┘
```

**Place your order → Kitchen prepares → Chef calls you when ready 🍣**

## Prerequisites

- **Node.js** 20+
- **pnpm** 9+ (install with `npm install -g pnpm`)
- **Google Chrome** browser

## Quick Start

### Step 1: Install Dependencies

```bash
cd SushiFocus
pnpm install
```

### Step 2: Build

```bash
# Build itamae (local kitchen server)
pnpm build:daemon

# Build Chrome extension (sushi counter)
pnpm build:extension
```

### Step 3: Open the Kitchen

```bash
pnpm dev:daemon
```

You should see:

```text
╔═══════════════════════════════════════════════════════════╗
║                 Sushi Focus - Itamae 🍣                    ║
║                      v0.1.0                              ║
╠═══════════════════════════════════════════════════════════╣
║  HTTP API: http://127.0.0.1:41593                          ║
║  WebSocket: ws://127.0.0.1:41593/ws                        ║
╚═══════════════════════════════════════════════════════════╝
```

> **Note**: Keep the kitchen running in a separate terminal.

### Step 4: Install Chrome Extension

1. Open `chrome://extensions` in Chrome
2. Enable "**Developer mode**" (top right)
3. Click "**Load unpacked**"
4. Select the `SushiFocus/extension/dist` folder
5. Verify the Sushi Focus 🍣 icon appears in your toolbar

### Step 5: Take Your Seat at the Counter

1. Click the Sushi Focus icon in Chrome toolbar
2. Click "**View Kitchen**" in the popup
3. Side Panel opens on the right - your sushi counter seat!

Or click the Side Panel icon (📋) in Chrome and select Sushi Focus.

## Usage

### Sending Orders from Your Agent

Send work status from your editor (Claude Code, Cursor, etc.) to the kitchen:

#### Using curl

```bash
# Start preparing (place order)
curl -X POST http://127.0.0.1:41593/agent/start \
  -H "Content-Type: application/json" \
  -d '{"taskId":"task-1","prompt":"Fix authentication bug"}'

# Kitchen update (chef is working)
curl -X POST http://127.0.0.1:41593/agent/log \
  -H "Content-Type: application/json" \
  -d '{"taskId":"task-1","message":"Analyzing codebase..."}'

# Need input (chef has a question)
curl -X POST http://127.0.0.1:41593/agent/need-input \
  -H "Content-Type: application/json" \
  -d '{"taskId":"task-1","question":"Which approach should I use?"}'

# Order ready! (omakase complete)
curl -X POST http://127.0.0.1:41593/agent/done \
  -H "Content-Type: application/json" \
  -d '{"taskId":"task-1","summary":"Fixed 3 files"}'
```

#### Using the Script

```bash
# Place order
./scripts/sushi-focus-notify.sh start --prompt "Fix authentication bug"

# Kitchen update
./scripts/sushi-focus-notify.sh log --message "Analyzing codebase..."

# Chef has a question
./scripts/sushi-focus-notify.sh need-input --question "Which approach?"

# Order ready!
./scripts/sushi-focus-notify.sh done --summary "Fixed 3 files"
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

2. Notify kitchen at session start:

```bash
curl -X POST http://127.0.0.1:41593/agent/start \
  -H "Content-Type: application/json" \
  -d '{"taskId":"claude","prompt":"Claude Code Session"}'
```

### Chef Needs You! (need_input)

- When agent sends `/agent/need-input`, the chef calls you back
- Automatically returns focus to IDE

### Order Ready! (done)

- When browsing distraction sites (YouTube, etc.) and `/agent/done` arrives:
  1. 1.5-second countdown displays
  2. Automatically returns focus to IDE unless "Cancel" is pressed
- When on development sites, only shows notification (no auto-return)

## Kitchen API (Daemon)

### External Agent API (for IDE Integration)

Endpoints for external agents (Claude Code, Cursor, etc.) to send events.

| Endpoint | Method | Description |
| -------- | ------ | ----------- |
| `/health` | GET | Health check (`{ok, version, gitBranch}`) |
| `/agent/start` | POST | Place order (start task) |
| `/agent/log` | POST | Kitchen update (log output) |
| `/agent/need-input` | POST | Chef needs you! (triggers auto-return) |
| `/agent/done` | POST | Order ready! (triggers auto-return) |
| `/agent/cancel` | POST | Send it back (cancel task) |
| `/agent/progress` | POST | Preparation progress |

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

Events broadcast by kitchen via `ws://127.0.0.1:41593/ws`.

```typescript
type KitchenEvent =
  | { type: 'task.started',    taskId: string, repoId: string, startedAt: number, hasImage?: boolean }
  | { type: 'task.log',        taskId: string, level: string, message: string }
  | { type: 'task.need_input', taskId: string, question: string, choices: {id: string, label: string}[] }
  | { type: 'task.done',       taskId: string, summary: string, meta?: { changedFiles?: number, tests?: string } }
  | { type: 'task.error',      taskId: string, message: string, details?: string }
  | { type: 'task.progress',   taskId: string, current: number, total: number, label?: string }
```

## Troubleshooting

### "Kitchen Closed" Status Displayed

Kitchen (daemon) may not be running:

```bash
# Open the kitchen
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
# Kitchen (hot reload)
pnpm dev:daemon

# After extension changes, manually reload
# Click the 🔄 button on Sushi Focus at chrome://extensions
```

### Project Structure

```text
SushiFocus/
├── extension/          # Chrome Extension (MV3) - Sushi Counter
│   ├── src/
│   │   ├── background/ # Service Worker (Kitchen Manager)
│   │   ├── sidepanel/  # Dashboard (Counter Seat)
│   │   ├── popup/      # Service Style Selector
│   │   ├── options/    # House Rules
│   │   └── shared/     # Shared type definitions
│   └── dist/           # Build output
├── daemon/             # Local server (Itamae/Kitchen)
│   └── src/
│       ├── server/     # Express + WebSocket
│       └── task/       # Order management
├── scripts/            # Integration scripts
│   ├── sushi-focus-notify.sh  # Order notification script
│   └── claude-code-hooks.json # Claude Code hooks example
└── package.json        # Workspace config
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

MIT

---

**へい、らっしゃい！** 🍣
