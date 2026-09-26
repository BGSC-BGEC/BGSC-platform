import { requireActiveUser, requireAuth, validate } from '@bgsc/shared';
import { Router } from 'express';
import * as controller from './team.controller';
import {
    CreateTeamSchema,
    InviteMemberSchema,
    JoinByCodeSchema,
    RemoveMemberSchema,
    TeamIdParams,
    TeamMemberParams,
    ListTeamsQuery,
} from './team.schemas';

/**
 * Every write mounts `requireActiveUser`: a suspended account stops acting at once, and the admin
 * branches (remove someone else, disband a team you do not captain) rank the live role rather than
 * a token claim that outlives a demotion by fifteen minutes.
 */

export const teamRoutes = Router();

// POST /teams - create team (approved, confirmed captain only)
teamRoutes.post('/', requireAuth, requireActiveUser(), validate({ body: CreateTeamSchema }), controller.createTeamHandler);

// GET /teams - list teams (any authed, with filters, paged)
teamRoutes.get('/', requireAuth, validate({ query: ListTeamsQuery }), controller.listTeamsHandler);

// GET /teams/:id - read team roster (any authed)
teamRoutes.get('/:id', requireAuth, validate({ params: TeamIdParams }), controller.getTeamHandler);

// POST /teams/:id/invite - offer a seat (captain only); lands in pending[] until accepted
teamRoutes.post(
    '/:id/invite',
    requireAuth,
    requireActiveUser(),
    validate({ params: TeamIdParams, body: InviteMemberSchema }),
    controller.inviteMemberHandler
);

// POST /teams/join-by-code - join with the code the captain shared (counts as their invite)
teamRoutes.post('/join-by-code', requireAuth, requireActiveUser(), validate({ body: JoinByCodeSchema }), controller.joinByCodeHandler);

// POST /teams/:id/join - accept an invite, or join an open team
teamRoutes.post('/:id/join', requireAuth, requireActiveUser(), validate({ params: TeamIdParams }), controller.joinTeamHandler);

// DELETE /teams/:id/members/:user_id - remove member (self, captain, or core+)
teamRoutes.delete(
    '/:id/members/:user_id',
    requireAuth,
    requireActiveUser(),
    validate({ params: TeamMemberParams, body: RemoveMemberSchema }),
    controller.removeMemberHandler
);

// PATCH /teams/:id/lock - lock roster (admin of the team's event, core+ for a challenge team)
teamRoutes.patch('/:id/lock', requireAuth, requireActiveUser(), validate({ params: TeamIdParams }), controller.lockTeamHandler);

// DELETE /teams/:id - disband team (captain or core+)
teamRoutes.delete(
    '/:id',
    requireAuth,
    requireActiveUser(),
    validate({ params: TeamIdParams, body: RemoveMemberSchema }),
    controller.disbandTeamHandler
);
