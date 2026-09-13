import type { ConnectionState } from '../../types';
import { cn } from '../../utils/cn';

const TONE: Record<ConnectionState['status'], { dot: string; text: string; label: string }> = {
  online: { dot: 'bg-accent', text: 'text-ink-muted', label: 'Connected' },
  checking: { dot: 'bg-warning animate-pulse', text: 'text-ink-muted', label: 'Connecting…' },
  unavailable: { dot: 'bg-warning', text: 'text-ink-muted', label: 'Fallback models' },
  'missing-key': { dot: 'bg-danger', text: 'text-ink-muted', label: 'No API key' },
};

export interface StatusPillProps {
  connection: ConnectionState;
  className?: string;
}

/** Compact API connection indicator; the detail string is the tooltip. */
export function StatusPill({ connection, className }: StatusPillProps) {
  const tone = TONE[connection.status];
  return (
    <span
      className={cn(
        'border-line bg-surface-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs',
        tone.text,
        className,
      )}
      title={connection.detail ?? tone.label}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} aria-hidden="true" />
      <span className="font-medium">{tone.label}</span>
      <span className="sr-only">: {connection.detail ?? tone.label}</span>
    </span>
  );
}
