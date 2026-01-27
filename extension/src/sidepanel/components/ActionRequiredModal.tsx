import type { Choice } from '@/shared/types';

interface ActionRequiredModalProps {
  question: string;
  choices: Choice[];
  onChoice: (choiceId: string) => void;
}

export function ActionRequiredModal({
  question,
  choices,
  onChoice,
}: ActionRequiredModalProps) {
  return (
    <div className="overlay">
      <div className="card max-w-md w-full mx-4 animate-pulse-glow">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">🟡</span>
          <h2 className="text-lg font-bold text-white">Input Required</h2>
        </div>

        <p className="text-gray-300 mb-6">{question}</p>

        <div className="flex flex-col gap-2">
          {choices.map((choice) => (
            <button
              key={choice.id}
              onClick={() => onChoice(choice.id)}
              className="btn-primary w-full justify-center"
            >
              {choice.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
