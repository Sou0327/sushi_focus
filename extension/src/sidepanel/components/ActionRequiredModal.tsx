import { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '@/i18n/TranslationContext';
import type { Choice } from '@/shared/types';

interface ActionRequiredModalProps {
  taskId: string;
  taskPrompt: string | null;
  question: string;
  choices: Choice[];
  onChoice: (choiceId: string) => void;
  progress: { current: number; total: number; label?: string } | null;
  pendingCount: number;
}

export function ActionRequiredModal({
  taskId: _taskId, // Reserved for future task-specific logic
  taskPrompt,
  question,
  choices,
  onChoice,
  progress,
  pendingCount,
}: ActionRequiredModalProps) {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);

  // Focus trap implementation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    const modal = modalRef.current;
    if (!modal) return;

    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    // Focus first button on mount
    firstFocusableRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const titleId = 'action-required-title';
  const descId = 'action-required-desc';

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <div
        ref={modalRef}
        className="max-w-lg w-full mx-4 bg-sushi-surface border border-sushi-border rounded-lg overflow-hidden shadow-xl"
      >
        {/* Themed header */}
        <div className="bg-gradient-to-r from-amber-600/90 to-amber-700/90 px-6 py-4">
          <div className="flex items-center gap-3">
            <h2 id={titleId} className="text-lg font-bold text-white">{t('actionRequired.title')}</h2>
            {pendingCount > 1 && (
              <span className="text-xs px-2 py-0.5 bg-white/20 text-white rounded-full">1/{pendingCount}</span>
            )}
          </div>
          {taskPrompt && (
            <p className="text-xs text-white/70 mt-1 truncate">{taskPrompt.slice(0, 60)}{taskPrompt.length > 60 ? '...' : ''}</p>
          )}
        </div>

        {/* Question & Choices */}
        <div className="p-6">
          <p id={descId} className="text-sm text-subtle mb-6">{question}</p>

          {choices.length === 2 ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                ref={firstFocusableRef}
                onClick={() => onChoice(choices[0].id)}
                className="py-3 bg-sushi-salmon hover:bg-sushi-salmonGlow text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {choices[0].label}
              </button>
              <button
                onClick={() => onChoice(choices[1].id)}
                className="py-3 bg-sushi-bg border border-sushi-border text-subtle font-medium rounded-lg transition-colors hover:bg-sushi-border flex items-center justify-center gap-2"
              >
                {choices[1].label}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {choices.map((choice, index) => (
                <button
                  key={choice.id}
                  ref={index === 0 ? firstFocusableRef : undefined}
                  onClick={() => onChoice(choice.id)}
                  className="w-full py-3 bg-sushi-salmon hover:bg-sushi-salmonGlow text-white font-medium rounded-lg transition-colors"
                >
                  {choice.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Session Progress */}
        <div className="px-6 pb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-medium tracking-wider uppercase text-muted">{t('actionRequired.sessionProgress')}</span>
            <span className="text-xs text-amber-400" aria-live="polite">
              {progress ? `${progress.label || `${progress.current}/${progress.total}`}` : t('actionRequired.paused')}
            </span>
          </div>
          <div className="h-1 bg-sushi-bg rounded-full overflow-hidden" role="progressbar" aria-valuenow={progress?.current ?? 0} aria-valuemax={progress?.total ?? 100}>
            {progress ? (
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-300"
                style={{ width: `${Math.round((progress.current / Math.max(progress.total, 1)) * 100)}%` }}
              />
            ) : (
              <div className="h-full w-full bg-amber-400/30 rounded-full animate-pulse" />
            )}
          </div>
        </div>

        {/* Wood counter bottom */}
        <div className="h-1 bg-gradient-to-r from-sushi-woodDark via-sushi-wood to-sushi-woodDark" />
      </div>
    </div>
  );
}
