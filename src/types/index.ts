/**
 * Domain types shared across the application.
 *
 * These describe what the UI works with; the raw NVIDIA NIM payloads live in
 * `src/services/nim/types.ts` so the API surface can change without touching
 * the rest of the app.
 */

export type Role = 'system' | 'user' | 'assistant';

export type MessageStatus = 'complete' | 'streaming' | 'aborted' | 'error';

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  /** Unix epoch milliseconds. */
  createdAt: number;
  /** Model that produced an assistant message. */
  model?: string;
  /** Defaults to `complete` when absent (older persisted records). */
  status?: MessageStatus;
  usage?: TokenUsage;
  /** Human-readable failure text; never contains credentials. */
  error?: string;
}

export interface ModelSettings {
  /** 0–2 */
  temperature: number;
  /** Upper bound for generated tokens. */
  maxTokens: number;
  /** 0–1 */
  topP: number;
  /** Optional instruction prepended to every request. */
  systemPrompt: string;
  /** Stream tokens as they arrive. */
  stream: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  model: string;
  /** Unix epoch milliseconds. */
  createdAt: number;
  /** Unix epoch milliseconds; conversations are sorted by this, newest first. */
  updatedAt: number;
  messages: ChatMessage[];
  settings: ModelSettings;
}

export type ThemePreference = 'light' | 'dark' | 'system';

/** Where the user's API key is kept. */
export type ApiKeyPersistence = 'local' | 'session';

export interface AppSettings {
  /** OpenAI-compatible base URL, without a trailing slash. */
  baseUrl: string;
  /** Currently selected NIM model id. */
  model: string;
  theme: ThemePreference;
  /** Values used when a new conversation is created. */
  defaults: ModelSettings;
  /** `local` survives browser restarts, `session` is dropped when the tab closes. */
  apiKeyPersistence: ApiKeyPersistence;
}

export interface ModelInfo {
  id: string;
  /** Friendly name shown in the picker. */
  name: string;
  provider: string;
  description: string;
  /** Advertised context window in tokens, when known. */
  contextWindow?: number;
  /** `api` = returned by GET /models, `fallback` = shipped with the app. */
  source: 'api' | 'fallback';
}

export type ConnectionStatus = 'missing-key' | 'checking' | 'online' | 'unavailable';

export interface ConnectionState {
  status: ConnectionStatus;
  /** Detail shown in the tooltip / settings dialog. Never contains a key. */
  detail?: string;
  checkedAt?: number;
}

export interface Toast {
  id: string;
  tone: 'success' | 'error' | 'info';
  message: string;
  /** Optional action, e.g. "Open settings". */
  actionLabel?: string;
  onAction?: () => void;
}
