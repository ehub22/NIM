import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAllLocalData,
  clearApiKey,
  loadApiKey,
  loadSettings,
  saveApiKey,
  saveSettings,
} from '../../src/storage/settings';
import { STORAGE_KEYS } from '../../src/storage/keys';
import { DEFAULT_MODEL_ID } from '../../src/services/nim/catalog';

describe('settings persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('returns defaults when nothing has been stored', () => {
    const settings = loadSettings();
    expect(settings.model).toBe(DEFAULT_MODEL_ID);
    expect(settings.theme).toBe('system');
    expect(settings.apiKeyPersistence).toBe('local');
    expect(settings.defaults.temperature).toBeGreaterThan(0);
    expect(settings.baseUrl.length).toBeGreaterThan(0);
  });

  it('round-trips a saved document', () => {
    const settings = loadSettings();
    saveSettings({ ...settings, theme: 'light', model: 'qwen/qwen3-235b-a22b' });
    expect(loadSettings()).toMatchObject({ theme: 'light', model: 'qwen/qwen3-235b-a22b' });
  });

  it.each([
    ['{"theme":', 'truncated JSON'],
    ['"a string"', 'a non-object'],
    ['{"theme":"neon","model":42,"baseUrl":"javascript:alert(1)"}', 'hostile values'],
  ])('recovers defaults from %s instead of throwing', (_label, raw) => {
    localStorage.setItem(STORAGE_KEYS.settings, raw);
    const settings = loadSettings();
    expect(settings.theme).toBe('system');
    expect(settings.model).toBe(DEFAULT_MODEL_ID);
    expect(settings.baseUrl).not.toContain('javascript:');
  });

  it('clamps out-of-range parameters', () => {
    localStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({ defaults: { temperature: 99, topP: -4, maxTokens: 0, stream: 'yes' } }),
    );
    const settings = loadSettings();
    expect(settings.defaults.temperature).toBeLessThanOrEqual(2);
    expect(settings.defaults.topP).toBeGreaterThanOrEqual(0);
    expect(settings.defaults.maxTokens).toBeGreaterThanOrEqual(1);
    expect(typeof settings.defaults.stream).toBe('boolean');
  });
});

describe('API key storage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('stores in localStorage when persistence is "local"', () => {
    expect(saveApiKey('nvapi-secret', 'local')).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.apiKeyLocal)).toBe('nvapi-secret');
    expect(sessionStorage.getItem(STORAGE_KEYS.apiKeySession)).toBeNull();
    expect(loadApiKey('local')).toBe('nvapi-secret');
  });

  it('stores in sessionStorage when persistence is "session"', () => {
    saveApiKey('nvapi-secret', 'session');
    expect(sessionStorage.getItem(STORAGE_KEYS.apiKeySession)).toBe('nvapi-secret');
    expect(localStorage.getItem(STORAGE_KEYS.apiKeyLocal)).toBeNull();
    expect(loadApiKey('session')).toBe('nvapi-secret');
  });

  it('moves the key when the persistence mode changes', () => {
    saveApiKey('nvapi-secret', 'local');
    saveApiKey('nvapi-secret', 'session');

    expect(localStorage.getItem(STORAGE_KEYS.apiKeyLocal)).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEYS.apiKeySession)).toBe('nvapi-secret');
  });

  it('reads a key stored before the persistence toggle existed', () => {
    saveApiKey('nvapi-secret', 'local');
    expect(loadApiKey('session')).toBe('nvapi-secret');
  });

  it('trims surrounding whitespace', () => {
    saveApiKey('  nvapi-secret  ', 'local');
    expect(loadApiKey('local')).toBe('nvapi-secret');
  });

  it('treats an empty key as a clear', () => {
    saveApiKey('nvapi-secret', 'local');
    expect(saveApiKey('   ', 'local')).toBe(true);
    expect(loadApiKey('local')).toBe('');
  });

  it('removes the key from both stores', () => {
    saveApiKey('nvapi-secret', 'local');
    sessionStorage.setItem(STORAGE_KEYS.apiKeySession, 'stale');
    clearApiKey();

    expect(loadApiKey('local')).toBe('');
    expect(loadApiKey('session')).toBe('');
  });

  it('never writes the key into the settings document', () => {
    saveApiKey('nvapi-secret', 'local');
    saveSettings(loadSettings());
    expect(localStorage.getItem(STORAGE_KEYS.settings)).not.toContain('nvapi-secret');
  });
});

describe('clearAllLocalData', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('removes conversations, settings and the key', () => {
    saveApiKey('nvapi-secret', 'local');
    saveSettings(loadSettings());
    localStorage.setItem(STORAGE_KEYS.conversations, '[]');

    clearAllLocalData();

    expect(loadApiKey('local')).toBe('');
    expect(localStorage.getItem(STORAGE_KEYS.settings)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.conversations)).toBeNull();
  });
});
