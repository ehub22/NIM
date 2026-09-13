import { Button } from '../ui/Button';
import { IconKey, IconSparkle } from '../ui/Icon';

const SUGGESTIONS = [
  'Explain what a NIM microservice is in three sentences.',
  'Write a Python function that streams Server-Sent Events with fetch.',
  'Review this TypeScript hook and suggest improvements.',
];

export interface EmptyStateProps {
  hasApiKey: boolean;
  modelName: string;
  onOpenSettings: () => void;
  onSelectSuggestion: (text: string) => void;
}

/** First-run guidance shown when a conversation has no messages yet. */
export function EmptyState({ hasApiKey, modelName, onOpenSettings, onSelectSuggestion }: EmptyStateProps) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 px-4 py-10 text-center">
      <span className="border-accent/30 bg-accent-soft text-accent inline-flex h-14 w-14 items-center justify-center rounded-2xl border">
        <IconSparkle size={26} />
      </span>

      <div className="space-y-2">
        <h2 className="text-ink text-xl font-semibold">Start a conversation with NVIDIA NIM</h2>
        <p className="text-ink-muted text-sm leading-relaxed">
          Messages are sent from your browser straight to the NIM endpoint and stored only on this device. You
          are talking to <span className="text-ink font-medium">{modelName}</span>.
        </p>
      </div>

      {!hasApiKey ? (
        <div className="border-line bg-surface text-ink-muted flex w-full flex-col items-center gap-3 rounded-xl border p-4 text-sm">
          <p className="flex items-center gap-2">
            <IconKey size={16} className="text-accent" />
            Add your NVIDIA NIM API key to begin. It never leaves your browser.
          </p>
          <Button variant="primary" size="sm" onClick={onOpenSettings}>
            Add API key
          </Button>
        </div>
      ) : (
        <ul className="flex w-full flex-col gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                onClick={() => onSelectSuggestion(suggestion)}
                className="border-line bg-surface text-ink-muted hover:border-accent/40 hover:text-ink w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors"
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
