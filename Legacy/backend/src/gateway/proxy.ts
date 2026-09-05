import type { RequestHandler } from 'express';
import { createProxyMiddleware, type Options } from 'http-proxy-middleware';

export interface ServiceProxyOptions {
  target: string;
  /** Only requests whose path matches are proxied (full path is preserved). */
  pathFilter: Options['pathFilter'];
  timeoutMs: number;
}

/**
 * Builds a reverse proxy to a downstream service. The incoming path is
 * preserved as-is (the services expose the same prefixes the gateway routes),
 * and `xfwd` forwards the client IP so downstream rate limiting / audit logging
 * still see the real origin.
 */
export function createServiceProxy({
  target,
  pathFilter,
  timeoutMs,
}: ServiceProxyOptions): RequestHandler {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    xfwd: true,
    pathFilter,
    proxyTimeout: timeoutMs,
    timeout: timeoutMs,
    on: {
      error: (_err, _req, res) => {
        const response = res as import('http').ServerResponse;
        if (!response.headersSent) {
          response.writeHead(502, { 'Content-Type': 'application/json' });
        }
        response.end(
          JSON.stringify({
            statusCode: 502,
            error: 'Bad Gateway',
            message: 'Upstream service is unavailable.',
          }),
        );
      },
    },
  });
}
