import { useMemo } from 'react';
import type { ModelInfo } from '../../types';
import { cn } from '../../utils/cn';

export interface ModelSelectorProps {
  models: readonly ModelInfo[];
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  /** Adds the selected id to the list if discovery never returned it. */
  includeUnknown?: boolean;
}

/** Groups models by provider so long catalogues stay navigable. */
export function ModelSelector({
  models,
  value,
  onChange,
  disabled,
  id,
  className,
  includeUnknown = true,
}: ModelSelectorProps) {
  const grouped = useMemo(() => {
    const known =
      includeUnknown && !models.some((model) => model.id === value)
        ? [...models, { id: value, name: value, provider: 'Other', description: '', source: 'api' as const }]
        : [...models];

    const byProvider = new Map<string, ModelInfo[]>();
    for (const model of known) {
      const list = byProvider.get(model.provider) ?? [];
      list.push(model);
      byProvider.set(model.provider, list);
    }
    return Array.from(byProvider.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [models, value, includeUnknown]);

  return (
    <div className={cn('relative', className)}>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Model"
        className="border-line bg-surface text-ink hover:bg-surface-2 focus:border-accent w-full appearance-none truncate rounded-lg border py-2 pr-9 pl-3 text-sm transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      >
        {grouped.map(([provider, entries]) => (
          <optgroup key={provider} label={provider}>
            {entries.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="text-ink-faint pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}
