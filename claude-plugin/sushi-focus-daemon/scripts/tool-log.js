#!/usr/bin/env node

/**
 * Sushi Focus Tool Logger
 *
 * Reads Claude Code PreToolUse hook JSON from stdin
 * and sends descriptive log messages to the daemon.
 *
 * Tool → Message mapping:
 *   Read/Glob/Grep → 📂/🔍 Analysis
 *   Edit/Write     → ✏️/📝 Implementation
 *   Bash           → 🧪 Test / 🔨 Build / 💻 Command
 *   Task           → 🔄 Subtask
 *   WebSearch/WebFetch → 🌐 Web
 */

const PORT = parseInt(process.env.SUSHI_FOCUS_PORT || process.env.PORT || '41593', 10);
const SECRET = process.env.SUSHI_FOCUS_SECRET || null;
const TASK_ID = 'claude-code-session';

function getBasename(filePath) {
  if (!filePath) return 'file';
  const parts = filePath.split('/');
  return parts[parts.length - 1] || 'file';
}

function classify(input) {
  const toolName = input.tool_name || 'unknown';
  const toolInput = input.tool_input || {};

  switch (toolName) {
    case 'Read': {
      const basename = getBasename(toolInput.file_path);
      return { msg: `📂 Reading ${basename}...`, level: 'info' };
    }
    case 'Glob': {
      const pattern = toolInput.pattern || '';
      return { msg: `🔍 Searching ${pattern}...`, level: 'info' };
    }
    case 'Grep': {
      const pattern = toolInput.pattern || '';
      return { msg: `🔍 Grep "${pattern}"...`, level: 'info' };
    }
    case 'Edit': {
      const basename = getBasename(toolInput.file_path);
      return { msg: `✏️ Editing ${basename}...`, level: 'info' };
    }
    case 'Write': {
      const basename = getBasename(toolInput.file_path);
      return { msg: `📝 Writing ${basename}...`, level: 'info' };
    }
    case 'Bash': {
      const cmd = (toolInput.command || '').slice(0, 100);
      if (/test|jest|vitest|pytest/i.test(cmd)) {
        return { msg: '🧪 Running tests...', level: 'info' };
      }
      if (/build|compile|tsc/i.test(cmd)) {
        return { msg: '🔨 Building...', level: 'info' };
      }
      if (/lint|eslint|prettier/i.test(cmd)) {
        return { msg: '✨ Linting...', level: 'info' };
      }
      if (/^git /i.test(cmd)) {
        return { msg: '🌿 Git operation...', level: 'info' };
      }
      return { msg: 'Running command...', level: 'command' };
    }
    case 'Task': {
      const desc = toolInput.description || 'subtask';
      return { msg: `🔄 ${desc}`, level: 'info' };
    }
    case 'WebSearch':
    case 'WebFetch':
      return { msg: '🌐 Web search...', level: 'info' };
    default:
      return null;
  }
}

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf-8');

  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const result = classify(input);
  if (!result) process.exit(0);

  const body = JSON.stringify({
    taskId: TASK_ID,
    message: result.msg,
    level: result.level,
  });

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (SECRET) {
      headers['Authorization'] = `Bearer ${SECRET}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    await fetch(`http://127.0.0.1:${PORT}/agent/log`, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch {
    // Daemon not running — silently exit
  }
}

main().catch(() => process.exit(0));
