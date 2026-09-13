import { useContext } from 'react';
import { ConversationsContext } from './conversationsContext';
import type { ConversationsApi } from './conversationsContext';

/** Accesses the persisted conversation list and the active conversation. */
export function useConversations(): ConversationsApi {
  const api = useContext(ConversationsContext);
  if (!api) throw new Error('useConversations must be used inside a <ConversationsProvider>.');
  return api;
}
