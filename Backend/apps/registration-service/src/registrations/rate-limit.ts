import { ServiceError } from '@bgsc/shared';
import { NextFunction, Request, Response } from 'express';

/**
 * Per-user sliding window. A submit or edit runs the form's admin patterns, and a 422 costs the
 * caller nothing — so without a limit one user could spend the regex budget as fast as they can
 * send requests.
 *
 * ponytail: in-process memory, so the limit is per instance (N instances allow N× the rate).
 * Move to Redis when the service runs more than a couple of replicas.
 */
export function perUserRateLimit(max: number, windowMs: number) {
    const hits = new Map<string, number[]>();

    return (req: Request, _res: Response, next: NextFunction): void => {
        const id = req.user?.id;
        if (!id) return next();
        const now = Date.now();
        const recent = (hits.get(id) ?? []).filter((t) => now - t < windowMs);
        if (recent.length >= max) return next(new ServiceError(429, 'rate_limited'));
        recent.push(now);
        hits.set(id, recent);

        // Bound the map: drop users whose window has fully passed.
        if (hits.size > 10_000) {
            for (const [key, times] of hits) if (now - times[times.length - 1] >= windowMs) hits.delete(key);
        }
        next();
    };
}
