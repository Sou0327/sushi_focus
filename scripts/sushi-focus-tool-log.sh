#!/bin/bash
# Sushi Focus Tool Logger
# Reads Claude Code PreToolUse hook JSON from stdin
# and sends descriptive log messages to the daemon.
#
# Tool → Message mapping:
#   Read/Glob/Grep → 📂 分析系
#   Edit/Write     → ✏️ 実装系
#   Bash           → 🧪 テスト / 🔨 ビルド / 💻 コマンド
#   Task           → 🔄 サブタスク

DAEMON_URL="http://127.0.0.1:41593"
TASK_ID="claude-code-session"

# jq is required for JSON parsing/generation
if ! command -v jq &> /dev/null; then
  exit 0
fi

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')

case "$TOOL_NAME" in
  Read)
    FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')
    BASENAME=$(basename "$FILE" 2>/dev/null || echo "file")
    MSG="📂 Reading ${BASENAME}..."
    LEVEL="info"
    ;;
  Glob)
    PATTERN=$(echo "$INPUT" | jq -r '.tool_input.pattern // ""')
    MSG="🔍 Searching ${PATTERN}..."
    LEVEL="info"
    ;;
  Grep)
    PATTERN=$(echo "$INPUT" | jq -r '.tool_input.pattern // ""')
    MSG="🔍 Grep \"${PATTERN}\"..."
    LEVEL="info"
    ;;
  Edit)
    FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')
    BASENAME=$(basename "$FILE" 2>/dev/null || echo "file")
    MSG="✏️ Editing ${BASENAME}..."
    LEVEL="info"
    ;;
  Write)
    FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')
    BASENAME=$(basename "$FILE" 2>/dev/null || echo "file")
    MSG="📝 Writing ${BASENAME}..."
    LEVEL="info"
    ;;
  Bash)
    CMD=$(echo "$INPUT" | jq -r '.tool_input.command // ""' | head -c 100)
    if echo "$CMD" | grep -qiE '(test|jest|vitest|pytest)'; then
      MSG="🧪 Running tests..."
      LEVEL="info"
    elif echo "$CMD" | grep -qiE '(build|compile|tsc)'; then
      MSG="🔨 Building..."
      LEVEL="info"
    elif echo "$CMD" | grep -qiE '(lint|eslint|prettier)'; then
      MSG="✨ Linting..."
      LEVEL="info"
    elif echo "$CMD" | grep -qiE '^git '; then
      MSG="🌿 Git operation..."
      LEVEL="info"
    else
      # Classify without exposing command content (may contain secrets/paths)
      MSG="💻 Running command..."
      LEVEL="command"
    fi
    ;;
  Task)
    DESC=$(echo "$INPUT" | jq -r '.tool_input.description // "subtask"')
    MSG="🔄 ${DESC}"
    LEVEL="info"
    ;;
  WebSearch|WebFetch)
    MSG="🌐 Web search..."
    LEVEL="info"
    ;;
  *)
    # Skip internal/unknown tools to reduce noise
    exit 0
    ;;
esac

# Send log to daemon
jq -n --arg tid "$TASK_ID" --arg msg "$MSG" --arg lvl "$LEVEL" \
  '{taskId: $tid, message: $msg, level: $lvl}' | \
curl -s -X POST "$DAEMON_URL/agent/log" \
  -H "Content-Type: application/json" \
  ${SUSHI_FOCUS_SECRET:+-H "Authorization: Bearer $SUSHI_FOCUS_SECRET"} \
  -d @- > /dev/null 2>&1 || true
