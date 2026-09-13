import { useCallback, useRef, useState } from 'react';
import type { ChatMessage } from '../types';
import { createNimClient, describeError, ERROR_HINTS, NimError, toNimError } from '../services/nim';
import type { ChatCompletionParams } from '../services/nim/client';
import type { NimChatMessage } from '../services/nim/types';
import { createId } from '../utils/id';
import { useConversations } from './useConversations';
import { useSettings } from './useSettings';
import { useToasts } from './useToasts';
import { useLatest } from './useLatest';

export interface UseChatControllerOptions {
  /** Invoked when a request fails because no API key is configured. */
  onRequestSettings?: () => void;
}

export interface UseChatControllerResult {
  /** Conversation currently receiving tokens, or `null`. */
  streamingConversationId: string | null;
  isStreaming: boolean;
  /** Sends `text` as a new user turn and streams the reply. */
  send: (conversationId: string, text: string) => void;
  /** Re-runs the last assistant turn of a conversation. */
  regenerate: (conversationId: string) => void;
  /** Aborts the in-flight request, keeping any tokens already received. */
  stop: () => void;
}

const schedule: (callback: () => void) => number =
  typeof requestAnimationFrame === 'function'
    ? (callback) => requestAnimationFrame(callback)
    : (callback) => window.setTimeout(callback, 16);

const cancelSchedule: (handle: number) => void =
  typeof cancelAnimationFrame === 'function'
    ? (handle) => cancelAnimationFrame(handle)
    : (handle) => window.clearTimeout(handle);

/**
 * Owns the request lifecycle for the chat transcript: building the message
 * array, streaming tokens into the assistant bubble, aborting, regenerating
 * and reporting failures.
 */
export function useChatController(options: UseChatControllerOptions = {}): UseChatControllerResult {
  const conversations = useConversations();
  const { apiKey, settings } = useSettings();
  const { notify } = useToasts();

  const conversationsRef = useLatest(conversations);
  const settingsRef = useLatest(settings);
  const apiKeyRef = useLatest(apiKey);
  const optionsRef = useLatest(options);

  const [streamingConversationId, setStreamingConversationId] = useState<string | null>(null);
  const streamingRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const beginStreaming = useCallback((id: string) => {
    streamingRef.current = id;
    setStreamingConversationId(id);
  }, []);

  const endStreaming = useCallback(() => {
    streamingRef.current = null;
    abortRef.current = null;
    setStreamingConversationId(null);
  }, []);

  const runGeneration = useCallback(
    async (conversationId: string, history: readonly ChatMessage[], assistantId: string) => {
      const api = conversationsRef.current;
      const conversation = api.conversations.find((entry) => entry.id === conversationId);
      if (!conversation) return;

      const key = apiKeyRef.current;
      if (!key) {
        api.patchMessage(conversationId, assistantId, {
          status: 'error',
          error: ERROR_HINTS['missing-key'],
        });
        notify({
          tone: 'error',
          message: ERROR_HINTS['missing-key'],
          actionLabel: 'Open settings',
          onAction: () => optionsRef.current.onRequestSettings?.(),
        });
        endStreaming();
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      beginStreaming(conversationId);

      const { temperature, topP, maxTokens, systemPrompt } = conversation.settings;
      const payload: ChatCompletionParams = {
        model: conversation.model,
        temperature,
        topP,
        maxTokens,
        messages: [
          ...(systemPrompt.trim() ? [{ role: 'system' as const, content: systemPrompt.trim() }] : []),
          ...history
            .filter((message) => message.role !== 'system' && message.content.trim().length > 0)
            .map((message) => ({ role: message.role, content: message.content })),
        ] satisfies NimChatMessage[],
      };

      const client = createNimClient({ apiKey: key, baseUrl: settingsRef.current.baseUrl });

      // Coalesce token deltas into one state update per animation frame.
      const buffer = { text: '' };
      let frame: number | null = null;
      const flush = () => {
        frame = null;
        api.patchMessage(conversationId, assistantId, { content: buffer.text });
      };
      const onDelta = (delta: string) => {
        buffer.text += delta;
        if (frame === null) frame = schedule(flush);
      };

      try {
        const result = conversation.settings.stream
          ? await client.stream(payload, { signal: controller.signal, onDelta })
          : await client.complete(payload, { signal: controller.signal });

        if (frame !== null) {
          cancelSchedule(frame);
          frame = null;
        }

        if (!result.content.trim()) {
          api.patchMessage(conversationId, assistantId, {
            content: '',
            status: 'error',
            error: 'The model returned an empty response. Try again or switch models.',
          });
          return;
        }

        api.patchMessage(conversationId, assistantId, {
          content: result.content,
          status: 'complete',
          model: result.model ?? conversation.model,
          usage: result.usage,
          error: undefined,
        });
      } catch (error) {
        if (frame !== null) {
          cancelSchedule(frame);
          frame = null;
        }
        const kind = error instanceof NimError ? error.kind : toNimError(error, [key]).kind;

        if (kind === 'aborted') {
          // The user pressed Stop: keep what arrived.
          api.patchMessage(conversationId, assistantId, {
            content: buffer.text,
            status: 'aborted',
            error: undefined,
          });
          return;
        }

        const message = describeError(error, [key]);
        api.patchMessage(conversationId, assistantId, {
          content: buffer.text,
          status: 'error',
          error: message,
        });
        notify({
          tone: 'error',
          message,
          actionLabel: kind === 'missing-key' ? 'Open settings' : undefined,
          onAction: kind === 'missing-key' ? () => optionsRef.current.onRequestSettings?.() : undefined,
        });
      } finally {
        endStreaming();
      }
    },
    [beginStreaming, endStreaming, notify, apiKeyRef, conversationsRef, optionsRef, settingsRef],
  );

  const send = useCallback(
    (conversationId: string, text: string) => {
      const content = text.trim();
      if (!content || streamingRef.current !== null) return;

      const api = conversationsRef.current;
      const conversation = api.conversations.find((entry) => entry.id === conversationId);
      if (!conversation) return;

      if (!apiKeyRef.current) {
        notify({
          tone: 'error',
          message: ERROR_HINTS['missing-key'],
          actionLabel: 'Open settings',
          onAction: () => optionsRef.current.onRequestSettings?.(),
        });
        return;
      }

      const userMessage: ChatMessage = {
        id: createId('msg'),
        role: 'user',
        content,
        createdAt: Date.now(),
        status: 'complete',
      };
      const assistantId = createId('msg');

      api.appendMessage(conversationId, userMessage);
      api.autoTitle(conversationId, content);
      api.appendMessage(conversationId, {
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        status: 'streaming',
        model: conversation.model,
      });

      void runGeneration(conversationId, [...conversation.messages, userMessage], assistantId);
    },
    [notify, runGeneration, apiKeyRef, conversationsRef, optionsRef],
  );

  const regenerate = useCallback(
    (conversationId: string) => {
      if (streamingRef.current !== null) return;

      const api = conversationsRef.current;
      const conversation = api.conversations.find((entry) => entry.id === conversationId);
      if (!conversation) return;

      const lastIndex = conversation.messages.findLastIndex((message) => message.role === 'assistant');
      if (lastIndex === -1) return;

      const removed = conversation.messages[lastIndex];
      if (!removed) return;

      if (!apiKeyRef.current) {
        notify({
          tone: 'error',
          message: ERROR_HINTS['missing-key'],
          actionLabel: 'Open settings',
          onAction: () => optionsRef.current.onRequestSettings?.(),
        });
        return;
      }

      const history = conversation.messages.slice(0, lastIndex);
      const assistantId = createId('msg');

      api.truncateFromMessage(conversationId, removed.id);
      api.appendMessage(conversationId, {
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        status: 'streaming',
        model: conversation.model,
      });

      void runGeneration(conversationId, history, assistantId);
    },
    [notify, runGeneration, apiKeyRef, conversationsRef, optionsRef],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    streamingConversationId,
    isStreaming: streamingConversationId !== null,
    send,
    regenerate,
    stop,
  };
}
