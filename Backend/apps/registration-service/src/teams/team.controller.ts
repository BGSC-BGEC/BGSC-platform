import { FormSubmission, ServiceError, UserRole, rankOf } from '@bgsc/shared';
import { Request, Response, NextFunction } from 'express';
import * as teamService from './team.service';
import { CreateTeamInput, InviteMemberInput, RemoveMemberInput, ListTeamsInput } from './team.schemas';

/** May act on a team they do not captain. Ranked against the shared ladder, not a name list. */
/**
 * Sees admin_only fields, and decides admin-only branches.
 *
 * Prefers the document `requireActiveUser` loaded over the token's claim: the claim stays valid for
 * up to fifteen minutes after a demotion or a suspension. Routes that only mount `requireAuth` have
 * no live document to read, and fall back to the claim — those are reads, where a stale answer is
 * not a damage path (adding-a-service.md §6.2; whole-backend audit, Sep 27).
 */
const isAdmin = (req: Request) => rankOf((req.actor?.role ?? req.user!.role) as UserRole) >= rankOf(UserRole.CORE);

export async function createTeamHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const team = await teamService.createTeam({
            ...(req.body as CreateTeamInput),
            captain_user_id: req.user!.id,
        });
        res.status(201).json(team);
    } catch (err) {
        next(err);
    }
}

export async function getTeamHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const teamId = req.params.id as string;
        const team = await teamService.getTeam(teamId);
        res.json(team);
    } catch (err) {
        next(err);
    }
}

export async function listTeamsHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const teams = await teamService.listTeams(req.query as ListTeamsInput);
        res.json(teams);
    } catch (err) {
        next(err);
    }
}

export async function inviteMemberHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { user_id } = req.body as InviteMemberInput;
        const teamId = req.params.id as string;
        const team = await teamService.getTeam(teamId);

        // Check if requester is captain
        if (team.captain_user_id !== req.user!.id) {
            throw new ServiceError(403, 'not_captain');
        }

        // A challenge team has no form, so there is no registration to look up (be2-challenge-
        // service-plan.md D5). Eligibility for a challenge team is the Challenge Service's, at
        // accept time.
        let memberRegId: string | null = null;
        if (team.owner.type === 'event') {
            const memberReg = await FormSubmission.findOne({
                'owner.id': team.owner.id,
                'user.user_id': user_id,
                'context.event.role': 'member',
                status: 'confirmed',
            });

            if (!memberReg) {
                throw new ServiceError(404, 'member_not_registered');
            }
            memberRegId = memberReg._id;
        }

        const updatedTeam = await teamService.addMemberToTeam(teamId, user_id, memberRegId, 'invite');

        res.json(updatedTeam);
    } catch (err) {
        next(err);
    }
}

export async function joinTeamHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const teamId = req.params.id as string;
        const team = await teamService.getTeam(teamId);

        let userRegId: string | null = null;
        if (team.owner.type === 'event') {
            const userReg = await FormSubmission.findOne({
                'owner.id': team.owner.id,
                'user.user_id': req.user!.id,
                'context.event.role': 'member',
                status: 'confirmed',
            });

            if (!userReg) {
                throw new ServiceError(404, 'not_registered_as_member');
            }
            userRegId = userReg._id;
        }

        if (team.status !== 'forming') {
            throw new ServiceError(400, 'team_not_accepting_members');
        }

        // Self-service join is exactly what join_policy governs; ignoring it made every team open.
        if (team.join_policy !== 'open') {
            throw new ServiceError(403, 'team_not_open');
        }

        const updatedTeam = await teamService.addMemberToTeam(teamId, req.user!.id, userRegId, 'join');

        res.json(updatedTeam);
    } catch (err) {
        next(err);
    }
}

export async function removeMemberHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { reason } = req.body as RemoveMemberInput;
        const teamId = req.params.id as string;
        const userId = req.params.user_id as string;
        const team = await teamService.getTeam(teamId);

        // A member may always remove themselves; otherwise it is the captain's or an admin's call.
        const isSelf = userId === req.user!.id;
        const isCaptain = team.captain_user_id === req.user!.id;

        if (!isSelf && !isCaptain && !isAdmin(req)) {
            throw new ServiceError(403, 'forbidden');
        }

        const updatedTeam = await teamService.removeMemberFromTeam(teamId, userId, req.user!.id, reason);

        res.json(updatedTeam);
    } catch (err) {
        next(err);
    }
}

export async function lockTeamHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const teamId = req.params.id as string;
        const team = await teamService.lockTeam(teamId, req.user!.id);
        res.json(team);
    } catch (err) {
        next(err);
    }
}

export async function disbandTeamHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const teamId = req.params.id as string;
        const team = await teamService.getTeam(teamId);

        if (team.captain_user_id !== req.user!.id && !isAdmin(req)) {
            throw new ServiceError(403, 'forbidden');
        }

        const { reason } = req.body as RemoveMemberInput;
        const disbanded = await teamService.disbandTeam(teamId, reason);
        res.json(disbanded);
    } catch (err) {
        next(err);
    }
}
