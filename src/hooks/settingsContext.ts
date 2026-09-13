import { createContext } from 'react';
import type { AppSettings, ModelSettings } from '../types';

export interface SettingsApi {
  settings: AppSettings;
  /** The key the user entered, or `''` when none is stored. */
  apiKey: string;
  hasApiKey: boolean;
  updateSettings: (patch: Partial<AppSettings>) => void;
  updateDefaults: (patch: Partial<ModelSettings>) => void;
  /** Saves the key using the persistence mode in `settings.apiKeyPersistence`. */
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
}

export const SettingsContext = createContext<SettingsApi | null>(null);
