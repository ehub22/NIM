import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../../types';
import { cn } from '../../utils/cn';
import { IconChevronDown } from '../ui/Icon';
import { MessageBubble } from './MessageBubble';

const STICK_THRESHOLD_PX = 96;

export interface MessageListProps {
  messages: readonly ChatMessage[];
  /** Id of the message currently receiving tokens, if any. */
  streamingMessageId: string | null;
  canRegenerate: boolean;
  onRegenerate: () => void;
}

/**
 * Transcript with auto-scroll: it follows the answer while streaming, but
 * stops following as soon as the user scrolls up, and offers a jump-to-end
 * button in that case.
 */
export function MessageList({ messages, streamingMessageId, canRegenerate, onRegenerate }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

  const lastAssistantId = [...messages].reverse().find((message) => message.role === 'assistant')?.id;

  const handleScroll = useCallback(() => {
    const element = containerRef.current;
    if (!element) return;
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    stickRef.current = distance < STICK_THRESHOLD_PX;
    setAtBottom(stickRef.current);
  }, []);

  const jumpToEnd = useCallback((behavior: ScrollBehavior = 'smooth') => {
    endRef.current?.scrollIntoView({ behavior, block: 'end' });
    stickRef.current = true;
    setAtBottom(true);
  }, []);

  // Opening a conversation always starts at the latest message.
  useLayoutEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
  }, []);

  useEffect(() => {
    if (!stickRef.current) return;
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, streamingMessageId]);

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="scroll-thin h-full overflow-y-auto scroll-smooth px-3 py-6 sm:px-6"
        tabIndex={0}
        role="log"
        aria-label="Conversation messages"
        aria-live="polite"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isStreaming={streamingMessageId === message.id}
              canRegenerate={canRegenerate && message.id === lastAssistantId}
              onRegenerate={onRegenerate}
            />
          ))}
          <div ref={endRef} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => jumpToEnd()}
        aria-label="Scroll to latest message"
        className={cn(
          'border-line bg-surface text-ink-muted absolute bottom-4 left-1/2 inline-flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border shadow-md transition-all',
          atBottom ? 'pointer-events-none translate-y-3 opacity-0' : 'hover:text-ink opacity-100',
        )}
      >
        <IconChevronDown size={18} />
      </button>
    </div>
  );
}
