/** Static configuration for the NVIDIA NIM integration. */

/** NVIDIA's hosted, OpenAI-compatible endpoint. */
export const DEFAULT_NIM_BASE_URL = 'https://integrate.api.nvidia.com/v1';

/**
 * Path served by the Vite dev-server proxy (see `vite.config.ts`) and by
 * `proxy/server.mjs`. A relative base URL means the browser talks to the same
 * origin, which sidesteps CORS entirely.
 */
export const DEV_PROXY_BASE_URL = '/nim-api/v1';

export const DEFAULT_TIMEOUT_MS = 60_000;
export const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 120_000;

/**
 * The base URL used when the user has not configured one: the dev proxy during
 * `vite dev`, and the hosted endpoint in a production build.
 */
export function resolveDefaultBaseUrl(): string {
  const configured = normalizeBaseUrl(import.meta.env.VITE_NIM_BASE_URL ?? '');
  if (configured) return configured;
  return import.meta.env.DEV ? DEV_PROXY_BASE_URL : DEFAULT_NIM_BASE_URL;
}

/**
 * Trims, strips trailing slashes and rejects values that cannot be a base URL.
 * Returns `''` for unusable input so callers can fall back to a default.
 */
export function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (trimmed.startsWith('/')) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return trimmed;
  } catch {
    return '';
  }
}

/**
 * `true` when requests go to the current origin (a dev-server proxy or a
 * reverse proxy). Cross-origin calls to a third-party origin are the ones that
 * can be blocked by CORS.
 */
export function isSameOriginBase(baseUrl: string): boolean {
  return baseUrl.startsWith('/');
}

function readTimeout(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.trunc(parsed), 10 * 60_000);
}

export interface NimEndpointConfig {
  baseUrl: string;
  timeoutMs: number;
  streamIdleTimeoutMs: number;
  endpointLabel: string;
}

/** Build-time configuration merged from `import.meta.env`. */
export function getEndpointConfig(): NimEndpointConfig {
  return {
    baseUrl: resolveDefaultBaseUrl(),
    timeoutMs: readTimeout(import.meta.env.VITE_NIM_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    streamIdleTimeoutMs: readTimeout(
      import.meta.env.VITE_NIM_STREAM_IDLE_TIMEOUT_MS,
      DEFAULT_STREAM_IDLE_TIMEOUT_MS,
    ),
    endpointLabel: import.meta.env.VITE_NIM_ENDPOINT_LABEL?.trim() || 'NVIDIA NIM hosted API',
  };
}
