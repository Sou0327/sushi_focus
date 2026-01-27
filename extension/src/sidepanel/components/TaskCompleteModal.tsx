import { useEffect, useState } from 'react';

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
  const [remaining, setRemaining] = useState(countdownMs);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 100;
        if (next <= 0) {
          clearInterval(interval);
          onComplete();
          return 0;
        }
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [countdownMs, onComplete]);

  const progress = (remaining / countdownMs) * 100;

  return (
    <div className="overlay">
      <div className="card max-w-md w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">✅</span>
          <h2 className="text-lg font-bold text-white">Task Complete!</h2>
        </div>

        <p className="text-gray-300 mb-4">{summary}</p>

        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-400 mb-1">
            <span>Returning to home tab...</span>
            <span>{(remaining / 1000).toFixed(1)}s</span>
          </div>
          <div className="h-2 bg-focus-border rounded-full overflow-hidden">
            <div
              className="h-full bg-focus-warning transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <button
          onClick={onCancel}
          className="btn-secondary w-full"
        >
          Cancel (Stay here)
        </button>
      </div>
    </div>
  );
}
