// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createProxyServer } from '../../proxy/server.mjs';

const API_KEY = 'nvapi-proxy-test-key-abcdef123456';

let upstream: http.Server;
let proxy: http.Server;
let proxyUrl: string;
let upstreamUrl: string;
const logs: string[] = [];

/** Records what NVIDIA would have seen, so pass-through can be asserted. */
let receivedAuth: string | undefined;
let receivedBody: string | undefined;
let receivedPath: string | undefined;

function listen(server: http.Server): Promise<string> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

beforeAll(async () => {
  upstream = http.createServer((req, res) => {
    receivedAuth = req.headers.authorization;
    receivedPath = req.url;

    if (req.url === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: [{ id: 'meta/llama-3.3-70b-instruct' }] }));
      return;
    }

    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      receivedBody = Buffer.concat(chunks).toString('utf8');
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write('data: {"choices":[{"delta":{"content":"He"}}]}\n\n');
      res.write('data: {"choices":[{"delta":{"content":"llo"}}]}\n\n');
      res.write('data: [DONE]\n\n');
      res.end();
    });
  });

  upstreamUrl = await listen(upstream);
  proxy = createProxyServer({
    upstream: upstreamUrl,
    allowOrigin: 'https://ehub22.github.io',
    logger: (line: string) => logs.push(line),
  });
  proxyUrl = await listen(proxy);
});

afterAll(async () => {
  await new Promise((resolve) => proxy.close(resolve));
  await new Promise((resolve) => upstream.close(resolve));
});

describe('NIM CORS proxy', () => {
  it('answers preflight requests with CORS headers', async () => {
    const response = await fetch(`${proxyUrl}/v1/chat/completions`, { method: 'OPTIONS' });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://ehub22.github.io');
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
    expect(response.headers.get('access-control-allow-headers')).toContain('Authorization');
  });

  it('forwards GET requests and returns CORS headers on the response', async () => {
    const response = await fetch(`${proxyUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://ehub22.github.io');
    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(response.json()).resolves.toEqual({ data: [{ id: 'meta/llama-3.3-70b-instruct' }] });
    expect(receivedPath).toBe('/v1/models');
  });

  it('passes the API key through untouched and streams the body back', async () => {
    const response = await fetch(`${proxyUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'meta/llama-3.3-70b-instruct', stream: true }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(receivedAuth).toBe(`Bearer ${API_KEY}`);
    expect(JSON.parse(receivedBody ?? '{}')).toMatchObject({
      model: 'meta/llama-3.3-70b-instruct',
      stream: true,
    });

    const text = await response.text();
    expect(text).toContain('"content":"He"');
    expect(text).toContain('"content":"llo"');
    expect(text).toContain('[DONE]');
  });

  it('exposes a health endpoint', async () => {
    const response = await fetch(`${proxyUrl}/health`);
    await expect(response.json()).resolves.toEqual({ status: 'ok', upstream: upstreamUrl });
  });

  it('rejects methods a client has no use for', async () => {
    const response = await fetch(`${proxyUrl}/v1/models`, { method: 'DELETE' });
    expect(response.status).toBe(405);
  });

  it('never writes the API key to its log output', () => {
    expect(logs.length).toBeGreaterThan(0);
    for (const line of logs) {
      expect(line).not.toContain(API_KEY);
      expect(line).not.toContain('nvapi-');
    }
  });
});

describe('NIM CORS proxy upstream failure', () => {
  it('returns a JSON 502 when the endpoint cannot be reached', async () => {
    const orphan = createProxyServer({
      upstream: 'http://127.0.0.1:1',
      logger: () => undefined,
    });
    const url = await listen(orphan);

    try {
      const response = await fetch(`${url}/v1/models`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
      });
      expect(response.status).toBe(502);
      const payload = (await response.json()) as { error: { type: string; message: string } };
      expect(payload.error.type).toBe('upstream_error');
      expect(payload.error.message).not.toContain(API_KEY);
    } finally {
      await new Promise((resolve) => orphan.close(resolve));
    }
  });
});
