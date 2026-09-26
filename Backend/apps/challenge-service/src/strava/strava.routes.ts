import { UserRole, requireActiveUser, requireAuth, validate } from '@bgsc/shared';
import { Router } from 'express';
import * as c from './strava.controller';
import { ActivitiesQuery, LinkBody, UserIdParams } from './strava.schemas';

/**
 * Mounted at `/strava` — a second gateway routing row onto this same container
 * (routing.ts, `strava` key). Strava is account linking, never a login method: every route but the
 * callback needs a BGSC session already.
 *
 * The flow: `GET /connect` -> `{ url }` -> the user approves on Strava -> Strava navigates to the
 * public `GET /callback` -> bounced to the app with `code`/`state`/`scope` -> the app posts them to
 * `POST /link` under its own session, which must be the session that started the flow.
 */
export const stravaRoutes = Router();

/**
 * Declared before the router-wide `requireAuth`, so the redirect is genuinely unauthenticated.
 *
 * And deliberately WITHOUT `validate()`: a zod failure answers `422 { error: 'validation_failed' }`
 * before the handler runs, which on a browser navigation strands the user on a JSON body — the
 * exact failure the controller redirects around. It writes nothing; the signed `state` is checked
 * so a forged or stale one is refused here, and the link itself is validated on `POST /link`.
 */
stravaRoutes.get('/callback', c.callback);

stravaRoutes.use(requireAuth);

stravaRoutes.get('/connect', c.connect);
// A write, and it stores third-party credentials: the live user document, not the token's claim.
stravaRoutes.post('/link', requireActiveUser(UserRole.GUEST), validate({ body: LinkBody }), c.link);
stravaRoutes.get('/status', c.status);
stravaRoutes.delete('/disconnect', c.disconnect);
// Live user: a suspended account must not keep spending the app-wide Strava budget on a token
// that has not expired yet.
stravaRoutes.post('/sync', requireActiveUser(UserRole.GUEST), c.sync);
stravaRoutes.get('/activities', validate({ query: ActivitiesQuery }), c.myActivities);
stravaRoutes.get(
    '/users/:id/activities',
    validate({ params: UserIdParams, query: ActivitiesQuery }),
    c.userActivities
);
