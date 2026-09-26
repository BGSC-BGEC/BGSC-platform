import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { assertInternalTokenConfigured, config, optionalAuth, requireRole, UserRole } from '@bgsc/shared';
import { ROUTES, isInternalPath } from './gateway/routing';
import { createServiceProxy, notImplemented, isLive } from './gateway/proxy';
import { authAttemptIpCeiling, authAttemptLimiter, generalLimiter, parseAttemptBody } from './gateway/rateLimit';

/**
 * API Gateway — :3000 (Spec §2.1). The single public entry point: JWT validation, rate limiting,
 * request routing, and nothing else. No business logic and no database: everything the gateway
 * knows about a request comes from the token or the path.
 *
 * bodyParser is deliberately absent — bodies stream straight to the downstream service. Parsing
 * here would break file uploads and force the gateway to know each service's payload shapes. The
 * one exception is the strict auth paths (rateLimit.ts `parseAttemptBody`), whose limiter keys on
 * the account being attempted.
 */

const NAME = 'gateway';
const PORT = parseInt(process.env.GATEWAY_PORT || String(config.gatewayPort), 10);

export const app = express();

app.disable('x-powered-by');
/**
 * `trust proxy` is deliberately NOT set: compose publishes :3000 straight to the client, so
 * `req.ip` is the real peer and the rate limiters bucket per client correctly.
 *
 * **If the gateway is ever put behind nginx, an ALB or Cloudflare, this must change**, or `req.ip`
 * becomes the proxy's address for everyone: the general limiter collapses into a single shared
 * bucket, and `authAttemptLimiter` (5 per 15 min) locks out every user in the world after five
 * failed logins by any one of them. Setting it blindly is the opposite failure — an untrusted
 * `X-Forwarded-For` is client-controlled, so a caller spoofs their way past both limiters. Set it
 * to the exact number of proxy hops in front of this process, nothing else.
 *
 * The domain services behind it DO set `trust proxy: 1`, because they always have exactly one hop
 * in front of them: this gateway.
 */
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
});

/**
 * The gateway's own liveness. Deliberately not an aggregate of the downstreams: this answers
 * "can the gateway route?", and a fleet-wide roll-up would make one dead service look like a
 * dead edge. `/gateway/services` reports the downstreams.
 */
app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: NAME, env: config.nodeEnv, uptime_s: Math.round(process.uptime()) });
});

/**
 * `/internal/*` is service-to-service only. Services guard it with a shared token as well; this is
 * the outer layer, because the cost of one service forgetting is an unauthenticated user directory.
 */
app.use((req: Request, res: Response, next: NextFunction) => {
    if (isInternalPath(req.path)) {
        res.status(404).json({ error: 'not_found' });
        return;
    }
    next();
});

// Verify the token at the edge if one is present, but never reject here: which routes require auth
// is the service's business, and the service re-checks anyway. This only populates req.user so the
// rate limiter can key on it and the proxy can forward identity.
app.use(optionalAuth);
app.use(parseAttemptBody);
app.use(authAttemptIpCeiling);
app.use(authAttemptLimiter);
app.use(generalLimiter);

// The routing table with its internal targets (`http://auth-service:3001`, …) is operator
// information, not something to hand an anonymous caller mapping the network (audit Sep 26).
app.get('/gateway/services', requireRole(UserRole.COORDINATOR), (_req: Request, res: Response) => {
    res.json({
        services: Object.entries(ROUTES).map(([key, r]) => ({
            key, target: r.target, prefixes: r.prefixes, owner: r.owner, live: isLive(key),
        })),
    });
});

// Live services are mounted globally and scoped by pathFilter so the full path survives.
// Unbuilt services mount on their prefixes, where Express stripping the prefix is harmless.
for (const [key, route] of Object.entries(ROUTES)) {
    if (isLive(key)) {
        app.use(createServiceProxy(key, route.target, route.prefixes));
    } else {
        for (const prefix of route.prefixes) app.use(prefix, notImplemented(key));
    }
}

app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'not_found' });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    // A malformed or oversized body on a strict auth path (the only bodies parsed here) is the
    // client's fault, same mapping as the services' error handler.
    const parseErr = err as Error & { status?: number; expose?: boolean; type?: string };
    if (parseErr.expose === true && typeof parseErr.status === 'number' && parseErr.status < 500) {
        if (!res.headersSent) {
            res.status(parseErr.status).json({
                error: parseErr.type === 'entity.too.large' ? 'payload_too_large' : 'malformed_body',
            });
        }
        return;
    }
    console.error(`[${NAME}] Unhandled error:`, err);
    if (!res.headersSent) res.status(500).json({ error: 'internal_error' });
});

export function start(): void {
    // The gateway verifies tokens too (rate-limit keys, /gateway/services), so a published JWT
    // secret here is as bad as anywhere. No database or bus, so those checks are skipped.
    assertInternalTokenConfigured({ datastores: false });
    process.on('unhandledRejection', (reason) => {
        console.error(`[${NAME}] UNHANDLED REJECTION:`, reason);
    });
    process.on('uncaughtException', (err) => {
        console.error(`[${NAME}] UNCAUGHT EXCEPTION, exiting:`, err);
        process.exit(1);
    });

    const server = app.listen(PORT, () => {
        const live = Object.keys(ROUTES).filter(isLive);
        console.log(`[${NAME}] listening on :${PORT} (${config.nodeEnv})`);
        console.log(`[${NAME}] live: ${live.join(', ')} | pending: ${Object.keys(ROUTES).filter((k) => !isLive(k)).join(', ')}`);
    });
    // Every proxy instance listens on the server; fifteen of them trip Node's default cap of 10 and
    // print MaxListenersExceededWarning on every boot (audit #2). Not a leak: the count is fixed.
    server.setMaxListeners(Object.keys(ROUTES).length + 10);

    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
        process.on(signal, () => {
            console.log(`[${NAME}] ${signal} received, shutting down.`);
            server.close(() => process.exit(0));
        });
    }
}

if (require.main === module) start();
