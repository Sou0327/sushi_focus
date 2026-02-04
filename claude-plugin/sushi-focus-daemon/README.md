# Sushi Focus Daemon Plugin 🍣

Claude Code plugin that automatically starts the Sushi Focus daemon on session start.

## Installation

### Option 1: Install Script (Recommended)

```bash
# From the project root
./scripts/install-plugin.sh
```

### Option 2: Manual Installation

1. Build the daemon:
   ```bash
   pnpm build:daemon
   ```

2. Create symlink:
   ```bash
   ln -sfn /path/to/sushi-focus/claude-plugin/sushi-focus-daemon ~/.claude/plugins/sushi-focus-daemon
   ```

3. Restart Claude Code

## How It Works

When a Claude Code session starts, this plugin:

1. **Checks port availability** (default: 41593)
2. **Health checks** if port is in use - keeps existing healthy daemon
3. **Kills zombie processes** if port is used but daemon is unhealthy
4. **Starts the daemon** in detached mode
5. **Verifies startup** with health check retry

## Configuration

Set environment variable to change the port:

```bash
export SUSHI_FOCUS_PORT=41593
```

## Troubleshooting

### Daemon Not Starting

1. Check if daemon is built:
   ```bash
   ls daemon/dist/server/index.js
   ```
   If missing, run `pnpm build:daemon`

2. Check port availability:
   ```bash
   lsof -i:41593
   ```

3. Manual start for debugging:
   ```bash
   cd daemon && pnpm start
   ```

### Zombie Process

If a previous daemon didn't shut down cleanly:

```bash
# Find and kill the process
lsof -ti:41593 | xargs kill -9
```

## Uninstall

```bash
rm ~/.claude/plugins/sushi-focus-daemon
```
