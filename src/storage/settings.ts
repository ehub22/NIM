/**
 * Persistence for user settings and the API key.
 *
 * The API key is deliberately kept out of the settings document so it cannot
 * end up in an export, and it is written to either `localStorage` (survives
 * browser restarts) or `sessionStorage` (cleared when the tab closes) at the
 * user's explicit choice.
 */
import type { AppSettings, ApiKeyPersistence } from '../types';
import { removeKey, resolveStorage, readJson, writeJson } from './safeStorage';
import { sanitizeSettings } from './schema';
import { STORAGE_KEYS } from './keys';

export function loadSettings(): AppSettings {
  const storage = resolveStorage('local');
  return sanitizeSettings(readJson(storage, STORAGE_KEYS.settings));
}

export function saveSettings(settings: AppSettings): boolean {
  return writeJson(resolveStorage('local'), STORAGE_KEYS.settings, sanitizeSettings(settings));
}

function apiKeyKeys(): { local: string; session: string } {
  return { local: STORAGE_KEYS.apiKeyLocal, session: STORAGE_KEYS.apiKeySession };
}

/**
 * Reads the stored key, preferring the persistence mode the user selected and
 * falling back to the other store if it was saved before the toggle changed.
 */
export function loadApiKey(persistence: ApiKeyPersistence): string {
  const keys = apiKeyKeys();
  const primary = resolveStorage(persistence);
  const fromPrimary = primary.getItem(persistence === 'session' ? keys.session : keys.local);
  if (fromPrimary) return fromPrimary;

  const secondary = resolveStorage(persistence === 'session' ? 'local' : 'session');
  return secondary.getItem(persistence === 'session' ? keys.local : keys.session) ?? '';
}

/**
 * Stores the key in the selected store and removes it from the other one, so
 * switching from "remember" to "this session only" really does drop the copy.
 */
export function saveApiKey(key: string, persistence: ApiKeyPersistence): boolean {
  const keys = apiKeyKeys();
  const trimmed = key.trim();
  clearApiKey();
  if (!trimmed) return true;
  return writeRaw(
    resolveStorage(persistence),
    persistence === 'session' ? keys.session : keys.local,
    trimmed,
  );
}

/** Removes the key from both stores. */
export function clearApiKey(): void {
  const keys = apiKeyKeys();
  removeKey(resolveStorage('local'), keys.local);
  removeKey(resolveStorage('session'), keys.session);
}

/** Raw string write — the key is not JSON-encoded, so it stays readable. */
function writeRaw(storage: Storage, key: string, value: string): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Deletes every key this app owns in both stores. */
export function clearAllLocalData(): void {
  clearApiKey();
  removeKey(resolveStorage('local'), STORAGE_KEYS.settings);
  removeKey(resolveStorage('local'), STORAGE_KEYS.conversations);
}
