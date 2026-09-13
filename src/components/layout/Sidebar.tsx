import { useMemo, useState } from 'react';
import type { ConnectionState, Conversation } from '../../types';
import { cn } from '../../utils/cn';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { IconButton } from '../ui/IconButton';
import { StatusPill } from '../ui/StatusPill';
import { TextInput } from '../ui/Field';
import { IconAlert, IconClose, IconPlus, IconSearch, IconSettings, IconSparkle } from '../ui/Icon';
import { ConversationItem } from './ConversationItem';

export interface SidebarProps {
  conversations: readonly Conversation[];
  activeId: string | null;
  connection: ConnectionState;
  storageWarning: string | null;
  open: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onOpenSettings: () => void;
  onClose: () => void;
}

export function Sidebar({
  conversations,
  activeId,
  connection,
  storageWarning,
  open,
  onSelect,
  onNew,
  onRename,
  onDelete,
  onClearAll,
  onOpenSettings,
  onClose,
}: SidebarProps) {
  const [query, setQuery] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter(
      (conversation) =>
        conversation.title.toLowerCase().includes(needle) ||
        conversation.messages.some((message) => message.content.toLowerCase().includes(needle)),
    );
  }, [conversations, query]);

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[1px] lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}

      <aside
        aria-label="Conversations"
        className={cn(
          'border-line bg-surface fixed inset-y-0 left-0 z-40 flex w-[17.5rem] shrink-0 flex-col border-r transition-transform duration-200',
          'lg:static lg:z-auto lg:translate-x-0',
          open ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="bg-accent text-accent-ink inline-flex h-8 w-8 items-center justify-center rounded-lg">
              <IconSparkle size={17} />
            </span>
            <div className="min-w-0">
              <p className="text-ink truncate text-sm font-semibold">NIM Chat</p>
              <p className="text-ink-faint truncate text-[0.6875rem]">NVIDIA NIM client</p>
            </div>
          </div>
          <IconButton label="Close sidebar" onClick={onClose} className="lg:hidden">
            <IconClose />
          </IconButton>
        </div>

        <div className="space-y-2 px-3 pb-3">
          <Button variant="primary" fullWidth onClick={onNew} className="justify-start">
            <IconPlus size={16} />
            New conversation
          </Button>

          <div className="relative">
            <IconSearch
              size={15}
              className="text-ink-faint pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
            />
            <TextInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search conversations"
              aria-label="Search conversations"
              className="pl-8"
            />
          </div>
        </div>

        <div className="scroll-thin flex-1 overflow-y-auto px-2 pb-2">
          {filtered.length === 0 ? (
            <p className="text-ink-faint px-3 py-6 text-center text-xs">
              {conversations.length === 0
                ? 'No conversations yet. Start one above.'
                : 'No conversations match your search.'}
            </p>
          ) : (
            <ul role="listbox" aria-label="Conversation list" className="flex flex-col gap-0.5">
              {filtered.map((conversation) => (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  isActive={conversation.id === activeId}
                  onSelect={() => {
                    onSelect(conversation.id);
                    onClose();
                  }}
                  onRename={(title) => onRename(conversation.id, title)}
                  onDelete={() => onDelete(conversation.id)}
                />
              ))}
            </ul>
          )}
        </div>

        {storageWarning ? (
          <p className="border-warning/40 bg-surface-2 text-ink-muted mx-3 mb-2 flex items-start gap-2 rounded-lg border px-2.5 py-2 text-[0.6875rem] leading-relaxed">
            <IconAlert size={13} className="text-warning mt-0.5 shrink-0" />
            {storageWarning}
          </p>
        ) : null}

        <div className="border-line flex items-center justify-between gap-2 border-t px-3 py-2.5">
          <StatusPill connection={connection} />
          <div className="flex items-center gap-0.5">
            {conversations.length > 0 ? (
              <IconButton
                label="Delete all conversations"
                tone="danger"
                onClick={() => setConfirmClear(true)}
              >
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
                >
                  <path d="M4 7h16M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                </svg>
              </IconButton>
            ) : null}
            <IconButton label="Open settings" onClick={onOpenSettings}>
              <IconSettings />
            </IconButton>
          </div>
        </div>
      </aside>

      <ConfirmDialog
        open={confirmClear}
        title="Delete all conversations?"
        message={`This permanently removes ${conversations.length} conversation${
          conversations.length === 1 ? '' : 's'
        } from this browser. Export them first if you want a copy.`}
        confirmLabel="Delete everything"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          setConfirmClear(false);
          onClearAll();
        }}
      />
    </>
  );
}
