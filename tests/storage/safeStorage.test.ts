import { describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from '../../src/storage/memoryStorage';
import { readJson, removeKey, resolveStorage, writeJson } from '../../src/storage/safeStorage';

describe('MemoryStorage', () => {
  it('behaves like the Web Storage API', () => {
    const storage = new MemoryStorage();
    expect(storage.length).toBe(0);
    expect(storage.getItem('missing')).toBeNull();

    storage.setItem('a', '1');
    storage.setItem('b', '2');
    expect(storage.length).toBe(2);
    expect(storage.key(0)).toBe('a');
    expect(storage.getItem('a')).toBe('1');

    storage.removeItem('a');
    expect(storage.length).toBe(1);

    storage.clear();
    expect(storage.length).toBe(0);
  });
});

describe('readJson', () => {
  it('returns parsed values for valid JSON', () => {
    localStorage.setItem('k', JSON.stringify({ hello: 'world' }));
    expect(readJson(localStorage, 'k')).toEqual({ hello: 'world' });
  });

  it.each([
    ['a missing key', null],
    ['an empty string', ''],
    ['truncated JSON', '{"a":'],
    ['plain text', 'not json at all'],
  ])('returns null for %s', (_label, value) => {
    if (value !== null) localStorage.setItem('k', value);
    expect(readJson(localStorage, 'k')).toBeNull();
  });

  it('returns null instead of throwing when storage itself throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('SecurityError');
      },
    } as unknown as Storage;
    expect(readJson(broken, 'k')).toBeNull();
  });
});

describe('writeJson', () => {
  it('serialises the value', () => {
    expect(writeJson(localStorage, 'k', [1, 2, 3])).toBe(true);
    expect(localStorage.getItem('k')).toBe('[1,2,3]');
  });

  it('reports failure instead of throwing when the quota is exceeded', () => {
    const full = {
      setItem: () => {
        throw new DOMException('QuotaExceededError');
      },
    } as unknown as Storage;
    expect(writeJson(full, 'k', { a: 1 })).toBe(false);
  });
});

describe('removeKey', () => {
  it('deletes the entry and swallows storage errors', () => {
    localStorage.setItem('k', 'v');
    removeKey(localStorage, 'k');
    expect(localStorage.getItem('k')).toBeNull();

    const broken = {
      removeItem: () => {
        throw new Error('nope');
      },
    } as unknown as Storage;
    expect(() => removeKey(broken, 'k')).not.toThrow();
  });
});

describe('resolveStorage', () => {
  it('returns localStorage and sessionStorage when available', () => {
    expect(resolveStorage('local')).toBe(localStorage);
    expect(resolveStorage('session')).toBe(sessionStorage);
  });

  it('falls back to memory storage when the browser blocks access', () => {
    const getter = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('blocked');
    });

    const storage = resolveStorage('local');
    storage.setItem('x', '1');
    expect(storage.getItem('x')).toBe('1');
    expect(storage.length).toBe(1);

    getter.mockRestore();
  });
});
