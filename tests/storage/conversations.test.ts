import { describe, expect, it } from 'vitest';
import {
  appendMessage,
  applyAutoTitle,
  createConversation,
  deleteConversation,
  exportConversations,
  ImportFormatError,
  importConversations,
  mergeImported,
  parseExportedConversations,
  patchMessage,
  renameConversation,
  setModel,
  sortByUpdatedAt,
  truncateFromMessage,
  updateSettings,
} from '../../src/storage/conversations';
import { DEFAULT_MODEL_SETTINGS } from '../../src/storage/defaults';
import { UNTITLED_CONVERSATION } from '../../src/utils/title';
import type { ChatMessage, Conversation } from '../../src/types';

const now = 1_700_000_000_000;

function conversation(): Conversation {
  return createConversation({ model: 'meta/llama-3.3-70b-instruct', settings: DEFAULT_MODEL_SETTINGS }, now);
}

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    role: 'user',
    content: 'hello',
    createdAt: now,
    status: 'complete',
    ...overrides,
  };
}

describe('createConversation', () => {
  it('starts empty, untitled and stamped with the same creation and update time', () => {
    const created = conversation();
    expect(created.id).toMatch(/^conv_/);
    expect(created.title).toBe(UNTITLED_CONVERSATION);
    expect(created.messages).toEqual([]);
    expect(created.createdAt).toBe(now);
    expect(created.updatedAt).toBe(now);
    expect(created.model).toBe('meta/llama-3.3-70b-instruct');
  });

  it('copies the settings so later edits do not leak into the defaults', () => {
    const settings = { ...DEFAULT_MODEL_SETTINGS };
    const created = createConversation({ model: 'x', settings }, now);
    created.settings.temperature = 1.5;
    expect(settings.temperature).toBe(DEFAULT_MODEL_SETTINGS.temperature);
  });

  it('uses an explicit title when provided and ignores whitespace-only ones', () => {
    expect(
      createConversation({ model: 'x', settings: DEFAULT_MODEL_SETTINGS, title: 'Deploy plan' }, now).title,
    ).toBe('Deploy plan');
    expect(
      createConversation({ model: 'x', settings: DEFAULT_MODEL_SETTINGS, title: '   ' }, now).title,
    ).toBe(UNTITLED_CONVERSATION);
  });

  it('gives every conversation a unique id', () => {
    const ids = new Set(Array.from({ length: 25 }, () => conversation().id));
    expect(ids.size).toBe(25);
  });
});

describe('sortByUpdatedAt', () => {
  it('orders newest first without mutating the input', () => {
    const older = { ...conversation(), id: 'a', updatedAt: now - 1000 };
    const newer = { ...conversation(), id: 'b', updatedAt: now };
    const input = [older, newer];
    const sorted = sortByUpdatedAt(input);

    expect(sorted.map((entry) => entry.id)).toEqual(['b', 'a']);
    expect(input.map((entry) => entry.id)).toEqual(['a', 'b']);
  });

  it('breaks ties on creation time', () => {
    const a = { ...conversation(), id: 'a', updatedAt: now, createdAt: now - 500 };
    const b = { ...conversation(), id: 'b', updatedAt: now, createdAt: now };
    expect(sortByUpdatedAt([a, b]).map((entry) => entry.id)).toEqual(['b', 'a']);
  });
});

describe('appendMessage', () => {
  it('adds the message and bumps updatedAt for that conversation only', () => {
    const target = conversation();
    const other = { ...conversation(), id: 'other' };
    const next = appendMessage([target, other], target.id, message({ id: 'm1' }), now + 10);

    expect(next[0]?.messages).toHaveLength(1);
    expect(next[0]?.updatedAt).toBe(now + 10);
    expect(next[1]?.messages).toHaveLength(0);
    expect(next[1]?.updatedAt).toBe(now);
  });

  it('leaves an unknown conversation id untouched', () => {
    const list = [conversation()];
    expect(appendMessage(list, 'missing', message())).toEqual(list);
  });
});

describe('patchMessage', () => {
  it('merges the patch into the matching message', () => {
    const target = conversation();
    const withMessage = appendMessage([target], target.id, message({ id: 'm1', content: 'He' }), now);
    const next = patchMessage(
      withMessage,
      target.id,
      'm1',
      { content: 'Hello', status: 'streaming' },
      now + 5,
    );

    expect(next[0]?.messages[0]).toMatchObject({ id: 'm1', content: 'Hello', status: 'streaming' });
    expect(next[0]?.updatedAt).toBe(now + 5);
  });

  it('does not touch other messages in the same conversation', () => {
    const target = conversation();
    const seeded = appendMessage(
      appendMessage([target], target.id, message({ id: 'm1' }), now),
      target.id,
      message({ id: 'm2' }),
      now,
    );
    const next = patchMessage(seeded, target.id, 'm2', { content: 'changed' }, now);

    expect(next[0]?.messages[0]?.content).toBe('hello');
    expect(next[0]?.messages[1]?.content).toBe('changed');
  });
});

describe('renameConversation', () => {
  it('trims the new title and bumps updatedAt', () => {
    const target = conversation();
    const next = renameConversation([target], target.id, '  Roadmap  ', now + 1);
    expect(next[0]?.title).toBe('Roadmap');
    expect(next[0]?.updatedAt).toBe(now + 1);
  });

  it('falls back to the untitled label for empty input', () => {
    const next = renameConversation([conversation()], conversation().id, '   ', now);
    expect(next[0]?.title).toBe(UNTITLED_CONVERSATION);
  });

  it('caps very long titles', () => {
    const target = conversation();
    const next = renameConversation([target], target.id, 'x'.repeat(400), now);
    expect(next[0]?.title).toHaveLength(120);
  });
});

describe('deleteConversation', () => {
  it('removes only the target', () => {
    const a = { ...conversation(), id: 'a' };
    const b = { ...conversation(), id: 'b' };
    expect(deleteConversation([a, b], 'a').map((entry) => entry.id)).toEqual(['b']);
  });

  it('is a no-op for an unknown id', () => {
    const list = [conversation()];
    expect(deleteConversation(list, 'nope')).toHaveLength(1);
  });
});

describe('updateSettings and setModel', () => {
  it('merges parameter changes', () => {
    const target = conversation();
    const next = updateSettings([target], target.id, { temperature: 0.2, stream: false }, now);
    expect(next[0]?.settings).toMatchObject({
      temperature: 0.2,
      stream: false,
      maxTokens: DEFAULT_MODEL_SETTINGS.maxTokens,
    });
  });

  it('switches the model', () => {
    const target = conversation();
    const next = setModel([target], target.id, 'qwen/qwen3-235b-a22b', now);
    expect(next[0]?.model).toBe('qwen/qwen3-235b-a22b');
  });
});

describe('truncateFromMessage', () => {
  const target = conversation();
  const seeded = ['m1', 'm2', 'm3'].reduce(
    (list, id) => appendMessage(list, target.id, message({ id }), now),
    [target] as Conversation[],
  );

  it('drops the message and everything after it', () => {
    const next = truncateFromMessage(seeded, target.id, 'm2', now + 1);
    expect(next[0]?.messages.map((entry) => entry.id)).toEqual(['m1']);
    expect(next[0]?.updatedAt).toBe(now + 1);
  });

  it('keeps the list unchanged when the id is unknown', () => {
    const next = truncateFromMessage(seeded, target.id, 'nope', now);
    expect(next[0]?.messages).toHaveLength(3);
  });
});

describe('applyAutoTitle', () => {
  it('titles an untitled conversation from the first user message', () => {
    const target = conversation();
    const next = applyAutoTitle([target], target.id, 'How does NIM streaming work?');
    expect(next[0]?.title).toBe('How does NIM streaming work?');
  });

  it('never overwrites a title the user set', () => {
    const target = conversation();
    const renamed = renameConversation([target], target.id, 'My notes', now);
    const next = applyAutoTitle(renamed, target.id, 'something else');
    expect(next[0]?.title).toBe('My notes');
  });
});

describe('exportConversations', () => {
  it('wraps the list with metadata and sorts it newest first', () => {
    const a = { ...conversation(), id: 'a', updatedAt: now - 1000 };
    const b = { ...conversation(), id: 'b', updatedAt: now };
    const parsed = JSON.parse(exportConversations([a, b], now)) as {
      app: string;
      version: number;
      exportedAt: number;
      conversations: Array<{ id: string }>;
    };

    expect(parsed.app).toBe('nim-chat');
    expect(parsed.version).toBe(1);
    expect(parsed.exportedAt).toBe(now);
    expect(parsed.conversations.map((entry) => entry.id)).toEqual(['b', 'a']);
  });

  it('round-trips back into equivalent conversations', () => {
    const target = conversation();
    const original = appendMessage([target], target.id, message({ id: 'm1' }), now);
    const restored = parseExportedConversations(exportConversations(original, now));
    expect(restored).toEqual(original);
  });
});

describe('parseExportedConversations', () => {
  it('accepts a bare array as well as the wrapper document', () => {
    const bare = JSON.stringify([conversation()]);
    expect(parseExportedConversations(bare)).toHaveLength(1);
  });

  it('rejects malformed JSON with an ImportFormatError', () => {
    expect(() => parseExportedConversations('{oops')).toThrow(ImportFormatError);
    expect(() => parseExportedConversations('{oops')).toThrow('not valid JSON');
  });

  it('rejects JSON that is not a conversation list', () => {
    expect(() => parseExportedConversations('{"hello":1}')).toThrow('Expected a JSON array');
  });

  it('repairs salvageable records and drops hopeless ones', () => {
    const raw = JSON.stringify([
      { id: 'good', title: 'Kept', model: 'm', createdAt: now, updatedAt: now, messages: [] },
      { title: 'no id' },
      'nonsense',
      { id: 'partial', messages: [{ id: 'x', role: 'user', content: 'hi' }] },
    ]);
    const parsed = parseExportedConversations(raw);

    expect(parsed.map((entry) => entry.id).sort()).toEqual(['good', 'partial']);
    expect(parsed.find((entry) => entry.id === 'partial')?.messages).toHaveLength(1);
  });
});

describe('mergeImported', () => {
  it('counts additions, updates and skips', () => {
    const existing = [
      { ...conversation(), id: 'keep', updatedAt: now },
      { ...conversation(), id: 'replace', updatedAt: now - 10 },
    ];
    const imported = [
      { ...conversation(), id: 'brand-new', updatedAt: now },
      { ...conversation(), id: 'replace', updatedAt: now + 10 },
      { ...conversation(), id: 'keep', updatedAt: now - 10 },
    ];

    const result = mergeImported(imported, existing);
    expect(result.added).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.conversations).toHaveLength(3);
    expect(result.conversations.find((entry) => entry.id === 'replace')?.updatedAt).toBe(now + 10);
  });

  it('collapses duplicate ids inside the same import file', () => {
    const imported = [
      { ...conversation(), id: 'dup', updatedAt: now - 5 },
      { ...conversation(), id: 'dup', updatedAt: now },
    ];
    const result = mergeImported(imported, []);
    expect(result.conversations).toHaveLength(1);
    expect(result.conversations[0]?.updatedAt).toBe(now);
  });
});

describe('importConversations', () => {
  it('parses and merges in one step', () => {
    const existing = [conversation()];
    const file = exportConversations([{ ...conversation(), id: 'imported' }], now);
    const result = importConversations(file, existing);

    expect(result.added).toBe(1);
    expect(result.conversations).toHaveLength(2);
  });

  it('propagates format errors so the caller can show a message', () => {
    expect(() => importConversations('nope', [])).toThrow(ImportFormatError);
  });
});
