/**
 * Wire types for NVIDIA NIM's OpenAI-compatible REST API.
 *
 * Field names intentionally match the JSON on the wire (snake_case) so the
 * mapping to `src/types` is explicit and auditable.
 */

export interface NimChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface NimChatRequestBody {
  model: string;
  messages: NimChatMessage[];
  temperature: number;
  top_p: number;
  max_tokens: number;
  stream: boolean;
  /** Ask for a final usage chunk when streaming. */
  stream_options?: { include_usage: boolean };
}

export interface NimUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface NimChoice {
  index?: number;
  message?: { role?: string; content?: string | null };
  delta?: { role?: string; content?: string | null };
  finish_reason?: string | null;
}

export interface NimChatCompletion {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: NimChoice[];
  usage?: NimUsage;
}

export interface NimModelRecord {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
}

export interface NimModelList {
  object?: string;
  data?: NimModelRecord[];
}

/** Shape NIM returns for 4xx/5xx responses. */
export interface NimErrorPayload {
  error?: {
    message?: string;
    type?: string;
    code?: string | number | null;
  };
  message?: string;
  detail?: string;
}
