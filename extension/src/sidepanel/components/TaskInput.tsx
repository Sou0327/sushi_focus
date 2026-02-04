import React, { useState } from 'react';
import { useTranslation } from '@/i18n/TranslationContext';

interface TaskInputProps {
  onRun: (prompt: string, image?: string) => void;
  disabled: boolean;
}

export function TaskInput({ onRun, disabled }: TaskInputProps) {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState('');
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const PRESETS = [
    { id: 'fix', label: t('taskInput.presets.fixBug'), icon: 'bug_report', color: 'text-orange-400 border-orange-400/30', template: t('taskInput.presets.fixBugTemplate'), action: 'insert' as const },
    { id: 'test', label: t('taskInput.presets.runTests'), icon: 'science', color: 'text-green-400 border-green-400/30', template: t('taskInput.presets.runTestsTemplate'), action: 'run' as const },
    { id: 'refactor', label: t('taskInput.presets.refactor'), icon: 'cleaning_services', color: 'text-purple-400 border-purple-400/30', template: t('taskInput.presets.refactorTemplate'), action: 'insert' as const },
  ];

  const handleSubmit = () => {
    if (prompt.trim() && !disabled) {
      onRun(prompt.trim(), imageData || undefined);
      setPrompt('');
      setImageData(null);
      setImageName(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImageData(reader.result as string);
      setImageName(file.name);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handlePresetClick = (preset: typeof PRESETS[number]) => {
    if (disabled) return;
    if (preset.action === 'run') {
      onRun(preset.template);
    } else {
      // Append template to existing input instead of overwriting
      setPrompt(prev => prev + preset.template);
      textareaRef.current?.focus();
    }
  };

  return (
    <div className="px-4 pb-3">
      <div className="relative bg-sushi-surface border border-sushi-border rounded-xl overflow-hidden">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('taskInput.placeholder')}
          disabled={disabled}
          rows={3}
          className="w-full bg-transparent px-4 pt-3 pb-10 text-sm placeholder-muted resize-none focus:outline-none"
        />
        {imageData && (
          <div className="px-3 pb-1 flex items-center gap-2">
            <img src={imageData} alt="preview" className="w-10 h-10 rounded-lg object-cover border border-sushi-border" />
            <span className="text-xs text-muted truncate flex-1">{imageName}</span>
            <button
              type="button"
              onClick={() => { setImageData(null); setImageName(null); }}
              className="text-muted hover:text-red-400 text-sm"
              aria-label={t('taskInput.removeImage')}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        )}
        <div className="absolute bottom-2 right-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 text-text-secondary hover:text-heading rounded-lg transition-colors"
            title={t('taskInput.attachImage')}
            aria-label={t('taskInput.attachImage')}
          >
            <span className="material-symbols-outlined text-xl" aria-hidden="true">image</span>
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={disabled || !prompt.trim()}
            className="w-9 h-9 flex items-center justify-center bg-sushi-primary hover:bg-blue-600 text-white rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={t('taskInput.runTask')}
          >
            <span className="material-symbols-outlined text-xl" aria-hidden="true">play_arrow</span>
          </button>
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => handlePresetClick(preset)}
            disabled={disabled}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors hover:bg-white/5 disabled:opacity-50 ${preset.color}`}
          >
            <span className="material-symbols-outlined text-base">{preset.icon}</span>
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
