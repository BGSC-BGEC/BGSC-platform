import { Request, Response, NextFunction } from 'express';
import { roleRank } from '../models/shared';
import { UserRole } from '../models/User';

/**
 * Endpoint-level role checks (Spec §7.2). Ranks come from ROLE_RANK in models/shared.ts, the same
 * ladder the announcement audience gate uses — one ordering for the whole codebase.
 *
 * Must run after requireAuth: no `req.user` means 401, not 403. Answering 403 to an anonymous
 * caller tells them the endpoint exists and that they merely lack the rank.
 */

export const rankOf = roleRank;

/** `requireRole(UserRole.COORDINATOR)` = coordinator or above. */
export function requireRole(minimum: UserRole) {
    const floor = rankOf(minimum);
    if (floor < 0) throw new Error(`requireRole: unknown role '${minimum}'`);

    return function (req: Request, res: Response, next: NextFunction): void {
        if (!req.user) {
            res.status(401).json({ error: 'unauthorized' });
            return;
        }
        if (rankOf(req.user.role) < floor) {
            res.status(403).json({ error: 'forbidden' });
            return;
        }
        next();
    };
}
