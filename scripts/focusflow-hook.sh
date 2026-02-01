#!/bin/bash
# FocusFlow Hook Script for Claude Code
# Usage: focusflow-hook.sh <event> [args...]

DAEMON_URL="http://127.0.0.1:41593"
SESSION_ID="${CLAUDE_SESSION_ID:-session-$$}"

case "$1" in
  start)
    curl -s -X POST "$DAEMON_URL/agent/start" \
      -H "Content-Type: application/json" \
      -d "{\"taskId\": \"$SESSION_ID\", \"prompt\": \"Claude Code session started\"}" > /dev/null 2>&1 || true
    ;;
  log)
    MESSAGE="${2:-Working...}"
    curl -s -X POST "$DAEMON_URL/agent/log" \
      -H "Content-Type: application/json" \
      -d "{\"taskId\": \"$SESSION_ID\", \"message\": \"$MESSAGE\"}" > /dev/null 2>&1 || true
    ;;
  need-input)
    QUESTION="${2:-User input required}"
    curl -s -X POST "$DAEMON_URL/agent/need-input" \
      -H "Content-Type: application/json" \
      -d "{\"taskId\": \"$SESSION_ID\", \"question\": \"$QUESTION\", \"choices\": []}" > /dev/null 2>&1 || true
    ;;
  done)
    SUMMARY="${2:-Task completed}"
    curl -s -X POST "$DAEMON_URL/agent/done" \
      -H "Content-Type: application/json" \
      -d "{\"taskId\": \"$SESSION_ID\", \"summary\": \"$SUMMARY\"}" > /dev/null 2>&1 || true
    ;;
  *)
    echo "Usage: $0 {start|log|need-input|done} [message]"
    exit 1
    ;;
esac
