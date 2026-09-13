import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChatMessage, Conversation, ModelSettings } from '../types';
import {
  applyAutoTitle,
  appendMessage,
  createConversation,
  deleteConversation,
  exportConversations,
  mergeImported,
  parseExportedConversations,
  patchMessage,
  renameConversation,
  setModel as setConversationModel,
  sortByUpdatedAt,
  truncateFromMessage,
  updateSettings as updateConversationSettings,
} from '../storage/conversations';
import { resolveStorage, readJson, writeJson } from '../storage/safeStorage';
import { STORAGE_KEYS } from '../storage/keys';
import { sanitizeConversationList } from '../storage/schema';
import { useLatest } from './useLatest';
import type { ConversationsApi } from './conversationsContext';
import type { ImportResult } from '../storage/conversations';

export interface ConversationDefaults {
  model: string;
  settings: ModelSettings;
}

const SAVE_DEBOUNCE_MS = 200;

function loadInitial(): Conversation[] {
  const storage = resolveStorage('local');
  return sortByUpdatedAt(sanitizeConversationList(readJson(storage, STORAGE_KEYS.conversations)));
}

/** Owns the conversation list, the active selection and its persistence. */
export function useConversationsController(defaults: ConversationDefaults): ConversationsApi {
  const [conversations, setConversations] = useState<Conversation[]>(loadInitial);
  const [selectedId, setSelectedId] = useState<string | null>(() => conversations[0]?.id ?? null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  // Callbacks read the freshest list without re-creating on every render.
  const current = useLatest(conversations);

  useEffect(() => {
    const timer = setTimeout(() => {
      const ok = writeJson(resolveStorage('local'), STORAGE_KEYS.conversations, current.current);
      setStorageWarning(
        ok ? null : 'Browser storage is full or unavailable, so changes will be lost when you reload.',
      );
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [conversations, current]);

  // Falling back to the newest conversation keeps the selection valid after a
  // deletion, without needing to patch state in an effect.
  const activeId = useMemo(() => {
    if (conversations.some((conversation) => conversation.id === selectedId)) return selectedId;
    return conversations[0]?.id ?? null;
  }, [conversations, selectedId]);

  const active = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId) ?? null,
    [conversations, activeId],
  );

  const create = useCallback(
    (options?: { model?: string; settings?: ModelSettings }) => {
      const conversation = createConversation({
        model: options?.model ?? defaults.model,
        settings: { ...defaults.settings, ...(options?.settings ?? {}) },
      });
      setConversations((previous) => sortByUpdatedAt([conversation, ...previous]));
      setSelectedId(conversation.id);
      return conversation;
    },
    [defaults],
  );

  const select = useCallback((id: string | null) => setSelectedId(id), []);

  /**
   * Applies a mutation and re-sorts, so anything that bumps `updatedAt` moves
   * the conversation back to the top of the rail.
   */
  const mutate = useCallback((fn: (list: readonly Conversation[]) => Conversation[]) => {
    setConversations((previous) => sortByUpdatedAt(fn(previous)));
  }, []);

  const rename = useCallback(
    (id: string, title: string) => {
      mutate((previous) => renameConversation(previous, id, title));
    },
    [mutate],
  );

  const remove = useCallback((id: string) => {
    setConversations((previous) => deleteConversation(previous, id));
  }, []);

  const clearAll = useCallback(() => {
    setConversations([]);
    setSelectedId(null);
  }, []);

  const setModel = useCallback(
    (id: string, model: string) => {
      mutate((previous) => setConversationModel(previous, id, model));
    },
    [mutate],
  );

  const updateSettings = useCallback(
    (id: string, patch: Partial<ModelSettings>) => {
      mutate((previous) => updateConversationSettings(previous, id, patch));
    },
    [mutate],
  );

  const append = useCallback(
    (conversationId: string, message: ChatMessage) => {
      mutate((previous) => appendMessage(previous, conversationId, message));
    },
    [mutate],
  );

  // Called on every animation frame while streaming: the conversation is
  // already at the top from the user's message, so no re-sort is needed.
  const patch = useCallback((conversationId: string, messageId: string, patchValue: Partial<ChatMessage>) => {
    setConversations((previous) => patchMessage(previous, conversationId, messageId, patchValue));
  }, []);

  const truncate = useCallback(
    (conversationId: string, messageId: string) => {
      mutate((previous) => truncateFromMessage(previous, conversationId, messageId));
    },
    [mutate],
  );

  const autoTitle = useCallback((conversationId: string, firstUserMessage: string) => {
    setConversations((previous) => applyAutoTitle(previous, conversationId, firstUserMessage));
  }, []);

  const exportJson = useCallback(() => exportConversations(current.current), [current]);

  const importJson = useCallback(
    (raw: string): ImportResult => {
      const result = mergeImported(parseExportedConversations(raw), current.current);
      setConversations(result.conversations);
      if (result.conversations.length > 0) {
        setSelectedId((previous) =>
          previous && result.conversations.some((conversation) => conversation.id === previous)
            ? previous
            : (result.conversations[0]?.id ?? null),
        );
      }
      return result;
    },
    [current],
  );

  return {
    conversations,
    activeId,
    active,
    storageWarning,
    create,
    select,
    rename,
    remove,
    clearAll,
    setModel,
    updateSettings,
    appendMessage: append,
    patchMessage: patch,
    truncateFromMessage: truncate,
    autoTitle,
    exportJson,
    importJson,
  };
}
