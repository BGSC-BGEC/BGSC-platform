import { Request, Response, NextFunction } from 'express';

/**
 * Wraps an async handler so a rejected promise reaches the error middleware instead of hanging the
 * request. Shared because every service's controllers need it, and each one writing its own is how
 * two copies drift.
 *
 *   export const getMe = wrap(async (req, res) => { ... });
 */
export const wrap =
    (fn: (req: Request, res: Response) => Promise<unknown>) =>
    (req: Request, res: Response, next: NextFunction): void => {
        fn(req, res).catch(next);
    };
