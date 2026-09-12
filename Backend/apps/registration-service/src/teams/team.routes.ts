import { UserRole, requireAuth, requireRole, validate } from '@bgsc/shared';
import { Router } from 'express';
import * as controller from './team.controller';
import {
    CreateTeamSchema,
    InviteMemberSchema,
    RemoveMemberSchema,
    TeamIdParams,
    TeamMemberParams,
    ListTeamsQuery,
} from './team.schemas';

export const teamRoutes = Router();

// POST /teams - create team (approved, confirmed captain only)
teamRoutes.post('/', requireAuth, validate({ body: CreateTeamSchema }), controller.createTeamHandler);

// GET /teams - list teams (any authed, with filters)
teamRoutes.get('/', requireAuth, validate({ query: ListTeamsQuery }), controller.listTeamsHandler);

// GET /teams/:id - read team roster (any authed)
teamRoutes.get('/:id', requireAuth, validate({ params: TeamIdParams }), controller.getTeamHandler);

// POST /teams/:id/invite - invite member (captain only)
teamRoutes.post('/:id/invite', requireAuth, validate({ params: TeamIdParams, body: InviteMemberSchema }), controller.inviteMemberHandler);

// POST /teams/:id/join - join an open team (registered member)
teamRoutes.post('/:id/join', requireAuth, validate({ params: TeamIdParams }), controller.joinTeamHandler);

// DELETE /teams/:id/members/:user_id - remove member (self, captain, or core+)
teamRoutes.delete(
    '/:id/members/:user_id',
    requireAuth,
    validate({ params: TeamMemberParams, body: RemoveMemberSchema }),
    controller.removeMemberHandler
);

// PATCH /teams/:id/lock - lock roster (core+)
teamRoutes.patch('/:id/lock', requireAuth, requireRole(UserRole.CORE), validate({ params: TeamIdParams }), controller.lockTeamHandler);

// DELETE /teams/:id - disband team (captain or core+)
teamRoutes.delete('/:id', requireAuth, validate({ params: TeamIdParams, body: RemoveMemberSchema }), controller.disbandTeamHandler);
