import { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '@/i18n/TranslationContext';
import type { Choice } from '@/shared/types';

interface ActionRequiredModalProps {
  question: string;
  choices: Choice[];
  onChoice: (choiceId: string) => void;
  onCancel: () => void;
  progress: { current: number; total: number; label?: string } | null;
}

export function ActionRequiredModal({
  question,
  choices,
  onChoice,
  onCancel,
  progress,
}: ActionRequiredModalProps) {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);

  // Focus trap implementation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
      return;
    }

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
  }, [onCancel]);

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
        className="max-w-lg w-full mx-4 bg-sushi-surface border border-sushi-border rounded-xl overflow-hidden"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-amber-400 text-2xl" aria-hidden="true">edit_document</span>
            </div>
            <div>
              <h2 id={titleId} className="text-lg font-bold text-heading">{t('actionRequired.title')}</h2>
              <p id={descId} className="text-sm text-text-secondary">{question}</p>
            </div>
          </div>

          {/* Choices */}
          {choices.length === 2 ? (
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                ref={firstFocusableRef}
                onClick={() => onChoice(choices[0].id)}
                className="py-3 bg-sushi-primary hover:bg-blue-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg" aria-hidden="true">check</span>
                {choices[0].label}
              </button>
              <button
                onClick={() => onChoice(choices[1].id)}
                className="py-3 bg-sushi-bg border border-sushi-border text-subtle font-medium rounded-xl transition-colors hover:bg-sushi-border flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg" aria-hidden="true">skip_next</span>
                {choices[1].label}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 mt-6">
              {choices.map((choice, index) => (
                <button
                  key={choice.id}
                  ref={index === 0 ? firstFocusableRef : undefined}
                  onClick={() => onChoice(choice.id)}
                  className="w-full py-3 bg-sushi-primary hover:bg-blue-600 text-white font-medium rounded-xl transition-colors"
                >
                  {choice.label}
                </button>
              ))}
            </div>
          )}

          <button
            className="w-full mt-3 text-center text-sm text-red-400 hover:text-red-300 transition-colors py-2"
            onClick={onCancel}
            aria-label={t('actionRequired.cancelTask')}
          >
            {t('actionRequired.cancelTask')}
          </button>
        </div>

        {/* Session Progress */}
        <div className="px-6 pb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold tracking-widest uppercase text-text-secondary">{t('actionRequired.sessionProgress')}</span>
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
      </div>
    </div>
  );
}
