import { useEffect, useState, useRef, useCallback } from 'react';
import { useTranslation } from '@/i18n/TranslationContext';

interface TaskCompleteModalProps {
  summary: string;
  countdownMs: number;
  onComplete: () => void;
  onCancel: () => void;
}

export function TaskCompleteModal({
  summary,
  countdownMs,
  onComplete,
  onCancel,
}: TaskCompleteModalProps) {
  const { t } = useTranslation();
  const [remaining, setRemaining] = useState(countdownMs);
  const modalRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const onCompleteRef = useRef(onComplete);
  const onCancelRef = useRef(onCancel);

  // Keep refs up to date
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onCancelRef.current = onCancel;
  }, [onComplete, onCancel]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 100;
        if (next <= 0) {
          clearInterval(interval);
          onCompleteRef.current();
          return 0;
        }
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [countdownMs]);

  // Focus trap and keyboard handling
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancelRef.current();
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
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    // Focus cancel button on mount
    cancelButtonRef.current?.focus();
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const titleId = 'task-complete-title';

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        ref={modalRef}
        className="max-w-md w-full mx-4 bg-focus-surface border border-focus-border rounded-xl overflow-hidden"
      >
        {/* Gradient top line */}
        <div className="h-1 bg-gradient-to-r from-focus-success via-focus-primary to-purple-500" />

        <div className="p-8 text-center">
          {/* Animated check icon */}
          <div className="relative inline-flex items-center justify-center mb-5">
            <span className="absolute w-16 h-16 rounded-full bg-focus-success/20 animate-ping" aria-hidden="true" />
            <span className="relative w-16 h-16 rounded-full bg-focus-success/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-focus-success text-4xl" aria-hidden="true">check_circle</span>
            </span>
          </div>

          <h2 id={titleId} className="text-2xl font-bold text-heading mb-2">{t('taskComplete.title')}</h2>
          <p className="text-text-secondary mb-1">{summary}</p>
          <p className="text-text-secondary text-sm" aria-live="polite">
            {t('taskComplete.returningToIde')}{' '}
            <span className="font-mono font-bold text-heading text-lg">
              {(remaining / 1000).toFixed(1)}s
            </span>
            {' '}...
          </p>

          {/* Cancel button */}
          <button
            ref={cancelButtonRef}
            onClick={onCancel}
            className="w-full mt-6 py-3 bg-focus-primary hover:bg-blue-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            aria-label={t('taskComplete.stayHere')}
          >
            <span className="material-symbols-outlined text-lg" aria-hidden="true">pan_tool</span>
            {t('taskComplete.stayHere')}
          </button>

          <p className="text-xs text-muted mt-3">
            {t('taskComplete.pressEscToCancel')}{t('taskComplete.pressEscToCancel') ? ' ' : ''}<kbd className="px-1.5 py-0.5 bg-focus-bg rounded text-muted font-mono text-xs">{t('taskComplete.escKey')}</kbd>{' '}{t('taskComplete.toCancel')}
          </p>
        </div>
      </div>
    </div>
  );
}
