#!/bin/bash
# Sushi Focus Notification Script
# Usage: sushi-focus-notify.sh <event> [options]
#
# Events:
#   start   - Task started
#   log     - Log message
#   need-input - Input required (triggers auto-focus)
#   done    - Task completed (triggers auto-focus from distraction sites)
#
# Examples:
#   sushi-focus-notify.sh start --prompt "Fix authentication bug"
#   sushi-focus-notify.sh log --message "Analyzing codebase..."
#   sushi-focus-notify.sh need-input --question "Which approach should I use?"
#   sushi-focus-notify.sh done --summary "Fixed 3 files"

DAEMON_URL="${SUSHI_FOCUS_DAEMON_URL:-http://127.0.0.1:41593}"
TASK_ID="${SUSHI_FOCUS_TASK_ID:-task-$(date +%s)}"

event="$1"
shift

# Parse options
while [[ $# -gt 0 ]]; do
  case $1 in
    --prompt)
      prompt="$2"
      shift 2
      ;;
    --message)
      message="$2"
      shift 2
      ;;
    --level)
      level="$2"
      shift 2
      ;;
    --question)
      question="$2"
      shift 2
      ;;
    --summary)
      summary="$2"
      shift 2
      ;;
    --task-id)
      TASK_ID="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# Check if jq is available for safe JSON generation
if command -v jq &> /dev/null; then
  USE_JQ=true
else
  USE_JQ=false
fi

# Safe JSON generation function
make_json() {
  local event_type="$1"

  if [ "$USE_JQ" = true ]; then
    # Use jq for proper JSON escaping
    case "$event_type" in
      start)
        jq -n --arg tid "$TASK_ID" --arg prompt "${prompt:-Task started}" \
          '{taskId: $tid, prompt: $prompt}'
        ;;
      log)
        jq -n --arg tid "$TASK_ID" --arg msg "$message" --arg lvl "${level:-info}" \
          '{taskId: $tid, message: $msg, level: $lvl}'
        ;;
      need-input)
        jq -n --arg tid "$TASK_ID" --arg q "${question:-Input required}" \
          '{taskId: $tid, question: $q}'
        ;;
      done)
        jq -n --arg tid "$TASK_ID" --arg sum "${summary:-Task completed}" \
          '{taskId: $tid, summary: $sum}'
        ;;
    esac
  else
    # Fallback: basic escaping for common special characters
    local value
    case "$event_type" in
      start)
        value="${prompt:-Task started}"
        ;;
      log)
        value="$message"
        ;;
      need-input)
        value="${question:-Input required}"
        ;;
      done)
        value="${summary:-Task completed}"
        ;;
    esac

    # Escape backslashes, double quotes, tabs, and newlines
    local escaped
    escaped=$(printf '%s' "$value" | sed 's/\\/\\\\/g; s/"/\\"/g; s/	/\\t/g' | tr '\n' ' ')

    case "$event_type" in
      start)
        printf '{"taskId":"%s","prompt":"%s"}' "$TASK_ID" "$escaped"
        ;;
      log)
        # Escape level value for JSON safety (only allow alphanumeric chars)
        local raw_level="${level:-info}"
        local escaped_level
        escaped_level=$(printf '%s' "$raw_level" | sed 's/[^a-zA-Z]//g')
        # Validate level is one of the allowed values, default to 'info'
        case "$escaped_level" in
          info|warn|warning|error|debug) ;;
          *) escaped_level="info" ;;
        esac
        printf '{"taskId":"%s","message":"%s","level":"%s"}' "$TASK_ID" "$escaped" "$escaped_level"
        ;;
      need-input)
        printf '{"taskId":"%s","question":"%s"}' "$TASK_ID" "$escaped"
        ;;
      done)
        printf '{"taskId":"%s","summary":"%s"}' "$TASK_ID" "$escaped"
        ;;
    esac
  fi
}

case "$event" in
  start)
    JSON=$(make_json start)
    curl -s -X POST "${DAEMON_URL}/agent/start" \
      -H "Content-Type: application/json" \
      -d "$JSON" \
      > /dev/null
    echo "Sushi Focus: Task started (${TASK_ID})"
    echo "${TASK_ID}"
    ;;
  log)
    JSON=$(make_json log)
    curl -s -X POST "${DAEMON_URL}/agent/log" \
      -H "Content-Type: application/json" \
      -d "$JSON" \
      > /dev/null
    ;;
  need-input)
    JSON=$(make_json need-input)
    curl -s -X POST "${DAEMON_URL}/agent/need-input" \
      -H "Content-Type: application/json" \
      -d "$JSON" \
      > /dev/null
    echo "Sushi Focus: Input required"
    ;;
  done)
    JSON=$(make_json done)
    curl -s -X POST "${DAEMON_URL}/agent/done" \
      -H "Content-Type: application/json" \
      -d "$JSON" \
      > /dev/null
    echo "Sushi Focus: Task completed"
    ;;
  *)
    echo "Usage: sushi-focus-notify.sh <start|log|need-input|done> [options]"
    exit 1
    ;;
esac
