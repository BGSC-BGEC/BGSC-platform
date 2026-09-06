import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config, optionalAuth } from '@bgsc/shared';
import { ROUTES, resolveService, isInternalPath } from './gateway/routing';
import { createServiceProxy, notImplemented, isLive } from './gateway/proxy';
import { authAttemptLimiter, generalLimiter } from './gateway/rateLimit';

/**
 * API Gateway — :3000 (Spec §2.1). The single public entry point: JWT validation, rate limiting,
 * request routing, and nothing else. No business logic and no database: everything the gateway
 * knows about a request comes from the token or the path.
 *
 * bodyParser is deliberately absent — bodies stream straight to the downstream service. Parsing
 * here would break file uploads and force the gateway to know each service's payload shapes.
 */

const NAME = 'gateway';
const PORT = parseInt(process.env.GATEWAY_PORT || String(config.gatewayPort), 10);

export const app = express();

app.disable('x-powered-by');
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

app.get('/gateway/services', (_req: Request, res: Response) => {
    res.json({
        services: Object.entries(ROUTES).map(([key, r]) => ({
            key, target: r.target, prefixes: r.prefixes, owner: r.owner, live: isLive(key),
        })),
    });
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
app.use(authAttemptLimiter);
app.use(generalLimiter);

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
    console.error(`[${NAME}] Unhandled error:`, err);
    if (!res.headersSent) res.status(500).json({ error: 'internal_error' });
});

export function start(): void {
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

    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
        process.on(signal, () => {
            console.log(`[${NAME}] ${signal} received, shutting down.`);
            server.close(() => process.exit(0));
        });
    }
}

if (require.main === module) start();
