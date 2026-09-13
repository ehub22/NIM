import { useContext } from 'react';
import { SettingsContext } from './settingsContext';
import type { SettingsApi } from './settingsContext';

/** Accesses user settings and the runtime API key. */
export function useSettings(): SettingsApi {
  const api = useContext(SettingsContext);
  if (!api) throw new Error('useSettings must be used inside a <SettingsProvider>.');
  return api;
}
