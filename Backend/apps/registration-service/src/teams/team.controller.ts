import { ITeam, ServiceError, wrap } from '@bgsc/shared';
import * as teamService from './team.service';
import { CreateTeamInput, InviteMemberInput, JoinByCodeInput, RemoveMemberInput, ListTeamsInput } from './team.schemas';
import { actorOf, isOwnerAdmin, requireOwnerAdmin } from '../access';

/**
 * Acting on a team you do not captain is the OWNER's admins' call: an event's
 * admins for an event team, core+ for a challenge team — ranked on the live actor. "Any core" used
 * to lock, disband and prune every team on the platform.
 */

export const createTeamHandler = wrap(async (req, res) => {
    const { owner, name, join_policy } = req.body as CreateTeamInput;
    res.status(201).json(await teamService.createTeam({ owner, name, join_policy, captain_user_id: req.user!.id }));
});

/** The invite code is a join credential: only the captain (who shares it) and the owner's admins read it. */
function withoutCode(team: ITeam, show: boolean) {
    const { invite_code, ...rest } = team.toObject();
    return show ? { ...rest, invite_code } : rest;
}

export const getTeamHandler = wrap(async (req, res) => {
    const team = await teamService.getTeam(req.params.id as string);
    // A read: the token's claim, like every other read (no live-user lookup on this route).
    const show = team.captain_user_id === req.user!.id || (await isOwnerAdmin(team.owner, req.user!));
    res.json(withoutCode(team, show));
});

/** Lists show the code to the captain only — one admin check per row is not worth a list read. */
export const listTeamsHandler = wrap(async (req, res) => {
    const q = req.query as unknown as ListTeamsInput;
    const teams = await teamService.listTeams({ ...q, invited_user: q.invited === 'me' ? req.user!.id : undefined });
    res.json(teams.map((t) => withoutCode(t, t.captain_user_id === req.user!.id)));
});

/** Offers a seat; the invitee accepts with POST /teams/:id/join. */
export const inviteMemberHandler = wrap(async (req, res) => {
    const { user_id } = req.body as InviteMemberInput;
    res.json(await teamService.inviteMember(req.params.id as string, req.user!.id, user_id));
});

export const joinByCodeHandler = wrap(async (req, res) => {
    const { code } = req.body as JoinByCodeInput;
    res.json(await teamService.joinTeamByCode(code, req.user!.id));
});

export const joinTeamHandler = wrap(async (req, res) => {
    res.json(await teamService.joinTeam(req.params.id as string, req.user!.id));
});

/** A member may remove themselves; otherwise it is the captain's or an admin's call. Mid-auction, only an admin's. */
export const removeMemberHandler = wrap(async (req, res) => {
    const { reason } = req.body as RemoveMemberInput;
    const teamId = req.params.id as string;
    const userId = req.params.user_id as string;
    const team = await teamService.getTeam(teamId);

    const admin = await isOwnerAdmin(team.owner, actorOf(req));
    if (userId !== req.user!.id && team.captain_user_id !== req.user!.id && !admin) throw new ServiceError(403, 'forbidden');
    if (!admin) await teamService.refuseDuringAuction(team);

    res.json(await teamService.removeMemberFromTeam(teamId, userId, req.user!.id, reason));
});

export const lockTeamHandler = wrap(async (req, res) => {
    const team = await teamService.getTeam(req.params.id as string);
    await requireOwnerAdmin(team.owner, actorOf(req));
    res.json(await teamService.lockTeam(team._id, req.user!.id));
});

/** The captain or an admin of the owner. Mid-auction, only an admin. */
export const disbandTeamHandler = wrap(async (req, res) => {
    const team = await teamService.getTeam(req.params.id as string);
    const admin = await isOwnerAdmin(team.owner, actorOf(req));
    if (team.captain_user_id !== req.user!.id && !admin) throw new ServiceError(403, 'forbidden');
    if (!admin) await teamService.refuseDuringAuction(team);

    const { reason } = req.body as RemoveMemberInput;
    res.json(await teamService.disbandTeam(team._id, reason));
});
