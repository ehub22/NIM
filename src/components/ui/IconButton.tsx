import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: this is the accessible name for an icon-only control. */
  label: string;
  size?: number;
  tone?: 'default' | 'danger';
  active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = 18, tone = 'default', active = false, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active || undefined}
      className={cn(
        'text-ink-muted inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
        'hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-45',
        tone === 'danger' && 'hover:bg-danger-soft hover:text-danger',
        active && 'bg-surface-2 text-ink',
        className,
      )}
      {...props}
    >
      <span className="inline-flex" style={{ width: size, height: size }}>
        {children}
      </span>
    </button>
  );
});
