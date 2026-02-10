import { useEffect, useState, useRef, useCallback } from 'react';
import { useTranslation } from '@/i18n/TranslationContext';
import { SushiTaro } from '@/shared/components/SushiTaro';
import type { Theme } from '@/shared/types';

interface TaskCompleteModalProps {
  summary: string;
  countdownMs: number;
  onComplete: () => void;
  onCancel: () => void;
  theme: Theme;
}

export function TaskCompleteModal({
  summary,
  countdownMs,
  onComplete,
  onCancel,
  theme,
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
  const progressPercent = (remaining / countdownMs) * 100;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        ref={modalRef}
        className="max-w-md w-full mx-4 bg-sushi-surface border border-sushi-border rounded-lg overflow-hidden shadow-xl"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[var(--noren-top)] to-[var(--noren-bottom)] px-6 py-4">
          <div className="text-center">
            <div className="text-3xl mb-1 animate-bounce">🎉</div>
            <h2 id={titleId} className="text-lg font-bold text-white">
              {t('taskComplete.title')}
            </h2>
          </div>
        </div>

        {/* Wood counter edge */}
        <div className="h-1 bg-gradient-to-r from-sushi-woodDark via-sushi-wood to-sushi-woodDark" />

        {/* Content */}
        <div className="p-6">
          {/* Summary */}
          <div className="text-center mb-5">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-sushi-wasabi/10 rounded-lg border border-sushi-wasabi/30">
              <span className="text-sushi-wasabi font-medium text-sm">{summary}</span>
            </div>
          </div>

          {/* SushiTaro animation - 3 characters */}
          <div className="flex justify-center gap-2 mb-5">
            {[0, 1, 2].map((i) => (
              <SushiTaro
                key={i}
                size="lg"
                className="animate-pulse"
                style={{ animationDelay: `${i * 0.2}s` } as React.CSSProperties}
                theme={theme}
              />
            ))}
          </div>

          {/* Countdown display */}
          <div className="text-center mb-4">
            <p className="text-subtle text-sm mb-2" aria-live="polite">
              {t('taskComplete.returningToIde')}
            </p>
            <div className="inline-flex items-center gap-2">
              <span className="text-sm">⏱️</span>
              <span className="font-mono font-bold text-xl text-sushi-salmon">
                {(remaining / 1000).toFixed(1)}
              </span>
              <span className="text-muted text-xs">{t('common.seconds')}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-sushi-bg rounded-full overflow-hidden mb-6 border border-sushi-border">
            <div
              className="h-full bg-sushi-wasabi rounded-full transition-all duration-100"
              style={{
                width: `${progressPercent}%`,
                boxShadow: '0 0 8px rgba(124,179,66,0.4)',
              }}
            />
          </div>

          {/* Cancel button */}
          <button
            ref={cancelButtonRef}
            onClick={onCancel}
            className="w-full py-3 bg-sushi-bg border border-sushi-border text-subtle font-medium rounded-lg transition-colors hover:bg-sushi-border flex items-center justify-center gap-2"
            aria-label={t('taskComplete.stayHere')}
          >
            <span>{t('taskComplete.stayHere')}</span>
          </button>

          <p className="text-center text-xs text-muted mt-3">
            <kbd className="px-2 py-0.5 bg-sushi-bg rounded border border-sushi-border font-mono text-[10px]">
              {t('taskComplete.escKey')}
            </kbd>
            {' '}{t('taskComplete.toCancel')}
          </p>
        </div>

        {/* Wood base */}
        <div className="h-1 bg-gradient-to-r from-sushi-woodDark via-sushi-wood to-sushi-woodDark" />
      </div>
    </div>
  );
}
