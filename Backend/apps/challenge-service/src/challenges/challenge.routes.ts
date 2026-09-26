import { UserRole, requireAuth, validate } from '@bgsc/shared';
import { Router } from 'express';
import { requireActiveUser } from './actor';
import * as c from './challenge.controller';
import {
    AcceptBody,
    CreateChallengeBody,
    IdParams,
    KeyParams,
    ListChallengesQuery,
    MyParticipationsQuery,
    ProgressBody,
    QueueQuery,
    ReviewBody,
    SubmitBody,
    UpdateChallengeBody,
    WithdrawBody,
} from './challenge.schemas';

/**
 * Mounted at `/challenges` — the prefix the gateway forwards unchanged (routing.ts:30).
 *
 * Spec §5.7 marks the whole Point System & Challenge page "Visibility: Authenticated only", so
 * there is one floor for the entire prefix and no `optionalAuth` anywhere in this service.
 *
 * Admin writes take `requireActiveUser` (the live user document's role) rather than `requireRole`
 * (the token's claim): a token outlives a demotion by up to 15 minutes, and approving a
 * participation publishes an event that mints points.
 */
export const challengeRoutes = Router();

challengeRoutes.use(requireAuth);

/* ---- literal segments first, or Express reads `participations` and `me` as a :key ---- */

challengeRoutes.get('/me/participations', validate({ query: MyParticipationsQuery }), c.myParticipations);

challengeRoutes.get('/participations/:id', validate({ params: IdParams }), c.participationDetail);
challengeRoutes.patch(
    '/participations/:id/progress',
    validate({ params: IdParams, body: ProgressBody }),
    c.progress
);
// The live user document, like review: on an auto-approve challenge a submit IS the payout, so a
// suspended account must not mint points on a token that has not expired yet.
challengeRoutes.post(
    '/participations/:id/submit',
    requireActiveUser(UserRole.GUEST),
    validate({ params: IdParams, body: SubmitBody }),
    c.submit
);
challengeRoutes.post(
    '/participations/:id/review',
    // No rank floor: `challenge.reviewers[]` may name anyone, so the only authority on who may
    // review IS the challenge, and the service checks it. `requireActiveUser(GUEST)` is still
    // mounted for its other half — it ranks the LIVE user document, so a suspended or deleted
    // account cannot approve a payout on a token that has not expired yet.
    requireActiveUser(UserRole.GUEST),
    validate({ params: IdParams, body: ReviewBody }),
    c.review
);
challengeRoutes.post(
    '/participations/:id/withdraw',
    requireActiveUser(UserRole.CORE),
    validate({ params: IdParams, body: WithdrawBody }),
    c.withdraw
);

/* ---- catalog ---- */

challengeRoutes.get('/', validate({ query: ListChallengesQuery }), c.list);
challengeRoutes.post('/', requireActiveUser(UserRole.CORE), validate({ body: CreateChallengeBody }), c.create);

challengeRoutes.patch(
    '/:id',
    requireActiveUser(UserRole.CORE),
    validate({ params: IdParams, body: UpdateChallengeBody }),
    c.update
);
challengeRoutes.delete('/:id', requireActiveUser(UserRole.COORDINATOR), validate({ params: IdParams }), c.remove);

challengeRoutes.post('/:id/activate', requireActiveUser(UserRole.CORE), validate({ params: IdParams }), c.activate);
challengeRoutes.post('/:id/complete', requireActiveUser(UserRole.CORE), validate({ params: IdParams }), c.complete);
challengeRoutes.post('/:id/archive', requireActiveUser(UserRole.CORE), validate({ params: IdParams }), c.archive);

challengeRoutes.post('/:id/accept', requireActiveUser(UserRole.GUEST), validate({ params: IdParams, body: AcceptBody }), c.accept);
// No rank floor here either: a 403 would tell a stranger the queue exists and that they merely
// lack the rank. The controller answers 404 for anyone who may not review this challenge.
challengeRoutes.get('/:id/participations', validate({ params: IdParams, query: QueueQuery }), c.queue);

/* ---- the catch-all detail route is last: `:key` matches anything ---- */

challengeRoutes.get('/:key', validate({ params: KeyParams }), c.detail);
