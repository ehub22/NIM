/** Namespaced browser-storage keys. Keep `index.html` in sync with `settings`. */
export const STORAGE_KEYS = {
  settings: 'nim-chat:settings:v1',
  conversations: 'nim-chat:conversations:v1',
  /** Persistent API key (survives browser restarts). */
  apiKeyLocal: 'nim-chat:api-key',
  /** Tab-scoped API key (cleared when the tab closes). */
  apiKeySession: 'nim-chat:api-key:session',
} as const;

/** Bumped when a stored record shape changes incompatibly. */
export const SCHEMA_VERSION = 1;
