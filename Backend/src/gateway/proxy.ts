import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { Request, Response } from 'express';
import { LIVE_SERVICES, ROUTES, startsWithSegment } from './routing';

/**
 * One proxy per downstream service. Paths are not rewritten: the gateway forwards the same prefix
 * the service already serves, so there is exactly one place a path can be wrong (routing.ts).
 */

/**
 * Headers a client must never be able to assert. Nothing downstream reads these today — every
 * service verifies the Authorization JWT itself, which is the safer arrangement because a service
 * is then correct whether or not it is behind the gateway.
 *
 * They are stripped rather than forwarded so that a service which later *does* trust a gateway
 * header cannot be spoofed by a client simply setting it.
 */
const CLIENT_FORBIDDEN_HEADERS = ['x-gateway-user', 'x-gateway-role'];

/**
 * Mounted with `app.use(handler)` and scoped by `pathFilter`, never `app.use(prefix, handler)`.
 * Express strips the mount path, so mounting on a prefix would forward `/me` instead of
 * `/users/me` and every downstream route would 404.
 */
export function createServiceProxy(key: string, target: string, prefixes: string[]) {
    const options: Options = {
        target,
        changeOrigin: true,
        // A predicate, not a glob: http-proxy-middleware 3.0.7 does not match glob pathFilters
        // (verified — '/users/**' never fires), and this shares the routing rule rather than
        // restating it in a second syntax.
        pathFilter: (path: string) => prefixes.some((prefix) => startsWithSegment(path, prefix)),
        // Streams the body straight through; the gateway never parses request bodies.
        proxyTimeout: 30_000,
        timeout: 30_000,
        on: {
            proxyReq: (proxyReq) => {
                for (const header of CLIENT_FORBIDDEN_HEADERS) proxyReq.removeHeader(header);
            },
            error: (err, _req, res) => {
                // A downstream being down is a 502, not a gateway crash.
                console.error(`[gateway] ${key} unreachable:`, err.message);
                const response = res as Response;
                if (!response.headersSent) {
                    response.status(502).json({ error: 'bad_gateway', service: key });
                }
            },
        },
    };
    return createProxyMiddleware(options);
}

/** A service that is planned but not yet written answers clearly instead of hanging. */
export function notImplemented(key: string) {
    return (_req: Request, res: Response) => {
        res.status(503).json({
            error: 'service_unavailable',
            service: key,
            detail: `${key}-service is not built yet (${ROUTES[key]?.owner ?? 'unassigned'})`,
        });
    };
}

export const isLive = (key: string) => LIVE_SERVICES.has(key);
