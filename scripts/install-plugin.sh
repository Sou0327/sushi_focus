#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PLUGIN_SRC="$PROJECT_ROOT/claude-plugin/sushi-focus-daemon"
PLUGIN_DEST="$HOME/.claude/plugins/sushi-focus-daemon"

echo "🍣 Installing Sushi Focus Daemon Plugin"
echo "========================================"

# Check if plugin source exists
if [ ! -d "$PLUGIN_SRC" ]; then
  echo "Error: Plugin source not found at $PLUGIN_SRC"
  exit 1
fi

# Build daemon first
echo ""
echo "Building daemon..."
cd "$PROJECT_ROOT"
pnpm build:daemon

# Check if daemon was built
if [ ! -f "$PROJECT_ROOT/daemon/dist/server/index.js" ]; then
  echo "Error: Daemon build failed"
  exit 1
fi

# Create plugins directory if it doesn't exist
mkdir -p "$HOME/.claude/plugins"

# Create symlink (remove existing if present)
if [ -L "$PLUGIN_DEST" ] || [ -d "$PLUGIN_DEST" ]; then
  echo ""
  echo "Removing existing plugin..."
  rm -rf "$PLUGIN_DEST"
fi

ln -sfn "$PLUGIN_SRC" "$PLUGIN_DEST"

echo ""
echo "✅ Plugin installed successfully!"
echo ""
echo "Location: $PLUGIN_DEST"
echo ""
echo "Next steps:"
echo "  1. Restart Claude Code"
echo "  2. The daemon will auto-start on session start"
echo ""
echo "To verify:"
echo "  curl http://127.0.0.1:41593/health"
