import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';
import { IconChevronDown } from './Icon';

const CONTROL =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint ' +
  'transition-colors focus:border-accent focus:outline-none focus-visible:outline-none disabled:opacity-60';

export interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

/** Label + hint + error wrapper shared by every form control. */
export function Field({ label, htmlFor, hint, error, children, className, action }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-ink text-sm font-medium">
          {label}
        </label>
        {action}
      </div>
      {children}
      {error ? (
        <p className="text-danger text-xs" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-ink-faint text-xs leading-relaxed">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL, className)} {...props} />;
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL, 'resize-y leading-relaxed', className)} {...props} />;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode;
}

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select className={cn(CONTROL, 'appearance-none pr-9', className)} {...props}>
        {children}
      </select>
      <IconChevronDown
        size={16}
        className="text-ink-faint pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
      />
    </div>
  );
}

export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  value: number;
  formatValue?: (value: number) => string;
}

export function Slider({ label, value, formatValue, className, ...props }: SliderProps) {
  const id = useId();
  const display = formatValue ? formatValue(value) : String(value);
  return (
    <Field label={label} htmlFor={id} className={className}>
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="range"
          value={value}
          aria-valuetext={display}
          className="bg-surface-3 accent-accent h-1.5 w-full cursor-pointer appearance-none rounded-full"
          {...props}
        />
        <output
          htmlFor={id}
          className="border-line bg-surface-2 text-ink min-w-14 rounded-md border px-2 py-1 text-center text-xs font-medium tabular-nums"
        >
          {display}
        </output>
      </div>
    </Field>
  );
}

export interface SwitchProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Switch({ label, hint, checked, onChange, disabled }: SwitchProps) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-ink text-sm font-medium">
          {label}
        </label>
        {hint ? <p className="text-ink-faint mt-0.5 text-xs leading-relaxed">{hint}</p> : null}
      </div>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="bg-surface-3 checked:bg-accent mt-0.5 h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full transition-colors before:block before:h-4 before:w-4 before:translate-x-0.5 before:rounded-full before:bg-white before:transition-transform checked:before:translate-x-[1.15rem] disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  name?: string;
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  name,
}: SegmentedControlProps<T>) {
  const groupId = useId();

  const move = (index: number) => {
    const next = options[(index + options.length) % options.length];
    if (next) onChange(next.value);
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      id={`${groupId}-group`}
      onKeyDown={(event) => {
        const index = options.findIndex((option) => option.value === value);
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault();
          move(index + 1);
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault();
          move(index - 1);
        }
      }}
      className="border-line bg-surface-2 inline-flex rounded-lg border p-1"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            name={name}
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
              selected ? 'bg-surface text-ink font-medium shadow-sm' : 'text-ink-muted hover:text-ink',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
