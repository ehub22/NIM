import { MemoryStorage } from './memoryStorage';

const memoryFallback = new MemoryStorage();

/** Returns a usable store even when the browser blocks persistent storage. */
export function resolveStorage(preferred: 'local' | 'session'): Storage {
  try {
    const candidate = preferred === 'session' ? window.sessionStorage : window.localStorage;
    // Some engines expose the object but throw on access.
    const probe = '__nim_probe__';
    candidate.setItem(probe, '1');
    candidate.removeItem(probe);
    return candidate;
  } catch {
    return memoryFallback;
  }
}

/**
 * Parses JSON out of storage, returning `null` for missing, empty, malformed
 * or unexpected payloads. Corrupt data never propagates as an exception.
 */
export function readJson(storage: Storage, key: string): unknown {
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (raw === null || raw === '') return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/**
 * Serialises a value into storage. Returns `false` when the write fails
 * (quota exceeded, storage disabled) so callers can warn instead of crashing.
 */
export function writeJson(storage: Storage, key: string, value: unknown): boolean {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    /* nothing actionable */
  }
}
