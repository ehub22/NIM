/** Error classification for NIM requests. */

export type NimErrorKind =
  | 'missing-key'
  | 'unauthenticated'
  | 'forbidden'
  | 'rate-limited'
  | 'timeout'
  | 'aborted'
  | 'network'
  | 'bad-request'
  | 'not-found'
  | 'server'
  | 'parse'
  | 'unknown';

/** Replaces any occurrence of a credential inside a message with a placeholder. */
export function redact(text: string, secrets: readonly string[]): string {
  let result = text;
  for (const secret of secrets) {
    if (secret && secret.length >= 6) result = result.split(secret).join('[redacted]');
  }
  return result;
}

export class NimError extends Error {
  override readonly name = 'NimError';
  readonly kind: NimErrorKind;
  readonly status?: number;
  /** Value of the `NVCF-Request-ID`/`x-request-id` header, for support tickets. */
  readonly requestId?: string;
  /** Populated for 429 responses when `Retry-After` is present. */
  readonly retryAfterMs?: number;

  constructor(
    kind: NimErrorKind,
    message: string,
    options: { status?: number; requestId?: string; retryAfterMs?: number; cause?: unknown } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.kind = kind;
    this.status = options.status;
    this.requestId = options.requestId;
    this.retryAfterMs = options.retryAfterMs;
  }
}

export function kindFromStatus(status: number): NimErrorKind {
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 429) return 'rate-limited';
  if (status >= 400 && status < 500) return 'bad-request';
  return 'server';
}

/** Human-readable, safe-to-display copy for each failure kind. */
export const ERROR_HINTS: Record<NimErrorKind, string> = {
  'missing-key': 'Add your NVIDIA NIM API key in Settings to start chatting.',
  unauthenticated: 'NVIDIA rejected the API key. Check it in Settings and try again.',
  forbidden: 'This key is not allowed to use that model or endpoint.',
  'rate-limited': 'You hit a rate limit. Wait a moment, then try again.',
  timeout: 'The request timed out. Try a shorter prompt or a smaller max-token value.',
  aborted: 'Generation stopped.',
  network:
    'Could not reach the NVIDIA NIM endpoint. Check your connection — if the browser console shows a CORS error, the app needs the optional proxy (see the README).',
  'bad-request': 'NVIDIA rejected the request. The model or parameters may not be supported.',
  'not-found': 'That model is not available on this endpoint.',
  server: 'NVIDIA returned a server error. Try again shortly.',
  parse: 'Received a response that could not be parsed as JSON.',
  unknown: 'Something went wrong while contacting NVIDIA NIM.',
};

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError';
}

/**
 * Normalises anything thrown during a request into a `NimError`.
 *
 * `secrets` are scrubbed from the resulting message so a credential can never
 * leak into the UI, a toast or the console.
 */
export function toNimError(error: unknown, secrets: readonly string[] = []): NimError {
  if (error instanceof NimError) {
    return new NimError(error.kind, redact(error.message, secrets), {
      status: error.status,
      requestId: error.requestId,
      retryAfterMs: error.retryAfterMs,
      cause: error.cause,
    });
  }
  if (isAbortError(error)) return new NimError('aborted', ERROR_HINTS.aborted);

  const raw = error instanceof Error ? error.message : String(error);
  const message = redact(raw, secrets);
  // Browsers report blocked CORS requests and offline as an opaque TypeError.
  const looksLikeFetchFailure =
    error instanceof TypeError || /failed to fetch|networkerror|load failed|network request/i.test(message);
  return new NimError(looksLikeFetchFailure ? 'network' : 'unknown', message || ERROR_HINTS.unknown);
}

/** Turns an error kind into the copy shown to the user. */
export function describeError(error: unknown, secrets: readonly string[] = []): string {
  if (error instanceof NimError) {
    const hint = ERROR_HINTS[error.kind];
    const detail = redact(error.message, secrets);
    // Prefer the server's own explanation when it adds something.
    return error.kind === 'bad-request' || error.kind === 'server' || error.kind === 'not-found'
      ? detail || hint
      : hint;
  }
  return redact(error instanceof Error ? error.message : String(error), secrets) || ERROR_HINTS.unknown;
}
