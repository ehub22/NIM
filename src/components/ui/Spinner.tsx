import { cn } from '../../utils/cn';

export interface SpinnerProps {
  size?: number;
  className?: string;
  label?: string;
}

/** Animated progress indicator. `label` makes it announced as a status. */
export function Spinner({ size = 16, className, label }: SpinnerProps) {
  return (
    <span
      role={label ? 'status' : undefined}
      aria-label={label}
      className={cn('inline-flex items-center justify-center', className)}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="animate-spin"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  );
}
