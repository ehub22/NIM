import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { ConversationsContext } from '../../hooks/conversationsContext';
import { useConversationsController } from '../../hooks/useConversationsController';
import { useSettings } from '../../hooks/useSettings';

/**
 * Nested inside `SettingsProvider` so new conversations inherit the user's
 * default model and parameters.
 */
export function ConversationsProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const defaults = useMemo(
    () => ({ model: settings.model, settings: settings.defaults }),
    [settings.model, settings.defaults],
  );
  const api = useConversationsController(defaults);
  return <ConversationsContext.Provider value={api}>{children}</ConversationsContext.Provider>;
}
