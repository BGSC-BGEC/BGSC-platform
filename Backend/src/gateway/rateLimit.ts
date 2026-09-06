import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { isAuthAttempt } from './routing';

/**
 * Rate limiting at the edge (Spec §11.1). Doing it here rather than per service means a new
 * service is protected the day it is written, and one limiter sees all of a client's traffic.
 *
 * ponytail: the default in-memory store, so limits are per gateway instance. Fine at one instance;
 * behind a load balancer, swap in the Redis store — the limiter config does not otherwise change.
 */

/** 5 attempts per 15 minutes per IP on anything brute-forceable. */
export const authAttemptLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'too_many_requests' },
    // Only the attempt endpoints; /auth/me and friends stay on the general bucket.
    skip: (req) => !isAuthAttempt(req.path),
});

/** 100 requests per minute per user, falling back to IP for anonymous callers. */
export const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'too_many_requests' },
    // Signed-in callers are limited per user; anonymous ones per IP. ipKeyGenerator normalises
    // IPv6 to a /64 subnet — using req.ip raw lets one IPv6 client rotate addresses past the limit.
    keyGenerator: (req, res) => req.user?.id ?? ipKeyGenerator(req.ip ?? '', 64) ?? 'unknown',
    // Health checks must never be throttled — a rate-limited probe reads as an outage.
    skip: (req) => req.path === '/health' || req.path === '/gateway/health',
});
