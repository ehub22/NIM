import type { AppSettings, ModelInfo } from '../../types';
import { getEndpointConfig } from './config';
import { FALLBACK_MODELS, findFallbackModel, prettyModelName } from './catalog';
import { NimClient } from './client';
import type { NimClientConfig } from './client';

export interface CreateClientInput {
  apiKey: string;
  /** Overrides the endpoint configured in settings (e.g. a proxy URL). */
  baseUrl?: string;
}

/** Builds a client from the user's settings plus their runtime API key. */
export function createNimClient(input: CreateClientInput, settings?: AppSettings): NimClient {
  const config = getEndpointConfig();
  const options: NimClientConfig = {
    apiKey: input.apiKey,
    baseUrl: input.baseUrl?.trim() || settings?.baseUrl || config.baseUrl,
    timeoutMs: config.timeoutMs,
    streamIdleTimeoutMs: config.streamIdleTimeoutMs,
  };
  return new NimClient(options);
}

/** Derives a provider from a `provider/model` id. */
export function providerFromId(id: string): string {
  if (!id.includes('/')) return 'Unknown';
  const provider = id.split('/')[0] ?? '';
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

/**
 * Turns raw model ids into UI-ready records, reusing the bundled descriptions
 * where an id is known and deriving a readable label otherwise.
 */
export function toModelInfos(ids: readonly string[]): ModelInfo[] {
  return ids.map((id) => {
    const known = findFallbackModel(id);
    if (known) return { ...known, source: 'api' as const };
    return {
      id,
      name: prettyModelName(id),
      provider: providerFromId(id),
      description: 'Available on the configured endpoint.',
      source: 'api' as const,
    };
  });
}

export { FALLBACK_MODELS };
export * from './client';
export * from './errors';
export * from './config';
