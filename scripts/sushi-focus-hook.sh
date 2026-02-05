#!/bin/bash
# Sushi Focus Hook Script for Claude Code
# Usage: sushi-focus-hook.sh <event> [args...]

DAEMON_URL="http://127.0.0.1:41593"
SESSION_ID="${CLAUDE_SESSION_ID:-session-$$}"

# Check if jq is available for safe JSON generation
if command -v jq &> /dev/null; then
  USE_JQ=true
else
  USE_JQ=false
fi

# Safe JSON generation function
make_json() {
  if [ "$USE_JQ" = true ]; then
    # Use jq for proper JSON escaping
    case "$1" in
      start)
        jq -n --arg tid "$2" --arg prompt "$3" \
          '{taskId: $tid, prompt: $prompt}'
        ;;
      log)
        jq -n --arg tid "$2" --arg msg "$3" \
          '{taskId: $tid, message: $msg}'
        ;;
      need-input)
        jq -n --arg tid "$2" --arg q "$3" \
          '{taskId: $tid, question: $q, choices: []}'
        ;;
      done)
        jq -n --arg tid "$2" --arg sum "$3" \
          '{taskId: $tid, summary: $sum}'
        ;;
    esac
  else
    # Fallback: basic escaping for common special characters
    local escaped
    escaped=$(printf '%s' "$3" | sed 's/\\/\\\\/g; s/"/\\"/g; s/	/\\t/g' | tr '\n' ' ')
    case "$1" in
      start)
        printf '{"taskId": "%s", "prompt": "%s"}' "$2" "$escaped"
        ;;
      log)
        printf '{"taskId": "%s", "message": "%s"}' "$2" "$escaped"
        ;;
      need-input)
        printf '{"taskId": "%s", "question": "%s", "choices": []}' "$2" "$escaped"
        ;;
      done)
        printf '{"taskId": "%s", "summary": "%s"}' "$2" "$escaped"
        ;;
    esac
  fi
}

case "$1" in
  start)
    JSON=$(make_json start "$SESSION_ID" "Claude Code session started")
    curl -s -X POST "$DAEMON_URL/agent/start" \
      -H "Content-Type: application/json" \
      -d "$JSON" > /dev/null 2>&1 || true
    ;;
  log)
    MESSAGE="${2:-Working...}"
    JSON=$(make_json log "$SESSION_ID" "$MESSAGE")
    curl -s -X POST "$DAEMON_URL/agent/log" \
      -H "Content-Type: application/json" \
      -d "$JSON" > /dev/null 2>&1 || true
    ;;
  need-input)
    QUESTION="${2:-User input required}"
    JSON=$(make_json need-input "$SESSION_ID" "$QUESTION")
    curl -s -X POST "$DAEMON_URL/agent/need-input" \
      -H "Content-Type: application/json" \
      -d "$JSON" > /dev/null 2>&1 || true
    ;;
  done)
    SUMMARY="${2:-Task completed}"
    JSON=$(make_json done "$SESSION_ID" "$SUMMARY")
    curl -s -X POST "$DAEMON_URL/agent/done" \
      -H "Content-Type: application/json" \
      -d "$JSON" > /dev/null 2>&1 || true
    ;;
  *)
    echo "Usage: $0 {start|log|need-input|done} [message]"
    exit 1
    ;;
esac
