import { ServiceError } from '@bgsc/shared';
import { Request, Response, NextFunction } from 'express';
import * as teamService from './team.service';
import { CreateTeamInput, InviteMemberInput, RemoveMemberInput, ListTeamsInput } from './team.schemas';
import { actorOf, isOwnerAdmin, requireOwnerAdmin } from '../access';

/**
 * Acting on a team you do not captain is the OWNER's admins' call: an event's
 * admins for an event team, core+ for a challenge team — ranked on the live actor. "Any core" used
 * to lock, disband and prune every team on the platform.
 */

export async function createTeamHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { owner, name, join_policy } = req.body as CreateTeamInput;
        const team = await teamService.createTeam({ owner, name, join_policy, captain_user_id: req.user!.id });
        res.status(201).json(team);
    } catch (err) {
        next(err);
    }
}

export async function getTeamHandler(req: Request, res: Response, next: NextFunction) {
    try {
        res.json(await teamService.getTeam(req.params.id as string));
    } catch (err) {
        next(err);
    }
}

export async function listTeamsHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const q = req.query as unknown as ListTeamsInput;
        res.json(await teamService.listTeams({ ...q, invited_user: q.invited === 'me' ? req.user!.id : undefined }));
    } catch (err) {
        next(err);
    }
}

/** Offers a seat; the invitee accepts with POST /teams/:id/join. */
export async function inviteMemberHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { user_id } = req.body as InviteMemberInput;
        res.json(await teamService.inviteMember(req.params.id as string, req.user!.id, user_id));
    } catch (err) {
        next(err);
    }
}

export async function joinTeamHandler(req: Request, res: Response, next: NextFunction) {
    try {
        res.json(await teamService.joinTeam(req.params.id as string, req.user!.id));
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
        if (!isSelf && !isCaptain && !(await isOwnerAdmin(team.owner, actorOf(req)))) {
            throw new ServiceError(403, 'forbidden');
        }

        res.json(await teamService.removeMemberFromTeam(teamId, userId, req.user!.id, reason));
    } catch (err) {
        next(err);
    }
}

export async function lockTeamHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const team = await teamService.getTeam(req.params.id as string);
        await requireOwnerAdmin(team.owner, actorOf(req));
        res.json(await teamService.lockTeam(team._id, req.user!.id));
    } catch (err) {
        next(err);
    }
}

export async function disbandTeamHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const teamId = req.params.id as string;
        const team = await teamService.getTeam(teamId);
        if (team.captain_user_id !== req.user!.id && !(await isOwnerAdmin(team.owner, actorOf(req)))) {
            throw new ServiceError(403, 'forbidden');
        }

        const { reason } = req.body as RemoveMemberInput;
        res.json(await teamService.disbandTeam(teamId, reason));
    } catch (err) {
        next(err);
    }
}
