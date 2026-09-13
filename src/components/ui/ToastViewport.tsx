import { cn } from '../../utils/cn';
import { useToasts } from '../../hooks/useToasts';
import { IconAlert, IconCheck, IconClose, IconInfo } from './Icon';

const TONES = {
  success: 'border-accent/40 bg-surface text-ink',
  error: 'border-danger/40 bg-surface text-ink',
  info: 'border-line bg-surface text-ink',
} as const;

const ICONS = {
  success: <IconCheck className="text-accent" />,
  error: <IconAlert className="text-danger" />,
  info: <IconInfo className="text-ink-muted" />,
} as const;

/** Renders queued toasts in the bottom-right corner (bottom-centre on mobile). */
export function ToastViewport() {
  const { toasts, dismiss } = useToasts();

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-3 bottom-3 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:items-end"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={cn(
            'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-lg',
            TONES[toast.tone],
          )}
        >
          <span className="mt-0.5 shrink-0">{ICONS[toast.tone]}</span>
          <p className="text-ink min-w-0 flex-1 text-sm leading-relaxed">{toast.message}</p>
          <div className="flex shrink-0 items-center gap-1">
            {toast.actionLabel ? (
              <button
                type="button"
                onClick={() => {
                  toast.onAction?.();
                  dismiss(toast.id);
                }}
                className="text-accent hover:bg-accent-soft rounded-md px-2 py-1 text-sm font-semibold"
              >
                {toast.actionLabel}
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(toast.id)}
              className="text-ink-faint hover:bg-surface-2 hover:text-ink rounded-md p-1"
            >
              <IconClose size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
