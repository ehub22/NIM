import { describe, expect, it } from 'vitest';
import {
  clampNumber,
  sanitizeConversation,
  sanitizeConversationList,
  sanitizeMessage,
  sanitizeModelSettings,
  sanitizeSettings,
} from '../../src/storage/schema';
import { DEFAULT_MODEL_ID } from '../../src/services/nim/catalog';
import { DEFAULT_MODEL_SETTINGS } from '../../src/storage/defaults';

describe('clampNumber', () => {
  it('clamps to the allowed range', () => {
    expect(clampNumber(99, { min: 0, max: 2, fallback: 1 })).toBe(2);
    expect(clampNumber(-5, { min: 0, max: 2, fallback: 1 })).toBe(0);
    expect(clampNumber(1.5, { min: 0, max: 2, fallback: 1, step: 0.05 })).toBe(1.5);
  });

  it.each([
    [undefined],
    [null],
    ['abc'],
    ['   '],
    [Number.NaN],
    [Number.POSITIVE_INFINITY],
    [{}],
    [[]],
    [true],
  ])('uses the fallback for the unusable value %s', (value) => {
    expect(clampNumber(value, { min: 0, max: 2, fallback: 0.7 })).toBe(0.7);
  });

  it('coerces numeric strings', () => {
    expect(clampNumber('1.25', { min: 0, max: 2, fallback: 0, step: 0.05 })).toBe(1.25);
  });

  it('snaps to the step without floating-point drift', () => {
    // 0.7 / 0.05 * 0.05 is 0.7000000000000001 in IEEE-754.
    expect(clampNumber(0.7, { min: 0, max: 2, fallback: 0, step: 0.05 })).toBe(0.7);
    expect(clampNumber(0.95, { min: 0, max: 1, fallback: 0, step: 0.05 })).toBe(0.95);
    expect(clampNumber(0.30000000000000004, { min: 0, max: 1, fallback: 0, step: 0.05 })).toBe(0.3);
  });

  it('rounds to whole numbers when the step is 1', () => {
    expect(clampNumber(1024.4, { min: 1, max: 8192, fallback: 512 })).toBe(1024);
  });
});

describe('sanitizeModelSettings', () => {
  it('returns the defaults for anything unusable', () => {
    expect(sanitizeModelSettings(undefined)).toEqual(DEFAULT_MODEL_SETTINGS);
    expect(sanitizeModelSettings('nope')).toEqual(DEFAULT_MODEL_SETTINGS);
    expect(sanitizeModelSettings([1, 2, 3])).toEqual(DEFAULT_MODEL_SETTINGS);
  });

  it('clamps out-of-range values and drops oversized prompts', () => {
    const settings = sanitizeModelSettings({
      temperature: 42,
      topP: -1,
      maxTokens: 999_999,
      systemPrompt: `x${'y'.repeat(20_000)}`,
      stream: 'true',
    });

    expect(settings.temperature).toBe(2);
    expect(settings.topP).toBe(0);
    // LIMITS.maxTokens.max is the hard ceiling; the settings slider stops lower.
    expect(settings.maxTokens).toBe(32_768);
    expect(settings.systemPrompt).toHaveLength(8000);
    expect(settings.stream).toBe(DEFAULT_MODEL_SETTINGS.stream);
  });

  it('keeps valid values exactly as they are', () => {
    const input = { temperature: 0.35, topP: 0.9, maxTokens: 2048, systemPrompt: 'Be brief.', stream: false };
    expect(sanitizeModelSettings(input)).toEqual(input);
  });
});

describe('sanitizeMessage', () => {
  it('drops entries that carry no information', () => {
    expect(sanitizeMessage(null)).toBeNull();
    expect(sanitizeMessage({ id: 'a', role: 'user', content: '' })).toBeNull();
    expect(sanitizeMessage('text')).toBeNull();
  });

  it('keeps an empty message that reports an error', () => {
    const message = sanitizeMessage({ id: 'a', role: 'assistant', content: '', error: 'boom' });
    expect(message).toMatchObject({ id: 'a', status: 'complete', error: 'boom' });
  });

  it('defaults the role and status, and generates an id when missing', () => {
    const message = sanitizeMessage({ content: 'hi' });
    expect(message).toMatchObject({ role: 'user', status: 'complete', content: 'hi' });
    expect(message?.id).toMatch(/^msg_/);
  });

  it('rejects unknown roles and statuses', () => {
    const message = sanitizeMessage({ id: 'a', role: 'hacker', content: 'x', status: 'weird' });
    expect(message).toMatchObject({ role: 'user', status: 'complete' });
  });

  it('drops empty usage and keeps a complete one', () => {
    expect(
      sanitizeMessage({ id: 'a', content: 'x', usage: { promptTokens: 0, completionTokens: 0 } })?.usage,
    ).toBeUndefined();
    expect(
      sanitizeMessage({ id: 'a', content: 'x', usage: { promptTokens: 10, completionTokens: 5 } })?.usage,
    ).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
  });

  it('truncates absurdly long content', () => {
    const message = sanitizeMessage({ id: 'a', content: 'z'.repeat(1_500_000) });
    expect(message?.content).toHaveLength(1_000_000);
  });
});

describe('sanitizeConversation', () => {
  it('requires an id', () => {
    expect(sanitizeConversation({ title: 'no id' })).toBeNull();
    expect(sanitizeConversation(null)).toBeNull();
  });

  it('fills in defaults for a bare record', () => {
    const conversation = sanitizeConversation({ id: 'c1' });
    expect(conversation).toMatchObject({
      id: 'c1',
      title: 'Untitled conversation',
      model: DEFAULT_MODEL_ID,
    });
    expect(conversation?.messages).toEqual([]);
    expect(conversation?.updatedAt).toBeGreaterThanOrEqual(conversation!.createdAt);
  });

  it('never lets updatedAt precede createdAt', () => {
    const conversation = sanitizeConversation({ id: 'c1', createdAt: 5000, updatedAt: 1000 });
    expect(conversation?.updatedAt).toBe(5000);
  });

  it('keeps the usable messages and drops the rest', () => {
    const conversation = sanitizeConversation({
      id: 'c1',
      messages: [{ id: 'm1', role: 'user', content: 'hi' }, null, { role: 'user' }],
    });
    expect(conversation?.messages).toHaveLength(1);
  });
});

describe('sanitizeConversationList', () => {
  it('returns an empty list for non-arrays', () => {
    expect(sanitizeConversationList(undefined)).toEqual([]);
    expect(sanitizeConversationList({ a: 1 })).toEqual([]);
    expect(sanitizeConversationList('text')).toEqual([]);
  });

  it('drops duplicates by id', () => {
    const list = sanitizeConversationList([{ id: 'a' }, { id: 'a' }, { id: 'b' }]);
    expect(list.map((entry) => entry.id)).toEqual(['a', 'b']);
  });
});

describe('sanitizeSettings', () => {
  it('falls back to a safe base URL for hostile input', () => {
    const settings = sanitizeSettings({ baseUrl: 'javascript:alert(1)' });
    expect(settings.baseUrl).not.toContain('javascript:');
  });

  it('keeps a same-origin proxy path', () => {
    expect(sanitizeSettings({ baseUrl: '/nim-api/v1' }).baseUrl).toBe('/nim-api/v1');
  });

  it('normalises a trailing slash', () => {
    expect(sanitizeSettings({ baseUrl: 'https://example.com/v1/' }).baseUrl).toBe('https://example.com/v1');
  });

  it('rejects unknown themes and persistence modes', () => {
    const settings = sanitizeSettings({ theme: 'neon', apiKeyPersistence: 'cloud' });
    expect(settings.theme).toBe('system');
    expect(settings.apiKeyPersistence).toBe('local');
  });
});
