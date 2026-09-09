import { FormSubmission, ServiceError, UserRole, rankOf } from '@bgsc/shared';
import { Request, Response, NextFunction } from 'express';
import * as teamService from './team.service';
import { CreateTeamInput, InviteMemberInput, RemoveMemberInput, ListTeamsInput } from './team.schemas';

/** May act on a team they do not captain. Ranked against the shared ladder, not a name list. */
const isAdmin = (req: Request) => rankOf(req.user!.role) >= rankOf(UserRole.CORE);

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

        // Find member's registration
        const memberReg = await FormSubmission.findOne({
            'owner.id': team.owner.id,
            'user.user_id': user_id,
            'context.event.role': 'member',
            status: 'confirmed',
        });

        if (!memberReg) {
            throw new ServiceError(404, 'member_not_registered');
        }

        const updatedTeam = await teamService.addMemberToTeam(teamId, user_id, memberReg._id, 'invite');

        res.json(updatedTeam);
    } catch (err) {
        next(err);
    }
}

export async function joinTeamHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const teamId = req.params.id as string;
        const team = await teamService.getTeam(teamId);

        // Find user's registration
        const userReg = await FormSubmission.findOne({
            'owner.id': team.owner.id,
            'user.user_id': req.user!.id,
            'context.event.role': 'member',
            status: 'confirmed',
        });

        if (!userReg) {
            throw new ServiceError(404, 'not_registered_as_member');
        }

        if (team.status !== 'forming') {
            throw new ServiceError(400, 'team_not_accepting_members');
        }

        // Self-service join is exactly what join_policy governs; ignoring it made every team open.
        if (team.join_policy !== 'open') {
            throw new ServiceError(403, 'team_not_open');
        }

        const updatedTeam = await teamService.addMemberToTeam(teamId, req.user!.id, userReg._id, 'join');

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
