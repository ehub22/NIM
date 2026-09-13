import { createContext } from 'react';
import type { ChatMessage, Conversation, ModelSettings } from '../types';
import type { ImportResult } from '../storage/conversations';

export interface ConversationsApi {
  /** Sorted by `updatedAt`, newest first. */
  conversations: readonly Conversation[];
  activeId: string | null;
  active: Conversation | null;
  /** Non-null when a write to browser storage failed (e.g. quota exceeded). */
  storageWarning: string | null;

  create: (options?: { model?: string; settings?: ModelSettings }) => Conversation;
  select: (id: string | null) => void;
  rename: (id: string, title: string) => void;
  remove: (id: string) => void;
  clearAll: () => void;
  setModel: (id: string, model: string) => void;
  updateSettings: (id: string, patch: Partial<ModelSettings>) => void;
  appendMessage: (conversationId: string, message: ChatMessage) => void;
  patchMessage: (conversationId: string, messageId: string, patch: Partial<ChatMessage>) => void;
  truncateFromMessage: (conversationId: string, messageId: string) => void;
  autoTitle: (conversationId: string, firstUserMessage: string) => void;

  exportJson: () => string;
  /** Throws `ImportFormatError` for unusable files. */
  importJson: (raw: string) => ImportResult;
}

export const ConversationsContext = createContext<ConversationsApi | null>(null);
