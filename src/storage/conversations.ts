/**
 * Pure conversation operations. Every function returns a new array so React
 * state updates are straightforward, and nothing here touches the browser
 * APIs — persistence is layered on top in `useConversations`.
 */
import type { ChatMessage, Conversation, ModelSettings } from '../types';
import { createId } from '../utils/id';
import { deriveTitle, UNTITLED_CONVERSATION } from '../utils/title';
import { LIMITS, sanitizeConversation, sanitizeConversationList } from './schema';
import { SCHEMA_VERSION } from './keys';

export interface CreateConversationInput {
  model: string;
  settings: ModelSettings;
  title?: string;
}

export function createConversation(input: CreateConversationInput, now: number = Date.now()): Conversation {
  return {
    id: createId('conv'),
    title: input.title?.trim() || UNTITLED_CONVERSATION,
    model: input.model,
    createdAt: now,
    updatedAt: now,
    messages: [],
    settings: { ...input.settings },
  };
}

/** Newest first; ties broken by creation time so the order stays stable. */
export function sortByUpdatedAt(list: readonly Conversation[]): Conversation[] {
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt);
}

export function appendMessage(
  list: readonly Conversation[],
  conversationId: string,
  message: ChatMessage,
  now: number = Date.now(),
): Conversation[] {
  return list.map((conversation) =>
    conversation.id === conversationId
      ? { ...conversation, messages: [...conversation.messages, message], updatedAt: now }
      : conversation,
  );
}

/**
 * Patches a single message in place — used while streaming (content grows) and
 * when a response finishes, errors out or is stopped.
 */
export function patchMessage(
  list: readonly Conversation[],
  conversationId: string,
  messageId: string,
  patch: Partial<ChatMessage>,
  now: number = Date.now(),
): Conversation[] {
  return list.map((conversation) => {
    if (conversation.id !== conversationId) return conversation;
    const messages = conversation.messages.map((message) =>
      message.id === messageId ? { ...message, ...patch } : message,
    );
    return { ...conversation, messages, updatedAt: now };
  });
}

export function renameConversation(
  list: readonly Conversation[],
  conversationId: string,
  title: string,
  now: number = Date.now(),
): Conversation[] {
  const cleaned = title.trim().slice(0, LIMITS.titleLength);
  const next = cleaned || UNTITLED_CONVERSATION;
  return list.map((conversation) =>
    conversation.id === conversationId ? { ...conversation, title: next, updatedAt: now } : conversation,
  );
}

export function deleteConversation(list: readonly Conversation[], conversationId: string): Conversation[] {
  return list.filter((conversation) => conversation.id !== conversationId);
}

export function updateSettings(
  list: readonly Conversation[],
  conversationId: string,
  patch: Partial<ModelSettings>,
  now: number = Date.now(),
): Conversation[] {
  return list.map((conversation) =>
    conversation.id === conversationId
      ? { ...conversation, settings: { ...conversation.settings, ...patch }, updatedAt: now }
      : conversation,
  );
}

export function setModel(
  list: readonly Conversation[],
  conversationId: string,
  model: string,
  now: number = Date.now(),
): Conversation[] {
  return list.map((conversation) =>
    conversation.id === conversationId ? { ...conversation, model, updatedAt: now } : conversation,
  );
}

/**
 * Drops every message from `messageId` onwards, which is what "regenerate the
 * last answer" needs before re-sending the trimmed history.
 */
export function truncateFromMessage(
  list: readonly Conversation[],
  conversationId: string,
  messageId: string,
  now: number = Date.now(),
): Conversation[] {
  return list.map((conversation) => {
    if (conversation.id !== conversationId) return conversation;
    const index = conversation.messages.findIndex((message) => message.id === messageId);
    if (index === -1) return conversation;
    return { ...conversation, messages: conversation.messages.slice(0, index), updatedAt: now };
  });
}

/** Derives a title from the first user message if the conversation is untitled. */
export function applyAutoTitle(
  list: readonly Conversation[],
  conversationId: string,
  firstUserMessage: string,
): Conversation[] {
  return list.map((conversation) => {
    if (conversation.id !== conversationId) return conversation;
    if (conversation.title !== UNTITLED_CONVERSATION) return conversation;
    return { ...conversation, title: deriveTitle(firstUserMessage) };
  });
}

export interface ConversationExport {
  app: 'nim-chat';
  version: number;
  exportedAt: number;
  conversations: Conversation[];
}

/** Serialises conversations to a JSON document for the user to download. */
export function exportConversations(list: readonly Conversation[], now: number = Date.now()): string {
  const payload: ConversationExport = {
    app: 'nim-chat',
    version: SCHEMA_VERSION,
    exportedAt: now,
    conversations: sortByUpdatedAt(list),
  };
  return JSON.stringify(payload, null, 2);
}

export class ImportFormatError extends Error {
  override readonly name = 'ImportFormatError';
}

/**
 * Parses a previously exported document. Accepts the `{ conversations: [] }`
 * wrapper as well as a bare array, and repairs individual records.
 */
export function parseExportedConversations(raw: string): Conversation[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ImportFormatError('The file is not valid JSON.');
  }

  const list = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'object' &&
        parsed !== null &&
        Array.isArray((parsed as { conversations?: unknown }).conversations)
      ? (parsed as { conversations: unknown[] }).conversations
      : null;

  if (list === null) throw new ImportFormatError('Expected a JSON array of conversations.');
  return sanitizeConversationList(list);
}

export interface ImportResult {
  conversations: Conversation[];
  added: number;
  updated: number;
  skipped: number;
}

/**
 * Merges imported conversations with the ones already stored. Duplicate ids
 * are reconciled by `updatedAt`; ids that arrive twice inside the same file
 * collapse into one record.
 */
export function mergeImported(
  imported: readonly Conversation[],
  existing: readonly Conversation[],
): ImportResult {
  const byId = new Map(existing.map((conversation) => [conversation.id, conversation]));
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const candidate of imported) {
    const current = byId.get(candidate.id);
    if (!current) {
      byId.set(candidate.id, candidate);
      added += 1;
    } else if (candidate.updatedAt > current.updatedAt) {
      byId.set(candidate.id, candidate);
      updated += 1;
    } else {
      skipped += 1;
    }
  }

  return { conversations: sortByUpdatedAt(Array.from(byId.values())), added, updated, skipped };
}

/** Convenience wrapper: parse + merge in one step. */
export function importConversations(raw: string, existing: readonly Conversation[]): ImportResult {
  return mergeImported(parseExportedConversations(raw), existing);
}

export { sanitizeConversation, sanitizeConversationList };
