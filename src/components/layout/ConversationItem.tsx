import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { Conversation } from '../../types';
import { cn } from '../../utils/cn';
import { formatRelativeTime } from '../../utils/time';
import { IconButton } from '../ui/IconButton';
import { IconMessage, IconPencil, IconTrash } from '../ui/Icon';

export interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}

export function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onRename,
  onDelete,
}: ConversationItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(conversation.title);

  const startEditing = () => {
    setDraft(conversation.title);
    setIsEditing(true);
  };

  /** Focuses and selects the field the moment it mounts. */
  const focusOnMount = (node: HTMLInputElement | null) => {
    if (!node) return;
    node.focus();
    node.select();
  };

  const commit = () => {
    const next = draft.trim();
    if (next) onRename(next);
    setIsEditing(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setIsEditing(false);
    }
  };

  return (
    <li>
      <div
        role="option"
        aria-selected={isActive}
        tabIndex={0}
        onClick={isEditing ? undefined : onSelect}
        onKeyDown={(event) => {
          if (isEditing) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect();
          }
        }}
        className={cn(
          'group flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors',
          isActive
            ? 'border-accent/40 bg-accent-soft'
            : 'hover:border-line hover:bg-surface-2 border-transparent',
        )}
      >
        <IconMessage size={15} className="text-ink-faint shrink-0" />

        {isEditing ? (
          <input
            ref={focusOnMount}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            aria-label="Conversation title"
            className="border-accent/50 bg-surface text-ink min-w-0 flex-1 rounded border px-1.5 py-0.5 text-sm focus:outline-none"
          />
        ) : (
          <div className="min-w-0 flex-1">
            <p className="text-ink truncate text-sm font-medium">{conversation.title}</p>
            <p className="text-ink-faint truncate text-[0.6875rem]">
              {formatRelativeTime(conversation.updatedAt)} · {conversation.messages.length}{' '}
              {conversation.messages.length === 1 ? 'message' : 'messages'}
            </p>
          </div>
        )}

        {!isEditing ? (
          <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 max-sm:opacity-100">
            <IconButton label={`Rename ${conversation.title}`} size={14} onClick={startEditing}>
              <IconPencil size={14} />
            </IconButton>
            <IconButton label={`Delete ${conversation.title}`} size={14} tone="danger" onClick={onDelete}>
              <IconTrash size={14} />
            </IconButton>
          </div>
        ) : null}
      </div>
    </li>
  );
}
