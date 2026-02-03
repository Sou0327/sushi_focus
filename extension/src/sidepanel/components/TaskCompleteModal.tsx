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
        className="max-w-md w-full mx-4 sushi-geta overflow-hidden"
      >
        {/* 🏮 暖簾風ヘッダー */}
        <div className="noren px-6 py-4 relative">
          <div className="absolute bottom-0 left-0 right-0 flex justify-around">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="w-5 h-2 bg-gradient-to-b from-transparent to-black/30 rounded-b-full"
              />
            ))}
          </div>
          <div className="text-center relative z-10">
            <div className="text-4xl mb-2 animate-bounce">🎉</div>
            <h2 id={titleId} className="text-xl font-bold text-white drop-shadow-lg">
              {t('taskComplete.title')}
            </h2>
          </div>
        </div>

        {/* 木のカウンター縁 */}
        <div className="h-2 bg-gradient-to-r from-sushi-woodDark via-sushi-wood to-sushi-woodDark" />

        {/* 📋 注文票コンテンツ */}
        <div className="p-6 bg-focus-surface">
          {/* お品書き風サマリー */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-sushi-wasabi/20 rounded-lg border-2 border-dashed border-sushi-wasabi/40">
              <span className="text-xl">✅</span>
              <span className="text-sushi-wasabi font-bold">{summary}</span>
            </div>
          </div>

          {/* 🍣 回転寿司風アニメーション */}
          <div className="flex justify-center gap-2 mb-6">
            {['🍣', '🍱', '🍙', '🍣', '🍱'].map((emoji, i) => (
              <span
                key={i}
                className="text-2xl animate-pulse"
                style={{ animationDelay: `${i * 0.15}s` }}
              >
                {emoji}
              </span>
            ))}
          </div>

          {/* カウントダウン表示 */}
          <div className="text-center mb-4">
            <p className="text-subtle text-sm mb-2" aria-live="polite">
              {t('taskComplete.returningToIde')}
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-focus-bg rounded-lg">
              <span className="text-lg">⏱️</span>
              <span className="font-mono font-bold text-2xl text-sushi-salmon">
                {(remaining / 1000).toFixed(1)}
              </span>
              <span className="text-muted text-sm">秒</span>
            </div>
          </div>

          {/* プログレスバー - わさびグリーン */}
          <div className="h-3 bg-focus-bg rounded-full overflow-hidden mb-6 border border-focus-border">
            <div
              className="h-full bg-gradient-to-r from-sushi-wasabi to-sushi-wasabiDark rounded-full transition-all duration-100"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* キャンセルボタン - 寿司プレート風 */}
          <button
            ref={cancelButtonRef}
            onClick={onCancel}
            className="w-full btn-danger py-4 flex items-center justify-center gap-3"
            aria-label={t('taskComplete.stayHere')}
          >
            <span className="text-xl">🛑</span>
            <span className="font-bold">{t('taskComplete.stayHere')}</span>
          </button>

          <p className="text-center text-xs text-muted mt-4">
            <kbd className="px-2 py-1 bg-focus-bg rounded border border-focus-border font-mono text-xs">
              {t('taskComplete.escKey')}
            </kbd>
            {' '}{t('taskComplete.toCancel')}
          </p>
        </div>

        {/* 木の台座 */}
        <div className="h-3 bg-gradient-to-r from-sushi-woodDark via-sushi-wood to-sushi-woodDark" />
      </div>
    </div>
  );
}
