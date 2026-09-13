/**
 * Minimal CORS proxy for NVIDIA NIM.
 *
 * Why this exists: NVIDIA's hosted endpoint (https://integrate.api.nvidia.com)
 * does not return `Access-Control-Allow-Origin` headers, so a static site
 * deployed to GitHub Pages cannot call it directly from the browser. This
 * server forwards the request from a server-side context, where CORS does not
 * apply, and streams the response straight back to the client.
 *
 * It has zero dependencies and never reads or stores the `Authorization`
 * header — the user's NVIDIA NIM API key is passed through untouched.
 *
 * Usage:
 *   node proxy/server.mjs
 *
 * Configuration (all optional):
 *   PORT        port to listen on                    (default 8787)
 *   HOST        bind address                         (default 127.0.0.1)
 *   NIM_UPSTREAM  origin to forward to               (default https://integrate.api.nvidia.com)
 *   ALLOWED_ORIGIN  value of Access-Control-Allow-Origin (default *, set an exact origin in production)
 */
import { createServer } from 'node:http';
import http from 'node:http';
import https from 'node:https';

const DEFAULT_UPSTREAM = 'https://integrate.api.nvidia.com';

/** Headers a browser may send us. Anything else is dropped. */
const ALLOWED_REQUEST_HEADERS = ['authorization', 'content-type', 'accept'];

/** Headers copied back from NVIDIA, minus the ones that must be recomputed. */
const FORWARDED_RESPONSE_HEADERS = [
  'content-type',
  'cache-control',
  'x-request-id',
  'retry-after',
  'x-ratelimit-limit',
  'x-ratelimit-remaining',
  'x-ratelimit-reset',
];

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
]);

/**
 * @param {object} [options]
 * @param {string} [options.upstream]
 * @param {string} [options.allowOrigin]
 * @param {(line: string) => void} [options.logger]
 * @returns {import('node:http').Server}
 */
export function createProxyServer(options = {}) {
  const upstream = new URL(options.upstream ?? process.env.NIM_UPSTREAM ?? DEFAULT_UPSTREAM);
  const allowOrigin = options.allowOrigin ?? process.env.ALLOWED_ORIGIN ?? '*';
  const log = options.logger ?? ((line) => process.stdout.write(`${line}\n`));

  /**
   * @param {import('node:http').ServerResponse} res
   */
  function applyCors(res) {
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');
    res.setHeader('Access-Control-Max-Age', '600');
  }

  return createServer((req, res) => {
    applyCors(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }

    const path = req.url ?? '/';

    if (path === '/health') {
      const body = JSON.stringify({ status: 'ok', upstream: upstream.origin });
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(body);
      return;
    }

    if (req.method !== 'GET' && req.method !== 'POST') {
      res
        .writeHead(405, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: { message: 'Method not allowed', type: 'invalid_request_error' } }));
      return;
    }

    const target = new URL(path, upstream);
    const transport = target.protocol === 'http:' ? http : https;

    /** @type {Record<string, string | string[]>} */
    const headers = {};
    for (const name of ALLOWED_REQUEST_HEADERS) {
      const value = req.headers[name];
      if (typeof value === 'string') headers[name] = value;
      else if (Array.isArray(value) && value.length > 0) headers[name] = value[0];
    }
    // Ask upstream for identity encoding so we can pipe the stream untouched.
    headers.accept ??= req.method === 'GET' ? 'application/json' : 'text/event-stream';

    const upstreamRequest = transport.request(target, { method: req.method, headers }, (upstreamResponse) => {
      for (const name of FORWARDED_RESPONSE_HEADERS) {
        const value = upstreamResponse.headers[name];
        if (value !== undefined && !HOP_BY_HOP.has(name)) res.setHeader(name, value);
      }
      res.writeHead(upstreamResponse.statusCode ?? 502);
      upstreamResponse.pipe(res);
    });

    upstreamRequest.on('error', (error) => {
      // The message never contains the API key, but keep it generic anyway.
      log(`proxy: upstream error ${req.method ?? 'GET'} ${path} ${error.code ?? error.message}`);
      if (res.headersSent) {
        res.destroy();
        return;
      }
      res.writeHead(502, { 'Content-Type': 'application/json' }).end(
        JSON.stringify({
          error: {
            message: 'The NVIDIA NIM endpoint could not be reached from the proxy.',
            type: 'upstream_error',
            code: error.code ?? 'ECONNREFUSED',
          },
        }),
      );
    });

    // Client went away (e.g. the user pressed Stop) — stop burning tokens.
    res.on('close', () => {
      if (!upstreamRequest.destroyed) upstreamRequest.destroy();
    });

    req.pipe(upstreamRequest);
    log(`proxy: ${req.method ?? 'GET'} ${path}`);
  });
}

const invokedDirectly =
  typeof process.argv[1] === 'string' && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (invokedDirectly) {
  const port = Number(process.env.PORT ?? 8787);
  const host = process.env.HOST ?? '127.0.0.1';
  const server = createProxyServer();
  server.listen(port, host, () => {
    process.stdout.write(
      `NIM CORS proxy listening on http://${host}:${port} -> ${
        process.env.NIM_UPSTREAM ?? DEFAULT_UPSTREAM
      }\n`,
    );
  });
}
