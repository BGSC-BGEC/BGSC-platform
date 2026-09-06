/**
 * @bgsc/shared — everything more than one service needs.
 *
 * Deliberately narrow: models (each collection still has exactly one writing service, see
 * docs/modeldocs/relationships.md §1), the auth/validation middleware every service mounts, the
 * event bus, and config. Business logic belongs to its owning service, never here.
 */
export * from './config/env';
export * from './config/db';
export * from './models';
export * from './middleware/requireAuth';
export * from './middleware/requireRole';
export * from './middleware/requireServiceToken';
export * from './middleware/validate';
export * from './events/publish';
export * from './errors';
export * from './service';
