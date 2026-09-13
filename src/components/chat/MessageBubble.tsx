import { useCallback, useState } from 'react';
import type { ChatMessage } from '../../types';
import { cn } from '../../utils/cn';
import { copyText } from '../../utils/clipboard';
import { formatClockTime, formatDateTime } from '../../utils/time';
import { formatCompactNumber } from '../../utils/format';
import { IconAlert, IconCheck, IconCopy, IconRefresh } from '../ui/Icon';
import { MarkdownContent } from './MarkdownContent';

export interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming: boolean;
  /** Only the final assistant turn can be regenerated. */
  canRegenerate: boolean;
  onRegenerate: () => void;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (await copyText(text)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      aria-label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
      title={copied ? 'Copied' : label}
      className={cn(
        'inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-xs transition-colors',
        copied ? 'text-accent' : 'text-ink-faint hover:bg-surface-2 hover:text-ink',
      )}
    >
      {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
      {copied ? 'Copied' : null}
    </button>
  );
}

export function MessageBubble({ message, isStreaming, canRegenerate, onRegenerate }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isError = message.status === 'error';
  const wasAborted = message.status === 'aborted';
  const isEmptyStreaming = isStreaming && message.content.length === 0;

  return (
    <article
      className={cn('group flex w-full gap-3', isUser ? 'justify-end' : 'justify-start')}
      aria-label={`${isUser ? 'You' : 'Assistant'}${isError ? ' (error)' : ''}`}
    >
      <div
        className={cn(
          'flex min-w-0 flex-col',
          isUser ? 'items-end' : 'items-start',
          isUser ? 'max-w-[85%] sm:max-w-[75%]' : 'w-full',
        )}
      >
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-[0.9375rem] leading-relaxed',
            isUser
              ? 'bg-accent-soft text-ink border-accent/25 rounded-br-md border'
              : 'border-line bg-surface w-full rounded-bl-md border',
            isError && 'border-danger/50 bg-danger-soft',
          )}
        >
          {isUser ? (
            <p className="break-words whitespace-pre-wrap">{message.content}</p>
          ) : isEmptyStreaming ? (
            <p className="text-ink-faint text-sm" role="status">
              Thinking…
            </p>
          ) : (
            <MarkdownContent content={message.content} isStreaming={isStreaming} />
          )}

          {isError && message.error ? (
            <p className="border-danger/30 text-danger mt-3 flex items-start gap-2 border-t pt-3 text-sm">
              <IconAlert size={15} className="mt-0.5 shrink-0" />
              <span className="min-w-0 break-words">{message.error}</span>
            </p>
          ) : null}

          {wasAborted ? <p className="text-ink-faint mt-2 text-xs italic">Generation stopped.</p> : null}
        </div>

        <div className="mt-1 flex items-center gap-1 px-1">
          <span
            className="text-ink-faint text-[0.6875rem] tabular-nums"
            title={formatDateTime(message.createdAt)}
          >
            {formatClockTime(message.createdAt)}
            {message.usage ? ` · ${formatCompactNumber(message.usage.totalTokens)} tokens` : ''}
          </span>

          {message.content ? <CopyButton text={message.content} label="Copy message" /> : null}

          {!isUser && canRegenerate && !isStreaming ? (
            <button
              type="button"
              onClick={onRegenerate}
              aria-label="Regenerate this response"
              title="Regenerate response"
              className="text-ink-faint hover:bg-surface-2 hover:text-ink inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-xs transition-colors"
            >
              <IconRefresh size={13} />
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
