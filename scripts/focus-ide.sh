#!/bin/bash
# Focus IDE window (macOS)
# Usage: focus-ide.sh [app-name]

APP="${1:-Code}"

# Supported apps: Code, Cursor, Terminal, iTerm

osascript -e "tell application \"$APP\" to activate" 2>/dev/null

if [ $? -eq 0 ]; then
  echo "Focused: $APP"
else
  echo "Failed to focus: $APP"
  exit 1
fi
