import React, { useState } from 'react';

interface TaskInputProps {
  onRun: (prompt: string) => void;
  disabled: boolean;
}

const PRESETS = [
  { id: 'fix', label: '🔧 Fix', prompt: 'Fix the current issue' },
  { id: 'test', label: '🧪 Test', prompt: 'Run tests' },
  { id: 'refactor', label: '♻️ Refactor', prompt: 'Refactor the code' },
];

export function TaskInput({ onRun, disabled }: TaskInputProps) {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !disabled) {
      onRun(prompt.trim());
      setPrompt('');
    }
  };

  const handlePreset = (presetPrompt: string) => {
    if (!disabled) {
      onRun(presetPrompt);
    }
  };

  return (
    <div className="p-3 border-b border-focus-border">
      {/* Prompt Input */}
      <form onSubmit={handleSubmit} className="mb-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What should I do? (e.g., 'Fix this error')"
            className="input flex-1"
            disabled={disabled}
          />
          <button
            type="submit"
            disabled={disabled || !prompt.trim()}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Run
          </button>
        </div>
      </form>

      {/* Presets */}
      <div className="flex gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => handlePreset(preset.prompt)}
            disabled={disabled}
            className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
