interface DiffHunk {
  header: string;
  lines: { type: 'add' | 'remove' | 'context'; content: string }[];
}

interface CodeDiffProps {
  filename: string;
  hunks: DiffHunk[];
}

export function CodeDiff({ filename, hunks }: CodeDiffProps) {
  return (
    <div className="bg-focus-bg border border-focus-border rounded-xl overflow-hidden font-mono text-xs">
      {/* File header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-focus-surface border-b border-focus-border">
        <span className="material-symbols-outlined text-text-secondary text-sm">description</span>
        <span className="text-text-secondary">{filename}</span>
      </div>

      {hunks.map((hunk, i) => (
        <div key={i}>
          <div className="px-3 py-1 text-text-secondary bg-focus-surface/50">
            {hunk.header}
          </div>
          {hunk.lines.map((line, j) => (
            <div
              key={j}
              className={`px-3 py-0.5 ${
                line.type === 'add'
                  ? 'bg-green-500/10 text-green-300'
                  : line.type === 'remove'
                    ? 'bg-red-500/10 text-red-300'
                    : 'text-gray-400'
              }`}
            >
              <span className="select-none inline-block w-4">
                {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
              </span>
              {line.content}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
