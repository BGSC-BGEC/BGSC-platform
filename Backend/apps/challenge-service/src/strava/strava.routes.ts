import { requireAuth, validate } from '@bgsc/shared';
import { Router } from 'express';
import * as c from './strava.controller';
import { ActivitiesQuery, UserIdParams } from './strava.schemas';

/**
 * Mounted at `/strava` — a second gateway routing row onto this same container
 * (routing.ts, `strava` key). Strava is account linking, never a login method: every route but the
 * callback needs a BGSC session already.
 *
 * `/strava/callback` is the one public path in this service. It cannot carry a Bearer token —
 * Strava's redirect is a browser navigation — so the signed `state` is what identifies the user,
 * and it is verified before anything is written (RFC 6749 §10.12).
 */
export const stravaRoutes = Router();

/**
 * Declared before the router-wide `requireAuth`, so the redirect is genuinely unauthenticated.
 *
 * And deliberately WITHOUT `validate()`: a zod failure answers `422 { error: 'validation_failed' }`
 * before the handler runs, which on a browser navigation strands the user on a JSON body — the
 * exact failure the controller redirects around. The real gate here is the signed `state`, which is
 * verified before anything is written; an over-long `code` is rejected by Strava and an over-long
 * `state` by `jwt.verify`, and both of those come back as a redirect with a reason.
 */
stravaRoutes.get('/callback', c.callback);

stravaRoutes.use(requireAuth);

stravaRoutes.get('/connect', c.connect);
stravaRoutes.get('/status', c.status);
stravaRoutes.delete('/disconnect', c.disconnect);
stravaRoutes.post('/sync', c.sync);
stravaRoutes.get('/activities', validate({ query: ActivitiesQuery }), c.myActivities);
stravaRoutes.get(
    '/users/:id/activities',
    validate({ params: UserIdParams, query: ActivitiesQuery }),
    c.userActivities
);
