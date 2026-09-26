import express, { Request, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { isAuthAttempt, isCredentialAttempt, normalizePath } from './routing';

/**
 * Rate limiting at the edge (Spec §11.1). Doing it here rather than per service means a new
 * service is protected the day it is written, and one limiter sees all of a client's traffic.
 *
 * ponytail: the default in-memory store, so limits are per gateway instance. Fine at one instance;
 * behind a load balancer, swap in the Redis store — the limiter config does not otherwise change.
 */

const ipKey = (req: Request) => ipKeyGenerator(req.ip ?? '', 56);

/**
 * The body field each strict path actually reads to pick an account. Keying every path on
 * `body.login ?? body.email` let a junk `login` field on an email route rotate the per-account
 * bucket at will (audit #2). Token paths (verify-email, reset-password) have no account to key on —
 * a fresh guess is a fresh token — so they fall to the IP alone; the phone OTP routes are the
 * signed-in caller.
 */
const IDENTITY_FIELD: Record<string, 'login' | 'email' | 'user'> = {
    '/auth/login': 'login',
    '/account/reactivate': 'login',
    '/auth/register': 'email',
    '/auth/resend-verification': 'email',
    '/auth/forgot-password': 'email',
    '/auth/phone/send-otp': 'user',
    '/auth/phone/verify-otp': 'user',
};

/** Who an attempt is aimed at, or null when the path has no account (then the bucket is the IP). */
export function attemptIdentity(req: Request): string | null {
    const field = IDENTITY_FIELD[normalizePath(req.path)];
    if (field === 'user') return req.user?.id ?? null;
    if (!field) return null;
    const value = ((req.body ?? {}) as Record<string, unknown>)[field];
    return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;
}

/**
 * A credential success (a real login) is not an attempt worth counting; everything a SEND path
 * answers is, because those answer 200 whether or not anything was sent (anti-enumeration).
 */
const wasSuccessful = (req: Request, res: Response) => isCredentialAttempt(req.path) && res.statusCode < 400;

/**
 * The strict paths need the body to know which account is being attempted, and the gateway
 * otherwise never parses bodies. Parsed here for those paths only — they are small JSON — and
 * re-streamed to the service by `fixRequestBody` in the proxy.
 */
export const parseAttemptBody = (() => {
    const json = express.json({ limit: '16kb' });
    return (req: Request, res: Response, next: (err?: unknown) => void) =>
        isAuthAttempt(req.path) ? json(req, res, next) : next();
})();

/**
 * 5 attempts per 15 minutes per (IP, target account) on anything brute-forceable. Keyed on the
 * account as well as the IP so one attacker behind a campus NAT cannot lock every other student out;
 * successful logins do not count (see `wasSuccessful`).
 */
export const authAttemptLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'too_many_requests' },
    skip: (req) => !isAuthAttempt(req.path),
    keyGenerator: (req) => `${ipKey(req)}|${attemptIdentity(req) ?? '-'}`,
    skipSuccessfulRequests: true,
    requestWasSuccessful: wasSuccessful,
});

/**
 * The per-IP ceiling under the per-account bucket. Without it, keying on the account would let one
 * IP spray five guesses at every account on the platform.
 *
 * It counts failures of logins and signups only: counting successful signups (register answers 201)
 * meant a campus NAT onboarding thirty students in fifteen minutes hit 429 (audit #2). The mail/OTP
 * send paths count EVERY call — they answer 200 whatever happens (no account enumeration), so a
 * failures-only rule would never count them and one IP could spray reset mail at every address.
 */
export const ceilingSkips = (req: Request, res: Response) =>
    res.statusCode < 400 && (isCredentialAttempt(req.path) || normalizePath(req.path) === '/auth/register');

export const authAttemptIpCeiling = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: false,
    legacyHeaders: false,
    message: { error: 'too_many_requests' },
    skip: (req) => !isAuthAttempt(req.path),
    keyGenerator: ipKey,
    skipSuccessfulRequests: true,
    requestWasSuccessful: ceilingSkips,
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
    keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip ?? '', 64) ?? 'unknown',
    // Health checks must never be throttled — a rate-limited probe reads as an outage.
    skip: (req) => req.path === '/health',
});
