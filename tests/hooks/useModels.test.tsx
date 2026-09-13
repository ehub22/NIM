import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useModels } from '../../src/hooks/useModels';
import { FALLBACK_MODELS } from '../../src/services/nim/catalog';
import { createNimClient, NimError } from '../../src/services/nim';

// Keep every real export (FALLBACK_MODELS, NimError, …) and swap only the
// factory that performs network I/O.
vi.mock('../../src/services/nim', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, createNimClient: vi.fn() };
});

const createClient = vi.mocked(createNimClient);

/** Stubs a client whose listModels resolves or rejects as instructed. */
function stubClient(result: Promise<string[]> | string[]) {
  createClient.mockReturnValue({
    listModels: () => (result instanceof Promise ? result : Promise.resolve(result)),
  } as unknown as ReturnType<typeof createNimClient>);
}

beforeEach(() => {
  createClient.mockReset();
});

describe('useModels', () => {
  it('reports a missing key and offers the bundled catalogue', () => {
    const { result } = renderHook(() => useModels({ apiKey: '', baseUrl: '/nim-api/v1' }));

    expect(result.current.connection.status).toBe('missing-key');
    expect(result.current.usingFallback).toBe(true);
    expect(result.current.models).toEqual(FALLBACK_MODELS);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('uses the discovered models when the endpoint responds', async () => {
    stubClient(['meta/llama-3.3-70b-instruct', 'deepseek-ai/deepseek-v4-pro']);
    const { result } = renderHook(() =>
      useModels({ apiKey: 'nvapi-test', baseUrl: 'https://integrate.api.nvidia.com/v1' }),
    );

    await waitFor(() => expect(result.current.connection.status).toBe('online'));

    expect(result.current.usingFallback).toBe(false);
    expect(result.current.models.map((model) => model.id)).toEqual([
      'meta/llama-3.3-70b-instruct',
      'deepseek-ai/deepseek-v4-pro',
    ]);
    // Known ids keep their curated metadata, marked as coming from the API.
    expect(result.current.models[0]).toMatchObject({ name: 'Llama 3.3 70B Instruct', source: 'api' });
  });

  it('labels unknown ids with a derived name and provider', async () => {
    stubClient(['acme/brand-new-7b']);
    const { result } = renderHook(() => useModels({ apiKey: 'nvapi-test', baseUrl: '/v1' }));

    await waitFor(() => expect(result.current.connection.status).toBe('online'));
    expect(result.current.models[0]).toMatchObject({
      id: 'acme/brand-new-7b',
      name: 'Brand New 7b',
      provider: 'Acme',
    });
  });

  it('stays usable when discovery fails, e.g. blocked by CORS', async () => {
    stubClient(Promise.reject(new NimError('network', 'Failed to fetch')));
    const { result } = renderHook(() => useModels({ apiKey: 'nvapi-test', baseUrl: '/v1' }));

    await waitFor(() => expect(result.current.connection.status).toBe('unavailable'));

    // The point of the fallback: the user can still pick a model and send.
    expect(result.current.usingFallback).toBe(true);
    expect(result.current.models).toEqual(FALLBACK_MODELS);
    expect(result.current.models.length).toBeGreaterThan(0);
    expect(result.current.connection.detail).toBeTruthy();
  });

  it('stays usable when the endpoint rejects the key', async () => {
    stubClient(Promise.reject(new NimError('unauthenticated', 'Invalid API key')));
    const { result } = renderHook(() => useModels({ apiKey: 'nvapi-bad', baseUrl: '/v1' }));

    await waitFor(() => expect(result.current.connection.status).toBe('unavailable'));
    expect(result.current.models).toEqual(FALLBACK_MODELS);
  });

  it('falls back when the endpoint returns no usable models', async () => {
    stubClient([]);
    const { result } = renderHook(() => useModels({ apiKey: 'nvapi-test', baseUrl: '/v1' }));

    await waitFor(() => expect(result.current.connection.status).toBe('unavailable'));
    expect(result.current.usingFallback).toBe(true);
    expect(result.current.models).toEqual(FALLBACK_MODELS);
  });

  it('shows a checking state while the request is in flight', () => {
    let release!: (value: string[]) => void;
    stubClient(new Promise<string[]>((resolve) => (release = resolve)));

    const { result } = renderHook(() => useModels({ apiKey: 'nvapi-test', baseUrl: '/v1' }));

    expect(result.current.connection.status).toBe('checking');
    expect(result.current.isLoading).toBe(true);
    // Still usable mid-flight.
    expect(result.current.models).toEqual(FALLBACK_MODELS);

    release(['meta/llama-3.3-70b-instruct']);
  });

  it('re-checks when refresh is called', async () => {
    stubClient(['meta/llama-3.3-70b-instruct']);
    const { result } = renderHook(() => useModels({ apiKey: 'nvapi-test', baseUrl: '/v1' }));

    await waitFor(() => expect(result.current.connection.status).toBe('online'));
    expect(createClient).toHaveBeenCalledTimes(1);

    result.current.refresh();

    // A new request invalidates the previous result until it resolves.
    await waitFor(() => expect(createClient).toHaveBeenCalledTimes(2));
  });

  it('does not call the endpoint when the key is removed', async () => {
    stubClient(['meta/llama-3.3-70b-instruct']);
    const { result, rerender } = renderHook(
      ({ apiKey }: { apiKey: string }) => useModels({ apiKey, baseUrl: '/v1' }),
      { initialProps: { apiKey: 'nvapi-test' } },
    );

    await waitFor(() => expect(result.current.connection.status).toBe('online'));

    rerender({ apiKey: '' });

    await waitFor(() => expect(result.current.connection.status).toBe('missing-key'));
    expect(result.current.usingFallback).toBe(true);
  });
});
