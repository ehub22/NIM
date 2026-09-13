import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConversationsController } from '../../src/hooks/useConversationsController';
import type { ConversationDefaults } from '../../src/hooks/useConversationsController';
import { STORAGE_KEYS } from '../../src/storage/keys';
import { DEFAULT_MODEL_SETTINGS } from '../../src/storage/defaults';
import { UNTITLED_CONVERSATION } from '../../src/utils/title';
import { ImportFormatError } from '../../src/storage/conversations';
import type { ChatMessage } from '../../src/types';

const defaults: ConversationDefaults = {
  model: 'meta/llama-3.3-70b-instruct',
  settings: DEFAULT_MODEL_SETTINGS,
};

const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEYS.conversations) ?? 'null') as unknown;

function userMessage(id: string, content = 'hello'): ChatMessage {
  return { id, role: 'user', content, createdAt: Date.now(), status: 'complete' };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('useConversationsController', () => {
  it('starts empty when nothing is stored', () => {
    const { result } = renderHook(() => useConversationsController(defaults));
    expect(result.current.conversations).toEqual([]);
    expect(result.current.activeId).toBeNull();
    expect(result.current.active).toBeNull();
  });

  it('creates a conversation, selects it and applies the defaults', () => {
    const { result } = renderHook(() => useConversationsController(defaults));
    let created!: ReturnType<typeof result.current.create>;

    act(() => {
      created = result.current.create();
    });

    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.activeId).toBe(created.id);
    expect(result.current.active?.model).toBe(defaults.model);
    expect(result.current.active?.settings).toEqual(DEFAULT_MODEL_SETTINGS);
    expect(result.current.active?.title).toBe(UNTITLED_CONVERSATION);
  });

  it('accepts a per-conversation model and settings override', () => {
    const { result } = renderHook(() => useConversationsController(defaults));
    let id = '';

    act(() => {
      id = result.current.create({
        model: 'qwen/qwen3-235b-a22b',
        settings: { ...DEFAULT_MODEL_SETTINGS, temperature: 0.1 },
      }).id;
    });

    const conversation = result.current.conversations.find((entry) => entry.id === id);
    expect(conversation?.model).toBe('qwen/qwen3-235b-a22b');
    expect(conversation?.settings.temperature).toBe(0.1);
  });

  it('renames a conversation', () => {
    const { result } = renderHook(() => useConversationsController(defaults));
    let id = '';
    act(() => {
      id = result.current.create().id;
    });

    act(() => {
      result.current.rename(id, '  Release plan  ');
    });

    expect(result.current.conversations[0]?.title).toBe('Release plan');
  });

  it('deletes a conversation and moves the selection to the next one', () => {
    const { result } = renderHook(() => useConversationsController(defaults));
    let first = '';
    let second = '';

    act(() => {
      first = result.current.create().id;
    });
    act(() => {
      second = result.current.create().id;
    });
    expect(result.current.activeId).toBe(second);

    act(() => {
      result.current.remove(second);
    });

    expect(result.current.conversations.map((entry) => entry.id)).toEqual([first]);
    expect(result.current.activeId).toBe(first);
  });

  it('clears everything', () => {
    const { result } = renderHook(() => useConversationsController(defaults));
    act(() => {
      result.current.create();
      result.current.create();
    });

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.conversations).toEqual([]);
    expect(result.current.activeId).toBeNull();
  });

  it('appends and patches messages, streaming deltas included', () => {
    const { result } = renderHook(() => useConversationsController(defaults));
    let id = '';
    act(() => {
      id = result.current.create().id;
    });

    act(() => {
      result.current.appendMessage(id, userMessage('m1', 'Hi'));
      result.current.appendMessage(id, {
        id: 'm2',
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        status: 'streaming',
      });
    });
    act(() => {
      result.current.patchMessage(id, 'm2', { content: 'Hel' });
    });
    act(() => {
      result.current.patchMessage(id, 'm2', { content: 'Hello', status: 'complete' });
    });

    expect(result.current.active?.messages).toHaveLength(2);
    expect(result.current.active?.messages[1]).toMatchObject({ content: 'Hello', status: 'complete' });
  });

  it('truncates from a message for regeneration', () => {
    const { result } = renderHook(() => useConversationsController(defaults));
    let id = '';
    act(() => {
      id = result.current.create().id;
      result.current.appendMessage(id, userMessage('m1'));
      result.current.appendMessage(id, {
        id: 'm2',
        role: 'assistant',
        content: 'answer',
        createdAt: Date.now(),
      });
    });

    act(() => {
      result.current.truncateFromMessage(id, 'm2');
    });

    expect(result.current.active?.messages.map((message) => message.id)).toEqual(['m1']);
  });

  it('titles an untitled conversation from the first user message', () => {
    const { result } = renderHook(() => useConversationsController(defaults));
    let id = '';
    act(() => {
      id = result.current.create().id;
    });

    act(() => {
      result.current.autoTitle(id, 'How do I deploy a NIM endpoint?');
    });

    expect(result.current.conversations[0]?.title).toBe('How do I deploy a NIM endpoint?');
  });

  it('sorts by most recently updated', () => {
    // Fake timers give the two conversations distinct timestamps.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    try {
      const { result } = renderHook(() => useConversationsController(defaults));
      let older = '';
      let newer = '';

      act(() => {
        older = result.current.create().id;
      });
      act(() => {
        vi.advanceTimersByTime(1000);
        newer = result.current.create().id;
      });

      expect(result.current.conversations[0]?.id).toBe(newer);
      expect(result.current.conversations[1]?.id).toBe(older);

      // Touching the older conversation moves it back to the top.
      act(() => {
        vi.advanceTimersByTime(1000);
        result.current.rename(older, 'Touched');
      });

      expect(result.current.conversations[0]?.id).toBe(older);
      expect(result.current.conversations[1]?.id).toBe(newer);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('persistence', () => {
  it('writes conversations to localStorage and restores them after a remount', async () => {
    const first = renderHook(() => useConversationsController(defaults));
    let id = '';

    act(() => {
      id = first.result.current.create().id;
    });
    act(() => {
      first.result.current.appendMessage(id, userMessage('m1', 'Persist me'));
      first.result.current.rename(id, 'Persisted chat');
    });

    await waitFor(() => expect(stored()).not.toBeNull());
    expect(stored()).toHaveLength(1);
    first.unmount();

    // Simulates a page refresh: a brand-new hook instance over the same storage.
    const second = renderHook(() => useConversationsController(defaults));
    expect(second.result.current.conversations).toHaveLength(1);
    expect(second.result.current.activeId).toBe(id);
    expect(second.result.current.active?.title).toBe('Persisted chat');
    expect(second.result.current.active?.messages[0]?.content).toBe('Persist me');
  });

  it('starts clean when localStorage holds invalid JSON', () => {
    localStorage.setItem(STORAGE_KEYS.conversations, '{"conversations":');
    const { result } = renderHook(() => useConversationsController(defaults));
    expect(result.current.conversations).toEqual([]);
  });

  it('ignores a stored document that is not an array', () => {
    localStorage.setItem(STORAGE_KEYS.conversations, JSON.stringify({ hello: 'world' }));
    const { result } = renderHook(() => useConversationsController(defaults));
    expect(result.current.conversations).toEqual([]);
  });

  it('keeps salvageable conversations and drops corrupt ones', () => {
    localStorage.setItem(
      STORAGE_KEYS.conversations,
      JSON.stringify([
        { id: 'good', title: 'Good', model: 'm', createdAt: 1, updatedAt: 2, messages: [] },
        { title: 'missing id' },
        42,
        null,
      ]),
    );

    const { result } = renderHook(() => useConversationsController(defaults));
    expect(result.current.conversations.map((entry) => entry.id)).toEqual(['good']);
  });

  it('warns when the browser refuses to store changes', async () => {
    // jsdom's Storage is a Proxy, so the prototype has to be patched for the
    // override to be visible to the app code.
    const realSetItem = Storage.prototype.setItem.bind(localStorage);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
      if (key === '__nim_probe__') {
        realSetItem(key, value);
        return;
      }
      throw new DOMException('QuotaExceededError');
    });

    try {
      const { result } = renderHook(() => useConversationsController(defaults));
      act(() => {
        result.current.create();
      });

      await waitFor(() => expect(result.current.storageWarning).not.toBeNull());
      expect(result.current.storageWarning).toMatch(/full or unavailable/);
      expect(localStorage.getItem(STORAGE_KEYS.conversations)).toBeNull();
    } finally {
      vi.restoreAllMocks();
    }
  });
});

describe('export and import', () => {
  it('exports a JSON document and imports it back into an empty store', () => {
    const source = renderHook(() => useConversationsController(defaults));
    act(() => {
      const id = source.result.current.create().id;
      source.result.current.appendMessage(id, userMessage('m1', 'Exported content'));
      source.result.current.rename(id, 'Exported chat');
    });

    const json = source.result.current.exportJson();
    expect(JSON.parse(json)).toMatchObject({ app: 'nim-chat', version: 1 });
    source.unmount();

    const target = renderHook(() => useConversationsController(defaults));
    let result!: { added: number; updated: number; skipped: number };
    act(() => {
      result = target.result.current.importJson(json);
    });

    expect(result).toMatchObject({ added: 1, updated: 0, skipped: 0 });
    expect(target.result.current.conversations[0]?.title).toBe('Exported chat');
    expect(target.result.current.conversations[0]?.messages[0]?.content).toBe('Exported content');
  });

  it('merges into an existing store without duplicating ids', () => {
    const { result } = renderHook(() => useConversationsController(defaults));
    let existing = '';
    act(() => {
      existing = result.current.create().id;
    });

    const file = JSON.stringify({
      app: 'nim-chat',
      version: 1,
      exportedAt: Date.now(),
      conversations: [
        {
          id: existing,
          title: 'Same id',
          model: 'm',
          createdAt: 1,
          updatedAt: Date.now() + 10_000,
          messages: [],
        },
        { id: 'brand-new', title: 'New', model: 'm', createdAt: 1, updatedAt: 1, messages: [] },
      ],
    });

    let outcome!: { added: number; updated: number };
    act(() => {
      outcome = result.current.importJson(file);
    });

    expect(outcome).toMatchObject({ added: 1, updated: 1 });
    expect(result.current.conversations).toHaveLength(2);
  });

  it('throws an ImportFormatError for an unusable file', () => {
    const { result } = renderHook(() => useConversationsController(defaults));
    expect(() => result.current.importJson('not json')).toThrow(ImportFormatError);
    expect(result.current.conversations).toEqual([]);
  });
});
