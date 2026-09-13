import { describe, expect, it, vi } from 'vitest';
import {
  buildChatRequestBody,
  NimClient,
  type ChatCompletionParams,
  type NimFetch,
} from '../../src/services/nim/client';
import { ERROR_HINTS, NimError, describeError, redact, toNimError } from '../../src/services/nim/errors';

const API_KEY = 'nvapi-SUPER-SECRET-KEY-1234567890';
const BASE_URL = 'https://integrate.api.nvidia.com/v1';

const params: ChatCompletionParams = {
  model: 'meta/llama-3.3-70b-instruct',
  messages: [
    { role: 'system', content: 'Be brief.' },
    { role: 'user', content: 'Hi' },
  ],
  temperature: 0.4,
  topP: 0.9,
  maxTokens: 256,
};

interface StubResponseInit {
  status?: number;
  headers?: Record<string, string>;
}

function headersOf(init: StubResponseInit) {
  const map = new Map(Object.entries(init.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]));
  return { get: (name: string) => map.get(name.toLowerCase()) ?? null };
}

/** Minimal `Response` stand-in — only what the client touches. */
function jsonResponse(payload: unknown, init: StubResponseInit = {}): Response {
  const status = init.status ?? 200;
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: headersOf(init),
    json: async () => (typeof payload === 'string' ? JSON.parse(payload) : payload),
    text: async () => body,
  } as unknown as Response;
}

function sseResponse(chunks: readonly string[], init: StubResponseInit = {}): Response {
  const encoder = new TextEncoder();
  let index = 0;
  const reader = {
    read: async () => {
      if (index >= chunks.length) return { done: true, value: undefined };
      const value = encoder.encode(chunks[index]);
      index += 1;
      return { done: false, value };
    },
    releaseLock: () => undefined,
  };
  const status = init.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: headersOf(init),
    body: { getReader: () => reader },
    text: async () => '',
  } as unknown as Response;
}

function createClient(
  fetchImpl: NimFetch,
  overrides: Partial<ConstructorParameters<typeof NimClient>[0]> = {},
) {
  return new NimClient({
    apiKey: API_KEY,
    baseUrl: BASE_URL,
    fetchImpl,
    timeoutMs: 5000,
    streamIdleTimeoutMs: 5000,
    ...overrides,
  });
}

const delta = (content: string) =>
  `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content } }] })}\n\n`;

describe('buildChatRequestBody', () => {
  it('uses the OpenAI-compatible snake_case field names', () => {
    expect(buildChatRequestBody(params, false)).toEqual({
      model: 'meta/llama-3.3-70b-instruct',
      messages: [
        { role: 'system', content: 'Be brief.' },
        { role: 'user', content: 'Hi' },
      ],
      temperature: 0.4,
      top_p: 0.9,
      max_tokens: 256,
      stream: false,
    });
  });

  it('requests usage for streamed requests and copies no extra message fields', () => {
    const body = buildChatRequestBody({ ...params, messages: [{ role: 'user', content: 'Hi' }] }, true);
    expect(body.stream).toBe(true);
    expect(body.stream_options).toEqual({ include_usage: true });
    expect(Object.keys(body.messages[0] ?? {})).toEqual(['role', 'content']);
  });

  it('omits stream_options for non-streamed requests', () => {
    expect(buildChatRequestBody(params, false).stream_options).toBeUndefined();
  });
});

describe('request construction', () => {
  it('sends a bearer token, JSON body and the right URL', async () => {
    const fetchImpl = vi.fn<NimFetch>(async () =>
      jsonResponse({ choices: [{ message: { content: 'ok' } }] }),
    );
    await createClient(fetchImpl).complete(params);

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(String((init as RequestInit).body))).toMatchObject({ model: params.model });
  });

  it('strips a trailing slash from the base URL instead of doubling it', async () => {
    const fetchImpl = vi.fn<NimFetch>(async () => jsonResponse({ data: [] }));
    await createClient(fetchImpl, { baseUrl: 'https://example.com/v1/' }).listModels();
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://example.com/v1/models');
  });

  it('supports a relative proxy base URL', async () => {
    const fetchImpl = vi.fn<NimFetch>(async () => jsonResponse({ data: [] }));
    await createClient(fetchImpl, { baseUrl: '/nim-api/v1' }).listModels();
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('/nim-api/v1/models');
  });

  it('refuses to send anything without a key', async () => {
    const fetchImpl = vi.fn<NimFetch>(async () => jsonResponse({}));
    await expect(createClient(fetchImpl, { apiKey: '   ' }).complete(params)).rejects.toMatchObject({
      kind: 'missing-key',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('error handling', () => {
  it.each([
    [401, 'unauthenticated'],
    [403, 'forbidden'],
    [404, 'not-found'],
    [429, 'rate-limited'],
    [400, 'bad-request'],
    [422, 'bad-request'],
    [500, 'server'],
    [503, 'server'],
  ])('maps HTTP %i to "%s"', async (status, kind) => {
    const fetchImpl = vi.fn<NimFetch>(async () => jsonResponse({ error: { message: 'nope' } }, { status }));
    await expect(createClient(fetchImpl).complete(params)).rejects.toMatchObject({ kind, status });
  });

  it('surfaces the server-provided message and request id', async () => {
    const fetchImpl = vi.fn<NimFetch>(async () =>
      jsonResponse(
        { error: { message: 'Model not enabled for this account' } },
        { status: 400, headers: { 'x-request-id': 'req-42' } },
      ),
    );

    await expect(createClient(fetchImpl).complete(params)).rejects.toMatchObject({
      kind: 'bad-request',
      message: 'Model not enabled for this account',
      requestId: 'req-42',
    });
  });

  it('reads Retry-After as seconds for rate limits', async () => {
    const fetchImpl = vi.fn<NimFetch>(async () =>
      jsonResponse({ error: { message: 'slow down' } }, { status: 429, headers: { 'retry-after': '30' } }),
    );
    await expect(createClient(fetchImpl).complete(params)).rejects.toMatchObject({
      kind: 'rate-limited',
      retryAfterMs: 30_000,
    });
  });

  it('copes with a non-JSON error body', async () => {
    const fetchImpl = vi.fn<NimFetch>(async () => jsonResponse('<html>Bad Gateway</html>', { status: 502 }));
    const error = await createClient(fetchImpl)
      .complete(params)
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(NimError);
    expect((error as NimError).message).toContain('Bad Gateway');
  });

  it('classifies a blocked or offline fetch as a network failure', async () => {
    const fetchImpl = vi.fn<NimFetch>(async () => {
      throw new TypeError('Failed to fetch');
    });
    const error = (await createClient(fetchImpl)
      .complete(params)
      .catch((caught: unknown) => caught)) as NimError;

    expect(error.kind).toBe('network');
    expect(describeError(error)).toContain('CORS');
  });

  it('reports an unparsable success body as a parse error', async () => {
    const fetchImpl = vi.fn<NimFetch>(
      async () =>
        ({
          ok: true,
          status: 200,
          headers: headersOf({}),
          json: async () => null,
          text: async () => '',
        }) as unknown as Response,
    );
    await expect(createClient(fetchImpl).complete(params)).rejects.toMatchObject({ kind: 'parse' });
  });

  it('treats an aborted request as user-initiated, not a failure', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn<NimFetch>(async () => {
      throw new DOMException('The operation was aborted.', 'AbortError');
    });

    await expect(
      createClient(fetchImpl).complete(params, { signal: controller.signal }),
    ).rejects.toMatchObject({ kind: 'aborted' });
  });

  it('raises a timeout when the request exceeds the deadline', async () => {
    const fetchImpl = vi.fn<NimFetch>((_url, init) => {
      const signal = (init as RequestInit).signal;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    });

    await expect(createClient(fetchImpl, { timeoutMs: 25 }).complete(params)).rejects.toMatchObject({
      kind: 'timeout',
    });
  });
});

describe('credential safety', () => {
  it('scrubs the API key out of error messages', async () => {
    const fetchImpl = vi.fn<NimFetch>(async () => {
      throw new Error(`Request failed for key ${API_KEY}`);
    });
    const error = (await createClient(fetchImpl)
      .complete(params)
      .catch((caught: unknown) => caught)) as NimError;

    expect(error.message).not.toContain(API_KEY);
    expect(error.message).toContain('[redacted]');
    expect(describeError(error, [API_KEY])).not.toContain(API_KEY);
  });

  it('redacts long secrets but leaves short strings alone', () => {
    expect(redact('key=abcdef123456', ['abcdef123456'])).toBe('key=[redacted]');
    expect(redact('nothing to see', ['abc'])).toBe('nothing to see');
  });

  it('maps unknown throwables into a NimError', () => {
    expect(toNimError('boom').kind).toBe('unknown');
    expect(toNimError('boom').message).toBe('boom');
    expect(toNimError(new Error('')).message).toBe(ERROR_HINTS.unknown);
  });
});

describe('complete()', () => {
  it('returns the message content, model, finish reason and usage', async () => {
    const fetchImpl = vi.fn<NimFetch>(async () =>
      jsonResponse({
        id: 'cmpl-1',
        model: 'meta/llama-3.3-70b-instruct',
        choices: [{ index: 0, message: { role: 'assistant', content: 'Hello!' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 },
      }),
    );

    await expect(createClient(fetchImpl).complete(params)).resolves.toEqual({
      content: 'Hello!',
      model: 'meta/llama-3.3-70b-instruct',
      finishReason: 'stop',
      usage: { promptTokens: 12, completionTokens: 4, totalTokens: 16 },
    });
  });

  it('tolerates an empty choices array', async () => {
    const fetchImpl = vi.fn<NimFetch>(async () => jsonResponse({ choices: [] }));
    await expect(createClient(fetchImpl).complete(params)).resolves.toMatchObject({ content: '' });
  });
});

describe('stream()', () => {
  it('aggregates deltas and reports the final text', async () => {
    const fetchImpl = vi.fn<NimFetch>(async () =>
      sseResponse([delta('Hel'), delta('lo'), 'data: [DONE]\n\n']),
    );
    const onDelta = vi.fn();

    const result = await createClient(fetchImpl).stream(params, { onDelta });

    expect(result.content).toBe('Hello');
    expect(onDelta.mock.calls.map(([chunk]) => chunk)).toEqual(['Hel', 'lo']);
  });

  it('reassembles events split across network chunks', async () => {
    const payload = delta('streamed');
    const fetchImpl = vi.fn<NimFetch>(async () =>
      sseResponse([payload.slice(0, 12), payload.slice(12), 'data: [DONE]\n\n']),
    );

    await expect(createClient(fetchImpl).stream(params)).resolves.toMatchObject({ content: 'streamed' });
  });

  it('captures usage and finish reason from the final chunk', async () => {
    const finalChunk = `data: ${JSON.stringify({
      model: 'meta/llama-3.3-70b-instruct',
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      usage: { prompt_tokens: 5, completion_tokens: 9, total_tokens: 14 },
    })}\n\n`;
    const fetchImpl = vi.fn<NimFetch>(async () => sseResponse([delta('hi'), finalChunk, 'data: [DONE]\n\n']));

    await expect(createClient(fetchImpl).stream(params)).resolves.toMatchObject({
      content: 'hi',
      finishReason: 'stop',
      usage: { promptTokens: 5, completionTokens: 9, totalTokens: 14 },
    });
  });

  it('skips malformed keep-alive chunks instead of failing the answer', async () => {
    const fetchImpl = vi.fn<NimFetch>(async () =>
      sseResponse([': keep-alive\n\n', 'data: {not json}\n\n', delta('ok'), 'data: [DONE]\n\n']),
    );
    await expect(createClient(fetchImpl).stream(params)).resolves.toMatchObject({ content: 'ok' });
  });

  it('sends an event-stream accept header', async () => {
    const fetchImpl = vi.fn<NimFetch>(async () => sseResponse(['data: [DONE]\n\n']));
    await createClient(fetchImpl).stream(params);
    expect((fetchImpl.mock.calls[0]?.[1] as RequestInit).headers).toMatchObject({
      Accept: 'text/event-stream',
    });
  });

  it('maps a streamed HTTP error the same way as a normal request', async () => {
    const fetchImpl = vi.fn<NimFetch>(async () =>
      jsonResponse({ error: { message: 'quota exhausted' } }, { status: 429 }),
    );
    await expect(createClient(fetchImpl).stream(params)).rejects.toMatchObject({ kind: 'rate-limited' });
  });

  it('flags a stream that goes quiet as a timeout', async () => {
    const fetchImpl = vi.fn<NimFetch>((_url, init) => {
      const reader = {
        read: () =>
          new Promise((_resolve, reject) => {
            (init as RequestInit).signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            );
          }),
        releaseLock: () => undefined,
      };
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: headersOf({}),
        body: { getReader: () => reader },
      } as unknown as Response);
    });

    await expect(createClient(fetchImpl, { streamIdleTimeoutMs: 25 }).stream(params)).rejects.toMatchObject({
      kind: 'timeout',
    });
  });
});

describe('listModels()', () => {
  it('returns chat-capable model ids', async () => {
    const fetchImpl = vi.fn<NimFetch>(async () =>
      jsonResponse({
        data: [
          { id: 'meta/llama-3.3-70b-instruct' },
          { id: 'deepseek-ai/deepseek-v4-pro' },
          { id: 'nvidia/nv-embedqa-e5-v5' },
        ],
      }),
    );

    await expect(createClient(fetchImpl).listModels()).resolves.toEqual([
      'deepseek-ai/deepseek-v4-pro',
      'meta/llama-3.3-70b-instruct',
    ]);
  });

  it('returns an empty list for an unexpected payload', async () => {
    const fetchImpl = vi.fn<NimFetch>(async () => jsonResponse({ unexpected: true }));
    await expect(createClient(fetchImpl).listModels()).resolves.toEqual([]);
  });

  it('propagates authentication failures', async () => {
    const fetchImpl = vi.fn<NimFetch>(async () =>
      jsonResponse({ error: { message: 'Invalid API key' } }, { status: 401 }),
    );
    await expect(createClient(fetchImpl).listModels()).rejects.toMatchObject({ kind: 'unauthenticated' });
  });
});
