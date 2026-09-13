/**
 * The only module that talks to NVIDIA NIM.
 *
 * Everything the rest of the app needs goes through `NimClient`, which keeps
 * request construction, streaming, timeouts and error mapping in one place.
 * Swapping in a backend proxy later means pointing `baseUrl` at it (or passing
 * a custom `fetchImpl`) — no component has to change.
 */
import type { TokenUsage } from '../../types';
import { DEFAULT_STREAM_IDLE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS } from './config';
import { ERROR_HINTS, NimError, isAbortError, kindFromStatus, redact, toNimError } from './errors';
import { createSseParser } from './sse';
import type {
  NimChatCompletion,
  NimChatMessage,
  NimChatRequestBody,
  NimErrorPayload,
  NimModelList,
} from './types';

export type NimFetch = typeof fetch;

export interface NimClientConfig {
  apiKey: string;
  /** OpenAI-compatible base URL, e.g. `https://integrate.api.nvidia.com/v1`. */
  baseUrl: string;
  timeoutMs?: number;
  streamIdleTimeoutMs?: number;
  /** Override the transport — used by tests and by a future proxy client. */
  fetchImpl?: NimFetch;
}

export interface ChatCompletionParams {
  model: string;
  messages: NimChatMessage[];
  temperature: number;
  topP: number;
  maxTokens: number;
}

export interface CompletionResult {
  content: string;
  model?: string;
  finishReason?: string;
  usage?: TokenUsage;
}

export interface RequestOptions {
  signal?: AbortSignal;
}

export interface StreamOptions extends RequestOptions {
  /** Invoked with each token delta as it arrives. */
  onDelta?: (delta: string) => void;
}

/** Model families that are not text-generation and should not be offered. */
const NON_CHAT_MODEL_PATTERN =
  /(embed|rerank|retriever|guard|gliner|safety|reward|(^|[-_])asr([-_]|$)|(^|[-_])tts([-_]|$)|ocr|page-elements|table-structure|graphic-elements|imagen|sdxl|cosmos|vista|molmim|cuopt|megatron|streampetr|usdcode|sparsedrive|bevformer|relighting|lip-?sync|video|calibration|parse)/i;

/** Builds the JSON body for `POST /chat/completions`. */
export function buildChatRequestBody(params: ChatCompletionParams, stream: boolean): NimChatRequestBody {
  const body: NimChatRequestBody = {
    model: params.model,
    messages: params.messages.map(({ role, content }) => ({ role, content })),
    temperature: params.temperature,
    top_p: params.topP,
    max_tokens: params.maxTokens,
    stream,
  };
  // Ask NIM to append a usage chunk at the end of a stream when it can.
  if (stream) body.stream_options = { include_usage: true };
  return body;
}

/** Filters model ids down to plausible chat models and sorts them. */
export function selectChatModels(ids: readonly string[]): string[] {
  const unique = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  return unique
    .filter((id) => !NON_CHAT_MODEL_PATTERN.test(id))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function mapUsage(usage: {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}): TokenUsage | undefined {
  const promptTokens = usage.prompt_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? 0;
  const totalTokens = usage.total_tokens ?? promptTokens + completionTokens;
  if (promptTokens === 0 && completionTokens === 0 && totalTokens === 0) return undefined;
  return { promptTokens, completionTokens, totalTokens };
}

/**
 * Abort controller that also enforces a timeout. `reset` restarts the clock,
 * which streaming uses after every received chunk (an idle timeout rather than
 * a hard cap, so long answers are not cut off).
 */
function createAbortLink(
  external: AbortSignal | undefined,
  ms: number,
  onTimeout: () => void,
): { signal: AbortSignal; reset: () => void; cancel: () => void } {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const reset = () => {
    if (ms <= 0) return;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      onTimeout();
      controller.abort();
    }, ms);
  };

  const onExternalAbort = () => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener('abort', onExternalAbort, { once: true });
  }

  reset();

  return {
    signal: controller.signal,
    reset,
    cancel: () => {
      if (timer !== undefined) clearTimeout(timer);
      external?.removeEventListener('abort', onExternalAbort);
    },
  };
}

function extractErrorMessage(text: string): string {
  try {
    const parsed = JSON.parse(text) as NimErrorPayload;
    const message = parsed.error?.message ?? parsed.message ?? parsed.detail;
    if (typeof message === 'string' && message.trim()) return message.trim();
  } catch {
    /* not JSON — fall through to the raw body */
  }
  const trimmed = text.trim();
  return trimmed ? trimmed.slice(0, 300) : '';
}

function retryAfterMs(headers: Headers): number | undefined {
  const value = headers.get('retry-after');
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

export class NimClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly streamIdleTimeoutMs: number;
  private readonly fetchImpl: NimFetch;

  constructor(config: NimClientConfig) {
    this.apiKey = config.apiKey.trim();
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.streamIdleTimeoutMs = config.streamIdleTimeoutMs ?? DEFAULT_STREAM_IDLE_TIMEOUT_MS;
    this.fetchImpl = config.fetchImpl ?? ((...args: Parameters<NimFetch>) => fetch(...args));
  }

  private get secrets(): string[] {
    return this.apiKey ? [this.apiKey] : [];
  }

  private assertKey(): void {
    if (!this.apiKey) throw new NimError('missing-key', ERROR_HINTS['missing-key']);
  }

  private url(path: string): string {
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private headers(accept: string): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      Accept: accept,
    };
  }

  private async toNimErrorFromResponse(response: Response): Promise<NimError> {
    const detail = extractErrorMessage(await response.text().catch(() => ''));
    const kind = kindFromStatus(response.status);
    const fallback = detail || `${ERROR_HINTS[kind]} (HTTP ${response.status})`;
    return new NimError(kind, redact(fallback, this.secrets), {
      status: response.status,
      requestId: response.headers.get('x-request-id') ?? response.headers.get('nvcf-request-id') ?? undefined,
      retryAfterMs: retryAfterMs(response.headers),
    });
  }

  /**
   * `GET /models`. Throws `NimError` when discovery fails; callers are expected
   * to fall back to the bundled catalogue so the app stays usable.
   */
  async listModels(options: RequestOptions = {}): Promise<string[]> {
    this.assertKey();
    let timedOut = false;
    const link = createAbortLink(options.signal, this.timeoutMs, () => {
      timedOut = true;
    });
    try {
      const response = await this.fetchImpl(this.url('/models'), {
        method: 'GET',
        headers: this.headers('application/json'),
        signal: link.signal,
      });
      if (!response.ok) throw await this.toNimErrorFromResponse(response);
      const payload = (await response.json()) as NimModelList;
      const ids = Array.isArray(payload?.data) ? payload.data.map((entry) => entry?.id ?? '') : [];
      return selectChatModels(ids);
    } catch (error) {
      throw this.classify(error, timedOut, options.signal);
    } finally {
      link.cancel();
    }
  }

  /** Single-shot completion (`stream: false`). */
  async complete(params: ChatCompletionParams, options: RequestOptions = {}): Promise<CompletionResult> {
    this.assertKey();
    let timedOut = false;
    const link = createAbortLink(options.signal, this.timeoutMs, () => {
      timedOut = true;
    });
    const body = buildChatRequestBody(params, false);

    try {
      const response = await this.fetchImpl(this.url('/chat/completions'), {
        method: 'POST',
        headers: this.headers('application/json'),
        body: JSON.stringify(body),
        signal: link.signal,
      });
      if (!response.ok) throw await this.toNimErrorFromResponse(response);

      const payload = (await response.json().catch(() => null)) as NimChatCompletion | null;
      if (!payload) throw new NimError('parse', ERROR_HINTS.parse);

      const choice = payload.choices?.[0];
      const content = choice?.message?.content ?? '';
      return {
        content,
        model: payload.model,
        finishReason: choice?.finish_reason ?? undefined,
        usage: payload.usage ? mapUsage(payload.usage) : undefined,
      };
    } catch (error) {
      throw this.classify(error, timedOut, options.signal);
    } finally {
      link.cancel();
    }
  }

  /**
   * Streaming completion (`stream: true`). Deltas are forwarded as they arrive
   * and the aggregated text is returned once the stream closes, so callers can
   * update the UI progressively and still persist a final value.
   */
  async stream(params: ChatCompletionParams, options: StreamOptions = {}): Promise<CompletionResult> {
    this.assertKey();
    let timedOut = false;
    const link = createAbortLink(options.signal, this.streamIdleTimeoutMs, () => {
      timedOut = true;
    });
    const body = buildChatRequestBody(params, true);
    let content = '';
    let finishReason: string | undefined;
    let usage: TokenUsage | undefined;
    let model: string | undefined;

    try {
      const response = await this.fetchImpl(this.url('/chat/completions'), {
        method: 'POST',
        headers: this.headers('text/event-stream'),
        body: JSON.stringify(body),
        signal: link.signal,
      });
      if (!response.ok) throw await this.toNimErrorFromResponse(response);
      if (!response.body) throw new NimError('parse', ERROR_HINTS.parse);

      const parser = createSseParser((payload) => {
        if (payload === '[DONE]') return;
        let chunk: NimChatCompletion;
        try {
          chunk = JSON.parse(payload) as NimChatCompletion;
        } catch {
          return; // Skip malformed keep-alives rather than aborting the answer.
        }
        if (chunk.model) model = chunk.model;
        if (chunk.usage) usage = mapUsage(chunk.usage) ?? usage;
        const choice = chunk.choices?.[0];
        if (!choice) return;
        if (choice.finish_reason) finishReason = choice.finish_reason;
        const delta = choice.delta?.content;
        if (delta) {
          content += delta;
          options.onDelta?.(delta);
        }
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          // Any traffic means the endpoint is alive: restart the idle timer.
          link.reset();
          if (value && value.byteLength > 0) parser.push(decoder.decode(value, { stream: true }));
        }
        parser.push(decoder.decode());
      } finally {
        reader.releaseLock();
      }
      parser.flush();

      return { content, model, finishReason, usage };
    } catch (error) {
      // Whatever arrived before the failure is worth keeping; surface both.
      throw this.classify(error, timedOut, options.signal, content);
    } finally {
      link.cancel();
    }
  }

  /**
   * Converts transport failures into `NimError`, distinguishing user-initiated
   * aborts from timeouts. `partial` is attached to the message so a truncated
   * answer is not silently discarded.
   */
  private classify(
    error: unknown,
    timedOut: boolean,
    external: AbortSignal | undefined,
    partial = '',
  ): NimError {
    if (timedOut) {
      return new NimError('timeout', ERROR_HINTS.timeout, { cause: error });
    }
    if (external?.aborted || isAbortError(error)) {
      return new NimError('aborted', ERROR_HINTS.aborted, { cause: error });
    }
    const mapped = toNimError(error, this.secrets);
    if (!partial) return mapped;
    // Tokens arrived before the failure: keep them and say what happened.
    return new NimError(mapped.kind, `${mapped.message} (${partial.length} characters received)`, {
      status: mapped.status,
      requestId: mapped.requestId,
      retryAfterMs: mapped.retryAfterMs,
      cause: error,
    });
  }
}
