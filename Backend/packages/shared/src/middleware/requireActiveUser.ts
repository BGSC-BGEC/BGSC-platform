import { NextFunction, Request, Response } from 'express';
import { IUser, User, UserRole, UserStatus } from '../models/User';
import { RoleName, ROLE_RANK } from '../models/shared';

/**
 * Rank the **live user document**, not the token's role claim.
 *
 * An access token is valid for fifteen minutes. Inside that window a demotion, a suspension or an
 * account deletion has happened in the database and changed nothing about what the bearer can do —
 * so every write whose authority comes from a role has to re-read the user rather than trust the
 * claim it was handed. `requireRole` (the token version) stays right for reads, where a stale
 * answer is not a damage path.
 *
 * This lived in five services as five copies and had already drifted into three implementations:
 * one checked `deleted_at` and two did not, one guarded against a missing `req.user` and two would
 * have thrown, and they disagreed about where to park the loaded actor. An authorization guard is
 * the last thing that should exist five times, so it exists here once, and it sets every field its
 * former copies set:
 *
 *  - `res.locals.user`  — the loaded document (announcement, challenge, points read this)
 *  - `res.locals.actor` — `{ id, ip, role }` (the same three, for audit rows)
 *  - `req.actor`        — the loaded document (bracket, feedback read this)
 *
 * Consolidated by the whole-backend audit, Sep 27, 2026.
 */

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            /** The live user document, loaded by `requireActiveUser`. */
            actor?: IUser;
        }
    }
}

const rankOf = (role: string): number => ROLE_RANK.indexOf(role as RoleName);

type Middleware = (req: Request, res: Response, next: NextFunction) => Promise<void>;

/**
 * `requireActiveUser(UserRole.CORE)` builds the guard. Mounting the factory itself —
 * `router.post('/', requireAuth, requireActiveUser, …)` — used to call it with `req` as the floor,
 * throw "unknown role '[object Object]'" and 500 every request (hall-of-fame routes, audit Sep 26).
 * A factory mounted bare now behaves as the documented default, `requireActiveUser()`.
 */
export function requireActiveUser(floor?: UserRole | RoleName): Middleware;
export function requireActiveUser(req: Request, res: Response, next: NextFunction): Promise<void>;
export function requireActiveUser(
    floorOrReq: UserRole | RoleName | Request = UserRole.GUEST,
    res?: Response,
    next?: NextFunction
): Middleware | Promise<void> {
    if (typeof floorOrReq === 'object' && res && next) return guard(UserRole.GUEST)(floorOrReq, res, next);
    return guard(floorOrReq as UserRole | RoleName);
}

function guard(floor: UserRole | RoleName): Middleware {
    const min = rankOf(floor);
    // A typo in a route's floor should fail at boot, not silently admit everybody.
    if (min < 0) throw new Error(`requireActiveUser: unknown role '${floor}'`);

    return async function (req: Request, res: Response, next: NextFunction): Promise<void> {
        // Mounted after `requireAuth` everywhere, but a guard that throws when it is not is a 500
        // where a 401 belongs.
        if (!req.user) {
            res.status(401).json({ error: 'unauthorized' });
            return;
        }

        try {
            const user = await User.findById(req.user.id).select(
                '_id status role username email deleted_at profile.full_name profile.avatar_url'
            );

            // Suspended, deleted, or gone entirely: 401, not 403. The session is no longer a
            // session — saying "forbidden" would imply a different account could do it.
            if (!user || user.status !== UserStatus.ACTIVE || user.deleted_at) {
                res.status(401).json({ error: 'unauthorized' });
                return;
            }

            if (rankOf(user.role) < min) {
                res.status(403).json({ error: 'forbidden' });
                return;
            }

            res.locals.user = user;
            res.locals.actor = { id: user._id, ip: req.ip ?? null, role: user.role };
            req.actor = user;
            next();
        } catch (err) {
            next(err);
        }
    };
}
