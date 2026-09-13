import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { IconButton } from '../ui/IconButton';
import { IconSend, IconStop } from '../ui/Icon';

const MAX_HEIGHT_PX = 220;

export interface ComposerProps {
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  disabledReason?: string;
  placeholder?: string;
  hint?: ReactNode;
}

export function Composer({
  onSend,
  onStop,
  isStreaming,
  disabled = false,
  disabledReason,
  placeholder = 'Send a message…',
  hint,
}: ComposerProps) {
  const [draft, setDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const labelId = useId();

  // Grow with the content up to a cap, then scroll internally.
  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [draft]);

  const canSend = draft.trim().length > 0 && !disabled && !isStreaming;

  const submit = () => {
    const text = draft.trim();
    if (!text || !canSend) return;
    onSend(text);
    setDraft('');
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter') return;
    // Shift+Enter inserts a newline; ignore Enter from an IME composition.
    if (event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };

  return (
    <div className="border-line bg-canvas border-t px-3 pt-3 pb-3 sm:px-6 sm:pb-5">
      <div className="mx-auto max-w-3xl">
        <div
          className={cn(
            'border-line bg-surface flex items-end gap-2 rounded-2xl border p-2 shadow-sm transition-colors',
            'focus-within:border-accent/60',
            disabled && 'opacity-70',
          )}
        >
          <textarea
            ref={textareaRef}
            id={labelId}
            rows={1}
            value={draft}
            disabled={disabled}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={disabledReason ?? placeholder}
            aria-label={disabledReason ? `Message input disabled: ${disabledReason}` : 'Message'}
            className="scroll-thin text-ink placeholder:text-ink-faint max-h-[220px] min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[0.9375rem] leading-relaxed focus:outline-none"
          />

          {isStreaming ? (
            <IconButton
              label="Stop generating"
              onClick={onStop}
              className="bg-danger-soft text-danger hover:bg-danger h-10 w-10 hover:text-white"
            >
              <IconStop size={16} />
            </IconButton>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!canSend}
              aria-label="Send message"
              title="Send (Enter)"
              className={cn(
                'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors',
                canSend
                  ? 'bg-accent text-accent-ink hover:bg-accent-strong'
                  : 'bg-surface-2 text-ink-faint cursor-not-allowed',
              )}
            >
              <IconSend size={18} />
            </button>
          )}
        </div>

        <div className="text-ink-faint mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 text-[0.6875rem]">
          <span>
            <kbd className="border-line bg-surface-2 rounded border px-1 py-0.5 font-sans text-[0.625rem]">
              Enter
            </kbd>{' '}
            to send ·{' '}
            <kbd className="border-line bg-surface-2 rounded border px-1 py-0.5 font-sans text-[0.625rem]">
              Shift + Enter
            </kbd>{' '}
            for a new line
          </span>
          {hint ? <span>{hint}</span> : null}
        </div>
      </div>
    </div>
  );
}
