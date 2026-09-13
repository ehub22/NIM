import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ConnectionState, ModelInfo } from '../types';
import { FALLBACK_MODELS, createNimClient, describeError, toModelInfos } from '../services/nim';
import { NimError } from '../services/nim/errors';

export interface UseModelsInput {
  apiKey: string;
  baseUrl: string;
}

export interface UseModelsResult {
  /** API results when discovery worked, otherwise the bundled catalogue. */
  models: readonly ModelInfo[];
  usingFallback: boolean;
  isLoading: boolean;
  connection: ConnectionState;
  refresh: () => void;
}

interface Discovery {
  /** The reload token this result belongs to; `-1` until the first response. */
  token: number;
  ids: string[] | null;
  failed: boolean;
  detail?: string;
  checkedAt?: number;
}

const NO_DISCOVERY: Discovery = { token: -1, ids: null, failed: false };

/**
 * Discovers the models exposed by the endpoint.
 *
 * Discovery is best-effort: when it fails (no key, CORS, offline) the bundled
 * catalogue is used instead so the user can still pick a model and chat.
 * The connection status is derived, so a request in flight never needs a
 * synchronous state write.
 */
export function useModels({ apiKey, baseUrl }: UseModelsInput): UseModelsResult {
  const [discovery, setDiscovery] = useState<Discovery>(NO_DISCOVERY);
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    if (!apiKey) return;

    let cancelled = false;
    const controller = new AbortController();
    const token = reloadToken;

    createNimClient({ apiKey, baseUrl })
      .listModels({ signal: controller.signal })
      .then((ids) => {
        if (cancelled) return;
        setDiscovery({
          token,
          ids: ids.length > 0 ? ids : null,
          failed: ids.length === 0,
          detail:
            ids.length > 0
              ? `${ids.length} models available on ${baseUrl}`
              : 'The endpoint returned no models, so the bundled list is used.',
          checkedAt: Date.now(),
        });
      })
      .catch((error: unknown) => {
        if (cancelled || (error instanceof NimError && error.kind === 'aborted')) return;
        setDiscovery({ token, ids: null, failed: true, detail: describeError(error), checkedAt: Date.now() });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [apiKey, baseUrl, reloadToken]);

  const connection = useMemo<ConnectionState>(() => {
    if (!apiKey) return { status: 'missing-key', detail: 'No API key stored in this browser yet.' };
    if (discovery.token !== reloadToken) return { status: 'checking', detail: `Contacting ${baseUrl}` };
    if (!discovery.failed) {
      return { status: 'online', detail: discovery.detail, checkedAt: discovery.checkedAt };
    }
    return { status: 'unavailable', detail: discovery.detail, checkedAt: discovery.checkedAt };
  }, [apiKey, baseUrl, discovery, reloadToken]);

  const usingFallback = !apiKey || !discovery.ids || discovery.ids.length === 0;
  const models = useMemo(
    () => (usingFallback || !discovery.ids ? FALLBACK_MODELS : toModelInfos(discovery.ids)),
    [usingFallback, discovery.ids],
  );

  return { models, usingFallback, isLoading: connection.status === 'checking', connection, refresh };
}
