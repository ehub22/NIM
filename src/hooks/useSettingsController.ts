import { useCallback, useEffect, useState } from 'react';
import type { AppSettings, ModelSettings } from '../types';
import {
  clearApiKey as clearStoredApiKey,
  loadApiKey,
  loadSettings,
  saveApiKey,
  saveSettings,
} from '../storage/settings';
import { sanitizeSettings } from '../storage/schema';
import type { SettingsApi } from './settingsContext';

/** Owns the settings document and the runtime API key. */
export function useSettingsController(): SettingsApi {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [apiKey, setApiKeyState] = useState<string>(() => loadApiKey(settings.apiKeyPersistence));

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Moving between "remember" and "this session only" rewrites the key into
  // the newly selected store (and removes it from the previous one).
  useEffect(() => {
    if (apiKey) saveApiKey(apiKey, settings.apiKeyPersistence);
    // Intentionally keyed on the persistence mode only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.apiKeyPersistence]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((previous) =>
      sanitizeSettings({
        ...previous,
        ...patch,
        defaults: { ...previous.defaults, ...(patch.defaults ?? {}) },
      }),
    );
  }, []);

  const updateDefaults = useCallback((patch: Partial<ModelSettings>) => {
    setSettings((previous) => ({ ...previous, defaults: { ...previous.defaults, ...patch } }));
  }, []);

  const setApiKey = useCallback(
    (key: string) => {
      const trimmed = key.trim();
      saveApiKey(trimmed, settings.apiKeyPersistence);
      setApiKeyState(trimmed);
    },
    [settings.apiKeyPersistence],
  );

  const clearApiKey = useCallback(() => {
    clearStoredApiKey();
    setApiKeyState('');
  }, []);

  return {
    settings,
    apiKey,
    hasApiKey: apiKey.length > 0,
    updateSettings,
    updateDefaults,
    setApiKey,
    clearApiKey,
  };
}
