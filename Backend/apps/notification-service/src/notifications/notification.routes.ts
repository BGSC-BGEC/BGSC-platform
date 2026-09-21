import { requireAuth, validate } from '@bgsc/shared';
import { Router } from 'express';
import * as c from './notification.controller';
import { IdParams, ListNotificationsQuery, UpdatePreferencesSchema } from './notification.schemas';

/**
 * Mounted at `/notifications` — the prefix the gateway forwards unchanged (routing.ts).
 *
 * One auth floor for the whole router, the way `points.routes.ts` does it: an inbox has no guest
 * view, and a per-route `requireAuth` is seven chances to forget one.
 *
 * No `requireActiveUser` anywhere. That guard exists for writes whose *authority* comes from a role
 * claim that may be up to 15 minutes stale; every write here targets the caller's own inbox, where
 * the only authority needed is being that caller.
 *
 * ORDER MATTERS. `/preferences`, `/unread-count` and `/read-all` are the same shape as `/:id` to
 * Express, which matches in declaration order — declared after it, they resolve as lookups for
 * notifications with those ids.
 */
export const notificationRoutes = Router();

notificationRoutes.use(requireAuth);

// ---- literal paths, before /:id -------------------------------------------
notificationRoutes.get('/unread-count', c.getUnreadCount);
notificationRoutes.get('/preferences', c.getPreferences);
notificationRoutes.patch('/preferences', validate({ body: UpdatePreferencesSchema }), c.updatePreferences);
notificationRoutes.post('/read-all', c.markAllRead);

// ---- inbox -----------------------------------------------------------------
notificationRoutes.get('/', validate({ query: ListNotificationsQuery }), c.listNotifications);

notificationRoutes.post('/:id/read', validate({ params: IdParams }), c.markRead);
notificationRoutes.delete('/:id', validate({ params: IdParams }), c.dismiss);
