import type { ReactNode } from 'react';
import { SettingsContext } from '../../hooks/settingsContext';
import { useSettingsController } from '../../hooks/useSettingsController';

export function SettingsProvider({ children }: { children: ReactNode }) {
  const api = useSettingsController();
  return <SettingsContext.Provider value={api}>{children}</SettingsContext.Provider>;
}
