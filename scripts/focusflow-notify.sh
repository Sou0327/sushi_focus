#!/bin/bash
# FocusFlow Notification Script
# Usage: focusflow-notify.sh <event> [options]
#
# Events:
#   start   - Task started
#   log     - Log message
#   need-input - Input required (triggers auto-focus)
#   done    - Task completed (triggers auto-focus from distraction sites)
#
# Examples:
#   focusflow-notify.sh start --prompt "Fix authentication bug"
#   focusflow-notify.sh log --message "Analyzing codebase..."
#   focusflow-notify.sh need-input --question "Which approach should I use?"
#   focusflow-notify.sh done --summary "Fixed 3 files"

DAEMON_URL="${FOCUSFLOW_DAEMON_URL:-http://127.0.0.1:3000}"
TASK_ID="${FOCUSFLOW_TASK_ID:-task-$(date +%s)}"

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

case "$event" in
  start)
    curl -s -X POST "${DAEMON_URL}/agent/start" \
      -H "Content-Type: application/json" \
      -d "{\"taskId\":\"${TASK_ID}\",\"prompt\":\"${prompt:-Task started}\"}" \
      > /dev/null
    echo "FocusFlow: Task started (${TASK_ID})"
    echo "${TASK_ID}"
    ;;
  log)
    curl -s -X POST "${DAEMON_URL}/agent/log" \
      -H "Content-Type: application/json" \
      -d "{\"taskId\":\"${TASK_ID}\",\"message\":\"${message}\",\"level\":\"${level:-info}\"}" \
      > /dev/null
    ;;
  need-input)
    curl -s -X POST "${DAEMON_URL}/agent/need-input" \
      -H "Content-Type: application/json" \
      -d "{\"taskId\":\"${TASK_ID}\",\"question\":\"${question:-Input required}\"}" \
      > /dev/null
    echo "FocusFlow: Input required"
    ;;
  done)
    curl -s -X POST "${DAEMON_URL}/agent/done" \
      -H "Content-Type: application/json" \
      -d "{\"taskId\":\"${TASK_ID}\",\"summary\":\"${summary:-Task completed}\"}" \
      > /dev/null
    echo "FocusFlow: Task completed"
    ;;
  *)
    echo "Usage: focusflow-notify.sh <start|log|need-input|done> [options]"
    exit 1
    ;;
esac
