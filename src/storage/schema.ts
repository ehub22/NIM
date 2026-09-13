/**
 * Defensive parsing of everything that comes back from browser storage or an
 * imported JSON file. Nothing here throws: unusable values are replaced with
 * defaults, and records that cannot be repaired are dropped.
 */
import type {
  AppSettings,
  ApiKeyPersistence,
  ChatMessage,
  Conversation,
  MessageStatus,
  ModelSettings,
  Role,
  ThemePreference,
  TokenUsage,
} from '../types';
import { normalizeBaseUrl, resolveDefaultBaseUrl } from '../services/nim/config';
import { DEFAULT_MODEL_ID } from '../services/nim/catalog';
import { createDefaultSettings, DEFAULT_MODEL_SETTINGS } from './defaults';

export const LIMITS = {
  temperature: { min: 0, max: 2 },
  topP: { min: 0, max: 1 },
  maxTokens: { min: 1, max: 32_768 },
  /** Guards against a single record ballooning local storage. */
  messageContentLength: 1_000_000,
  systemPromptLength: 8_000,
  titleLength: 120,
} as const;

const ROLES: readonly Role[] = ['system', 'user', 'assistant'];
const STATUSES: readonly MessageStatus[] = ['complete', 'streaming', 'aborted', 'error'];
const THEMES: readonly ThemePreference[] = ['light', 'dark', 'system'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Clamps to `[min, max]` and quantizes to `step`; falls back when not finite.
 *
 * The result is rounded to the precision implied by `step` so that snapping to
 * a fractional step cannot introduce binary floating-point drift (0.7 must not
 * come back out of storage as 0.7000000000000001).
 */
export function clampNumber(
  value: unknown,
  { min, max, fallback, step = 1 }: { min: number; max: number; fallback: number; step?: number },
): number {
  // Only real numbers and non-empty numeric strings count: `Number(null)` is 0
  // and `Number([])` is 0, which would silently masquerade as a valid value.
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  const bounded = Math.min(Math.max(parsed, min), max);
  const snapped = Math.round(bounded / step) * step;
  const decimals = step >= 1 ? 0 : Math.min(10, Math.ceil(-Math.log10(step)));
  return Number(snapped.toFixed(decimals));
}

function string(value: unknown, fallback = '', maxLength = Number.MAX_SAFE_INTEGER): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function timestamp(value: unknown, now: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : now;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function sanitizeModelSettings(value: unknown): ModelSettings {
  const source = isRecord(value) ? value : {};
  const prompt = string(source.systemPrompt, '', LIMITS.systemPromptLength);
  return {
    temperature: clampNumber(source.temperature, {
      ...LIMITS.temperature,
      step: 0.05,
      fallback: DEFAULT_MODEL_SETTINGS.temperature,
    }),
    topP: clampNumber(source.topP, { ...LIMITS.topP, step: 0.05, fallback: DEFAULT_MODEL_SETTINGS.topP }),
    maxTokens: clampNumber(source.maxTokens, {
      ...LIMITS.maxTokens,
      fallback: DEFAULT_MODEL_SETTINGS.maxTokens,
    }),
    systemPrompt: prompt,
    stream: typeof source.stream === 'boolean' ? source.stream : DEFAULT_MODEL_SETTINGS.stream,
  };
}

function sanitizeUsage(value: unknown): TokenUsage | undefined {
  if (!isRecord(value)) return undefined;
  const promptTokens = clampNumber(value.promptTokens, { min: 0, max: 1e9, fallback: 0 });
  const completionTokens = clampNumber(value.completionTokens, { min: 0, max: 1e9, fallback: 0 });
  const totalTokens = clampNumber(value.totalTokens, {
    min: 0,
    max: 1e9,
    fallback: promptTokens + completionTokens,
  });
  if (promptTokens === 0 && completionTokens === 0 && totalTokens === 0) return undefined;
  return { promptTokens, completionTokens, totalTokens };
}

export function sanitizeMessage(value: unknown): ChatMessage | null {
  if (!isRecord(value)) return null;
  const role = oneOf(value.role, ROLES, 'user');
  const content =
    typeof value.content === 'string' ? value.content.slice(0, LIMITS.messageContentLength) : '';
  // A message with neither content nor an error marker carries no information.
  if (content === '' && value.error === undefined) return null;

  const now = Date.now();
  const message: ChatMessage = {
    id: string(value.id) || `msg_${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt: timestamp(value.createdAt, now),
    status: oneOf(value.status, STATUSES, 'complete'),
  };
  const model = string(value.model);
  if (model) message.model = model;
  const usage = sanitizeUsage(value.usage);
  if (usage) message.usage = usage;
  const error = string(value.error);
  if (error) message.error = error;
  return message;
}

export function sanitizeConversation(value: unknown): Conversation | null {
  if (!isRecord(value)) return null;
  const id = string(value.id);
  if (!id) return null;

  const now = Date.now();
  const messages = (Array.isArray(value.messages) ? value.messages : [])
    .map(sanitizeMessage)
    .filter((message): message is ChatMessage => message !== null);

  const settings = sanitizeModelSettings(value.settings);
  const model = string(value.model) || DEFAULT_MODEL_ID;
  const createdAt = timestamp(value.createdAt, now);
  const title = string(value.title, '', LIMITS.titleLength);

  return {
    id,
    title: title || 'Untitled conversation',
    model,
    createdAt,
    // A conversation is never older than its own creation time.
    updatedAt: Math.max(timestamp(value.updatedAt, createdAt), createdAt),
    messages,
    settings,
  };
}

/** Parses an array of conversations, dropping entries that cannot be repaired. */
export function sanitizeConversationList(value: unknown): Conversation[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: Conversation[] = [];
  for (const entry of value) {
    const conversation = sanitizeConversation(entry);
    if (!conversation || seen.has(conversation.id)) continue;
    seen.add(conversation.id);
    result.push(conversation);
  }
  return result;
}

export function sanitizeSettings(value: unknown): AppSettings {
  const base = createDefaultSettings();
  if (!isRecord(value)) return base;

  const baseUrl = normalizeBaseUrl(string(value.baseUrl));
  const persistence = oneOf<ApiKeyPersistence>(value.apiKeyPersistence, ['local', 'session'], 'local');

  return {
    baseUrl: baseUrl || resolveDefaultBaseUrl(),
    model: string(value.model) || DEFAULT_MODEL_ID,
    theme: oneOf<ThemePreference>(value.theme, THEMES, base.theme),
    defaults: sanitizeModelSettings(value.defaults),
    apiKeyPersistence: persistence,
  };
}
