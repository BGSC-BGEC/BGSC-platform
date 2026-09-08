import { Request, Response, NextFunction } from 'express';

/**
 * Standard business error. When thrown, Express global error handler
 * in index.ts automatically formats it as HTTP status with { error: code }.
 */ 
export class ServiceError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
    Object.setPrototypeOf(this, ServiceError.prototype);
  }
}

/**
 * Wraps an async Express handler to catch rejected promises and
 * route them directly to the global error middleware without try/catch boilerplate.
 */
export const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };

export const ACCOUNT_DELETION_GRACE_DAYS = 45;
