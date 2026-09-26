import {
    Challenge,
    Event,
    FormSubmission,
    ITeam,
    PENDING_TTL_MS,
    ServiceError,
    Team,
    TeamStatus,
    TeamMembership,
    User,
    publish,
} from '@bgsc/shared';
import { v4 as uuid } from 'uuid';

const PRODUCER = 'registration-service';

interface CreateTeamInput {
    owner: { type: 'event' | 'challenge'; id: string };
    name: string;
    captain_user_id: string;
    join_policy?: 'open' | 'invite_only' | 'closed';
}

type Member = ITeam['members'][number];

/**
 * Rosters change only through conditional updates from here on. Every mutation used to be
 * read → check → `team.save()`; array pushes save as `$push` with no version check, so two joins
 * into the last slot both landed and left a roster over `size_max` that no later save could pass.
 * Query updates skip the model's pre-validate hook, so each filter below carries the invariant it
 * would have checked.
 */
const OPEN_STATUSES: TeamStatus[] = ['forming', 'complete'];

/* ------------------------------------------------------------------ *
 * One team per user per owner
 * ------------------------------------------------------------------ */

/** A claim younger than this is an add in flight, not a leftover; it is never taken over. */
const CLAIM_GRACE_MS = 60_000;

/**
 * Take the `<owner>:<user>` membership claim for `teamId`. Returns true when this call created (or
 * took over) the claim — the caller must release it if the add then fails — and false when the
 * claim was already this team's (a retry of the same add).
 */
async function claimMembership(ownerId: string, userId: string, teamId: string): Promise<boolean> {
    const _id = `${ownerId}:${userId}`;
    let owned = true;
    try {
        await TeamMembership.create({ _id, owner_id: ownerId, user_id: userId, team_id: teamId });
    } catch (err: any) {
        if (err?.code !== 11000) throw err;
        const claim = await TeamMembership.findById(_id);
        if (!claim) throw new ServiceError(409, 'already_in_team'); // released mid-race: let the caller retry
        if (claim.team_id === teamId) {
            owned = false;
        } else {
            // A leftover from an add that failed after claiming: no roster lists the user, and it is
            // old enough not to be an add still running. Taken over by CAS on the old holder.
            const holder = await Team.exists({ _id: claim.team_id, status: { $ne: 'disbanded' }, 'members.user_id': userId });
            const stale = !holder && Date.now() - claim.created_at.getTime() > CLAIM_GRACE_MS;
            const taken = stale && (await TeamMembership.findOneAndUpdate({ _id, team_id: claim.team_id }, { $set: { team_id: teamId } }));
            if (!taken) throw new ServiceError(409, 'already_in_team');
        }
    }

    // Rosters written before claims existed have none; they still count.
    const elsewhere = await Team.exists({
        _id: { $ne: teamId },
        'owner.id': ownerId,
        'members.user_id': userId,
        status: { $ne: 'disbanded' },
    });
    if (elsewhere) {
        if (owned) await releaseMembership(ownerId, userId, teamId);
        throw new ServiceError(409, 'already_in_team');
    }
    return owned;
}

async function releaseMembership(ownerId: string, userId: string, teamId: string): Promise<void> {
    await TeamMembership.deleteOne({ _id: `${ownerId}:${userId}`, team_id: teamId });
}

/* ------------------------------------------------------------------ *
 * Create / read
 * ------------------------------------------------------------------ */

/**
 * Who may captain a team, and the roster bounds — the one thing that genuinely differs between the
 * two owner types. Bounds come from the OWNER (`events.teaming` / `challenges.teaming`) and are not
 * caller-overridable: a roster that locks at a size its owner will not accept is a roster that
 * fills, waits, and is refused last.
 */
async function captainContext(input: CreateTeamInput): Promise<{
    display_name: string;
    avatar_url: string | null;
    registration_id: string | null;
    size_min: number;
    size_max: number;
    max_teams: number | null;
}> {
    if (input.owner.type === 'challenge') {
        const challenge = await Challenge.findOne({ _id: input.owner.id, deleted_at: null }).select('teaming status');
        if (!challenge) throw new ServiceError(404, 'challenge_not_found');
        if (!challenge.teaming.enabled) throw new ServiceError(409, 'teaming_not_enabled');
        // A team exists in order to accept, and only an `active` challenge accepts.
        if (challenge.status !== 'active') throw new ServiceError(409, 'challenge_not_active');

        const user = await User.findOne({ _id: input.captain_user_id, deleted_at: null }).select(
            'username profile.full_name profile.avatar_url'
        );
        if (!user) throw new ServiceError(404, 'user_not_found');

        return {
            display_name: user.profile?.full_name || user.username,
            avatar_url: user.profile?.avatar_url ?? null,
            registration_id: null, // a challenge team has no registration (Team.ts invariant)
            size_min: challenge.teaming.team_size_min ?? 1,
            size_max: challenge.teaming.team_size_max ?? challenge.teaming.team_size_min ?? 1,
            max_teams: challenge.teaming.max_teams ?? null,
        };
    }

    const event = await Event.findOne({ _id: input.owner.id, deleted_at: null }).select('teaming').lean();
    if (!event) throw new ServiceError(404, 'event_not_found');
    const t = event.teaming;
    // A teamed event has both bounds by the Event model's own invariant.
    if (!t?.is_teamed || t.team_size_min == null || t.team_size_max == null) {
        throw new ServiceError(409, 'event_not_teamed');
    }

    const captainReg = await FormSubmission.findOne({
        'owner.id': input.owner.id,
        'user.user_id': input.captain_user_id,
        'context.event.role': 'captain',
        'context.event.captain_application.status': 'approved',
        status: 'confirmed',
    });
    if (!captainReg) {
        throw new ServiceError(403, 'captain_not_approved');
    }

    return {
        display_name: captainReg.user.display_name,
        avatar_url: captainReg.user.avatar_url,
        registration_id: captainReg._id,
        size_min: t.team_size_min,
        size_max: t.team_size_max,
        max_teams: t.max_teams ?? null,
    };
}

const inviteCode = () => uuid().replace(/-/g, '').substring(0, 8);

export async function createTeam(input: CreateTeamInput): Promise<ITeam> {
    const captain = await captainContext(input);

    const existingTeam = await Team.exists({
        'owner.id': input.owner.id,
        captain_user_id: input.captain_user_id,
        status: { $ne: 'disbanded' },
    });
    if (existingTeam) {
        throw new ServiceError(409, 'captain_already_has_team');
    }
    // ponytail: count-then-insert, so captains creating at the same instant can overshoot
    // `max_teams` by the number racing. A per-owner counter claimed with $inc is the upgrade.
    if (captain.max_teams != null) {
        const teams = await Team.countDocuments({ 'owner.id': input.owner.id, status: { $ne: 'disbanded' } });
        if (teams >= captain.max_teams) throw new ServiceError(409, 'max_teams_reached');
    }

    const teamId = uuid();
    // The captain is a member too, so they take the same one-team claim a joiner does. Challenge
    // `createTeam` used to skip it and put a member of team A in charge of team B.
    const owned = await claimMembership(input.owner.id, input.captain_user_id, teamId);

    const team = new Team({
        _id: teamId,
        owner: input.owner,
        name: input.name,
        name_lower: input.name.toLowerCase(),
        logo_url: null,
        captain_user_id: input.captain_user_id,
        members: [
            {
                user_id: input.captain_user_id,
                display_name: captain.display_name,
                avatar_url: captain.avatar_url,
                registration_id: captain.registration_id,
                joined_at: new Date(),
                acquired_via: 'created',
            },
        ],
        join_policy: input.join_policy ?? 'invite_only',
        invite_code: inviteCode(),
        size_min: captain.size_min,
        size_max: captain.size_max,
        pending: [],
        status: 'forming',
        auction: null, // set by the Event Service at auction start, through /internal
    });

    // 32 random bits in a globally unique index: a clash is rare, and it is a new draw, not a 500.
    for (let attempt = 1; ; attempt++) {
        try {
            await team.save();
            break;
        } catch (err: any) {
            if (err?.code === 11000 && err?.keyPattern?.invite_code && attempt < 3) {
                team.invite_code = inviteCode();
                continue;
            }
            if (owned) await releaseMembership(input.owner.id, input.captain_user_id, teamId);
            if (err?.code === 11000 && err?.keyPattern?.name_lower) throw new ServiceError(409, 'team_name_taken');
            if (err?.code === 11000 && err?.keyPattern?.invite_code) throw new ServiceError(409, 'invite_code_conflict');
            throw err;
        }
    }

    // Link the captain's registration; it doubles as the event-side one-team lock.
    if (captain.registration_id) {
        const linked = await FormSubmission.updateOne(
            { _id: captain.registration_id, status: 'confirmed', 'context.event.team_id': null },
            { $set: { 'context.event.team_id': team._id } }
        );
        if (linked.modifiedCount === 0) {
            await Team.deleteOne({ _id: team._id });
            if (owned) await releaseMembership(input.owner.id, input.captain_user_id, teamId);
            throw new ServiceError(409, 'already_in_team');
        }
    }

    publish('TeamCreated', PRODUCER, {
        team_id: team._id,
        owner: input.owner,
        captain_user_id: input.captain_user_id,
        name: team.name,
    });

    return team;
}

export async function getTeam(teamId: string): Promise<ITeam> {
    const team = await Team.findById(teamId);
    if (!team) {
        throw new ServiceError(404, 'team_not_found');
    }
    return team;
}

/**
 * `invited_user` lists the teams holding a LIVE invite for that user (`GET /teams?invited=me`) —
 * without it an invite sat in `pending[]` with no way for the invitee to find it.
 */
export async function listTeams(filter: {
    owner_id?: string;
    status?: string;
    join_policy?: string;
    invited_user?: string;
    limit: number;
    offset: number;
}): Promise<ITeam[]> {
    const query: Record<string, unknown> = {};
    if (filter.invited_user) {
        query.pending = { $elemMatch: { user_id: filter.invited_user, direction: 'invite', expires_at: { $gt: new Date() } } };
    }
    if (filter.owner_id) query['owner.id'] = filter.owner_id;
    if (filter.status) query.status = filter.status;
    if (filter.join_policy) query.join_policy = filter.join_policy;

    return Team.find(query).sort({ created_at: -1, _id: 1 }).skip(filter.offset).limit(filter.limit);
}

/* ------------------------------------------------------------------ *
 * Membership
 * ------------------------------------------------------------------ */

/**
 * An auction league (`ALL`) team, and whether its auction is over; null for any other team. Its
 * members are bought: the auction seats them through `addMemberToTeam(…, 'auction')`, never a join.
 */
async function auctionLeague(team: ITeam): Promise<{ finished: boolean } | null> {
    if (team.owner.type !== 'event') return null;
    const event = await Event.findById(team.owner.id).select('type auction.status').lean();
    return event?.type === 'ALL' ? { finished: event.auction?.status === 'finished' } : null;
}

/**
 * While an auction league's auction is still selling, its rosters and purses are the auction's:
 * a bought player leaving, or a captain disbanding, would undo sales already paid for. The
 * controllers skip this for an admin of the event.
 */
export async function refuseDuringAuction(team: ITeam): Promise<void> {
    const league = await auctionLeague(team);
    if (league && !league.finished) throw new ServiceError(409, 'auction_in_progress');
}

/** The same, for a registration's team: cancelling a bought seat mid-auction would undo a paid sale. */
export async function refuseLeavingDuringAuction(teamId: string | null | undefined): Promise<void> {
    if (!teamId) return;
    const team = await Team.findById(teamId);
    if (team) await refuseDuringAuction(team);
}

/**
 * The user captains an open team of this owner that has members besides them. A locked roster
 * does not count: it can be neither disbanded nor shrunk, so counting it would bar an admin from
 * ever removing a no-show captain once rosters lock.
 */
export async function captainHasTeam(ownerId: string, userId: string): Promise<boolean> {
    return !!(await Team.exists({
        'owner.id': ownerId,
        captain_user_id: userId,
        status: { $in: OPEN_STATUSES },
        'members.1': { $exists: true },
    }));
}

/** The member row, and for an event team the registration it links. Refusals mirror the old checks. */
async function memberFor(
    team: ITeam,
    userId: string,
    registrationId: string | null,
    acquiredVia: 'invite' | 'join' | 'auction'
): Promise<Member> {
    const via = acquiredVia === 'join' ? 'join_request' : acquiredVia;

    if (team.owner.type === 'challenge') {
        const user = await User.findOne({ _id: userId, deleted_at: null }).select('username profile.full_name profile.avatar_url');
        if (!user) throw new ServiceError(404, 'user_not_found');
        return {
            user_id: userId,
            display_name: user.profile?.full_name || user.username,
            avatar_url: user.profile?.avatar_url ?? null,
            registration_id: null,
            joined_at: new Date(),
            acquired_via: via,
        } as Member;
    }

    if (!registrationId) throw new ServiceError(400, 'registration_id_required');
    const registration = await FormSubmission.findById(registrationId);
    if (!registration) throw new ServiceError(404, 'registration_not_found');
    // user_id and registration_id arrive independently on the internal auction route.
    if (registration.user.user_id !== userId) throw new ServiceError(400, 'registration_user_mismatch');
    if (registration.owner.type !== team.owner.type || registration.owner.id !== team.owner.id) {
        throw new ServiceError(400, 'registration_owner_mismatch');
    }
    if (!registration.context.event) throw new ServiceError(400, 'not_event_registration');
    if (registration.status !== 'confirmed') throw new ServiceError(400, 'registration_not_confirmed');
    // Linked to THIS team: an add still in flight. The caller's link then fails and a keyed repeat
    // waits for that add to land instead of answering 409.
    const linkedTo = registration.context.event.team_id;
    if (linkedTo && linkedTo !== team._id) throw new ServiceError(409, 'already_in_team');

    return {
        user_id: userId,
        display_name: registration.user.display_name,
        avatar_url: registration.user.avatar_url,
        registration_id: registrationId,
        joined_at: new Date(),
        acquired_via: via,
    } as Member;
}

/**
 * `registrationId` is null for a CHALLENGE team and required for an EVENT one (Team.ts invariant).
 *
 * The internal auction route passes `requestId` (`<lot>:<team_id>:add`): it is
 * recorded in `member_ops` by the same update as the `$push`, so a repeat — or a retry that finds
 * the member already seated by auction — answers 200 with the team instead of a 409 the auction
 * would read as a refusal. One that finds the first call mid-flight (registration linked here, seat
 * not pushed yet) waits up to ~1s for that push.
 */
export async function addMemberToTeam(
    teamId: string,
    userId: string,
    registrationId: string | null,
    acquiredVia: 'invite' | 'join' | 'auction',
    requestId?: string
): Promise<ITeam> {
    const team = await getTeam(teamId);
    const replayed = (t: ITeam) =>
        (requestId && t.member_ops?.includes(requestId)) ||
        (acquiredVia === 'auction' && t.members.some((m) => m.user_id === userId && m.acquired_via === 'auction'));
    if (replayed(team)) return team;

    const existing = team.members.find((m) => m.user_id === userId);
    if (existing) throw new ServiceError(409, 'already_member');
    if (team.status === 'locked') throw new ServiceError(400, 'team_locked');
    if (team.status === 'disbanded') throw new ServiceError(400, 'team_disbanded');
    if (team.members.length >= team.size_max) throw new ServiceError(409, 'team_full');

    const member = await memberFor(team, userId, registrationId, acquiredVia);
    const owned = await claimMembership(team.owner.id, userId, teamId);

    let linked = false;
    try {
        if (member.registration_id) {
            const res = await FormSubmission.updateOne(
                { _id: member.registration_id, status: 'confirmed', 'context.event.team_id': null },
                { $set: { 'context.event.team_id': teamId } }
            );
            if (res.modifiedCount === 0) throw new ServiceError(409, 'already_in_team');
            linked = true;
        }

        // A free slot, checked in the same write that fills it.
        const updated = await Team.findOneAndUpdate(
            {
                _id: teamId,
                status: { $in: OPEN_STATUSES },
                'members.user_id': { $ne: userId },
                $expr: { $lt: [{ $size: '$members' }, '$size_max'] },
            },
            {
                $push: { members: member, ...(requestId ? { member_ops: requestId } : {}) },
                $pull: { pending: { user_id: userId } },
            },
            { returnDocument: 'after' }
        );
        if (!updated) {
            const now = await getTeam(teamId);
            if (replayed(now)) return now;
            if (now.members.some((m) => m.user_id === userId)) throw new ServiceError(409, 'already_member');
            if (now.status === 'locked') throw new ServiceError(400, 'team_locked');
            if (now.status === 'disbanded') throw new ServiceError(400, 'team_disbanded');
            throw new ServiceError(409, 'team_full');
        }

        publish('TeamMemberAdded', PRODUCER, {
            team_id: teamId,
            owner: updated.owner,
            registration_id: member.registration_id,
            user_id: userId,
            acquired_via: member.acquired_via,
        });
        return updated;
    } catch (err) {
        /**
         * A concurrent call for the same auction seat may be mid-flight: it linked the registration
         * to THIS team (so our link failed) but has not pushed the member yet. Wait for it briefly
         * rather than answer 409, which the auction reads as a refusal.
         */
        if (!linked && (requestId || acquiredVia === 'auction')) {
            for (let i = 0; i < 20; i++) {
                const now = await Team.findById(teamId);
                if (now && replayed(now)) return now;
                const reg = member.registration_id
                    ? await FormSubmission.findById(member.registration_id).select('context.event.team_id').lean()
                    : null;
                if (reg?.context?.event?.team_id !== teamId) break; // nobody is seating them here
                await new Promise((r) => setTimeout(r, 50));
            }
        }
        if (linked) {
            await FormSubmission.updateOne(
                { _id: member.registration_id, 'context.event.team_id': teamId },
                { $set: { 'context.event.team_id': null } }
            );
        }
        if (owned) await releaseMembership(team.owner.id, userId, teamId);
        throw err;
    }
}

/**
 * An invite is an offer, not a placement: it lands in `pending[]` and the invitee accepts it with
 * `POST /teams/:id/join`. Invites used to seat the user outright — no consent, and blind to the
 * invitee's `team_visibility` (Spec §5.5: the per-user toggle for "can others invite me").
 */
export async function inviteMember(teamId: string, captainId: string, userId: string): Promise<ITeam> {
    const team = await getTeam(teamId);
    if (team.captain_user_id !== captainId) throw new ServiceError(403, 'not_captain');
    if (team.status !== 'forming') throw new ServiceError(400, 'team_not_accepting_members');
    if (team.members.some((m) => m.user_id === userId)) throw new ServiceError(409, 'already_member');
    if (team.members.length >= team.size_max) throw new ServiceError(409, 'team_full');
    if (await auctionLeague(team)) throw new ServiceError(409, 'auction_league');

    if (team.owner.type === 'event') {
        const reg = await FormSubmission.findOne({
            'owner.id': team.owner.id,
            'user.user_id': userId,
            'context.event.role': 'member',
            status: 'confirmed',
        });
        if (!reg) throw new ServiceError(404, 'member_not_registered');
        if (reg.context.event!.team_visibility === 'closed') throw new ServiceError(409, 'not_accepting_invites');
        if (reg.context.event!.team_id) throw new ServiceError(409, 'already_in_team');
    } else {
        const exists = await User.exists({ _id: userId, deleted_at: null });
        if (!exists) throw new ServiceError(404, 'user_not_found');
    }

    const now = new Date();
    // An expired invite for this user is dead weight; clear it so a fresh one can be sent.
    await Team.updateOne({ _id: teamId }, { $pull: { pending: { user_id: userId, expires_at: { $lte: now } } } });
    const updated = await Team.findOneAndUpdate(
        { _id: teamId, status: 'forming', 'members.user_id': { $ne: userId }, 'pending.user_id': { $ne: userId } },
        {
            $push: {
                pending: {
                    user_id: userId,
                    direction: 'invite',
                    created_by: captainId,
                    created_at: now,
                    expires_at: new Date(now.getTime() + PENDING_TTL_MS),
                },
            },
        },
        { returnDocument: 'after' }
    );
    if (!updated) throw new ServiceError(409, 'already_invited');

    // The notification service consumes exactly these fields.
    publish('TeamInviteCreated', PRODUCER, {
        team_id: teamId,
        team_name: updated.name,
        owner: updated.owner,
        user_id: userId,
        invited_by: captainId,
    });
    return updated;
}

/**
 * Accept a live invite, or join a team whose policy is `open`. Holding the team's invite code
 * (`withCode`) counts as the captain's invite: the captain shares it, and only the captain and the
 * owner's admins can read it.
 */
export async function joinTeam(teamId: string, userId: string, withCode = false): Promise<ITeam> {
    const team = await getTeam(teamId);
    if (team.status !== 'forming') throw new ServiceError(400, 'team_not_accepting_members');
    if (await auctionLeague(team)) throw new ServiceError(409, 'auction_league');

    const invited =
        withCode ||
        team.pending.some((p) => p.user_id === userId && p.direction === 'invite' && p.expires_at.getTime() > Date.now());
    // Self-service join is exactly what join_policy governs; an invite is the captain's say-so.
    if (!invited && team.join_policy !== 'open') throw new ServiceError(403, 'team_not_open');

    let registrationId: string | null = null;
    if (team.owner.type === 'event') {
        const reg = await FormSubmission.findOne({
            'owner.id': team.owner.id,
            'user.user_id': userId,
            'context.event.role': 'member',
            status: 'confirmed',
        });
        if (!reg) throw new ServiceError(404, 'not_registered_as_member');
        registrationId = reg._id;
    }

    return addMemberToTeam(teamId, userId, registrationId, invited ? 'invite' : 'join');
}

export async function joinTeamByCode(code: string, userId: string): Promise<ITeam> {
    const team = await Team.findOne({ invite_code: code.toUpperCase() }).select('_id').lean();
    if (!team) throw new ServiceError(404, 'invite_code_not_found');
    return joinTeam(team._id, userId, true);
}

export async function removeMemberFromTeam(
    teamId: string,
    userId: string,
    removedBy: string,
    reason?: string
): Promise<ITeam> {
    const team = await getTeam(teamId);
    if (team.status === 'locked') throw new ServiceError(400, 'team_locked');
    // The model requires the captain in members[]; removing them makes the team unsaveable.
    if (userId === team.captain_user_id) throw new ServiceError(400, 'cannot_remove_captain');

    const member = team.members.find((m) => m.user_id === userId);
    if (!member) throw new ServiceError(404, 'not_a_member');

    const updated = await Team.findOneAndUpdate(
        { _id: teamId, status: { $ne: 'locked' }, 'members.user_id': userId },
        { $pull: { members: { user_id: userId } } },
        { returnDocument: 'after' }
    );
    if (!updated) throw new ServiceError(409, 'team_changed');

    await unlinkAndRelease(updated, member, reason ?? 'removed', removedBy);
    return updated;
}

async function unlinkAndRelease(team: ITeam, member: Member, reason: string, by: string): Promise<void> {
    if (member.registration_id) {
        await FormSubmission.updateOne(
            { _id: member.registration_id, 'context.event.team_id': team._id },
            { $set: { 'context.event.team_id': null } }
        );
    }
    await releaseMembership(team.owner.id, member.user_id, team._id);
    publish('TeamMemberRemoved', PRODUCER, {
        team_id: team._id,
        owner: team.owner,
        registration_id: member.registration_id,
        user_id: member.user_id,
        removed_by: by,
        reason,
    });
}

/**
 * A registration that stops being `confirmed` (cancel, admin demotion) no longer holds a team seat,
 * so its member row comes off the roster too — leaving it let the user re-register and join a
 * second team while the first still listed them.
 *
 * Found by `members.registration_id`, not by the `team_id` the caller read before its status CAS:
 * a join landing between that read and the CAS left the member on a roster nobody detached them from.
 *
 * A captain whose team still has other members is refused before this (`captain_has_team`); one
 * leaving alone takes the team with them.
 *
 * ponytail: a locked roster is left as it is (it is what the Challenge/Points side already
 * snapshotted).
 */
export async function detachRegistration(registrationId: string, userId: string, by: string, reason: string): Promise<void> {
    const before = await Team.findOneAndUpdate(
        {
            'members.registration_id': registrationId,
            status: { $in: OPEN_STATUSES },
            captain_user_id: { $ne: userId },
        },
        { $pull: { members: { registration_id: registrationId } } },
        { returnDocument: 'before' }
    );
    if (before) {
        const member = before.members.find((m) => m.registration_id === registrationId)!;
        await unlinkAndRelease(before, member, reason, by);
        return;
    }
    const own = await Team.findOne({ 'members.registration_id': registrationId, captain_user_id: userId, status: { $in: OPEN_STATUSES } }).select('_id');
    if (own) {
        await disbandTeam(own._id, reason).catch((err) => {
            if (!(err instanceof ServiceError)) throw err; // already gone: nothing left to do
        });
    }
}

export async function lockTeam(teamId: string, lockedBy: string): Promise<ITeam> {
    const team = await getTeam(teamId);

    if (team.status === 'locked') throw new ServiceError(400, 'already_locked');
    if (team.status === 'disbanded') throw new ServiceError(400, 'team_disbanded');
    if (team.members.length < team.size_min) {
        throw new ServiceError(409, 'team_below_minimum_size', { size_min: team.size_min, members: team.members.length });
    }

    const updated = await Team.findOneAndUpdate(
        { _id: teamId, status: { $in: OPEN_STATUSES }, $expr: { $gte: [{ $size: '$members' }, '$size_min'] } },
        { $set: { status: 'locked', pending: [] } },
        { returnDocument: 'after' }
    );
    if (!updated) throw new ServiceError(409, 'team_changed');

    // `owner` so a consumer can act without reading the team back (leaderboard ignored this event
    // entirely without it).
    publish('TeamLocked', PRODUCER, { team_id: updated._id, owner: updated.owner, locked_by: lockedBy });
    return updated;
}

/**
 * Lock every ready roster of an event once it is running: on `EventStarted`, and —
 * for an auction league (`ALL`) whose auction is not finished yet — on `AuctionClosed` instead, so
 * the auction can still seat players. Rosters below `size_min` stay forming (they cannot lock) and
 * are left for an admin. The roster-lock sweep calls this too; `lockTeam` is a CAS, so re-running
 * it is harmless.
 */
export async function lockReadyRosters(eventId: string): Promise<number> {
    const event = await Event.findOne({ _id: eventId, deleted_at: null }).select('status type auction teaming').lean();
    if (!event || event.status !== 'ongoing' || !event.teaming?.is_teamed) return 0;
    if (event.type === 'ALL' && event.auction?.status !== 'finished') return 0;

    const ready = await Team.find({
        'owner.type': 'event',
        'owner.id': eventId,
        status: { $in: OPEN_STATUSES },
        $expr: { $gte: [{ $size: '$members' }, '$size_min'] },
    })
        .select('_id')
        .limit(500);

    let locked = 0;
    for (const t of ready) {
        try {
            await lockTeam(t._id, 'system');
            locked++;
        } catch (err) {
            if (!(err instanceof ServiceError)) console.error(`[registration-service] roster lock failed for ${t._id}:`, err);
        }
    }
    return locked;
}

export async function disbandTeam(teamId: string, reason?: string): Promise<ITeam> {
    const team = await getTeam(teamId);
    if (team.status === 'locked') throw new ServiceError(400, 'cannot_disband_locked_team');
    if (team.status === 'disbanded') throw new ServiceError(409, 'already_disbanded');

    const updated = await Team.findOneAndUpdate(
        { _id: teamId, status: { $in: OPEN_STATUSES } },
        { $set: { status: 'disbanded', pending: [] } },
        { returnDocument: 'after' }
    );
    if (!updated) throw new ServiceError(409, 'team_changed');

    await FormSubmission.updateMany({ 'context.event.team_id': teamId }, { $set: { 'context.event.team_id': null } });
    await TeamMembership.deleteMany({ team_id: teamId });

    publish('TeamDisbanded', PRODUCER, { team_id: teamId, owner: updated.owner, reason: reason ?? 'disbanded' });
    return updated;
}

/**
 * A cancelled event's open teams go with it (team-model.md §4.1). A locked roster is left as the
 * record of what was played. Idempotent: `disbandTeam` is a CAS on an open status.
 */
export async function disbandEventTeams(eventId: string): Promise<number> {
    const open = await Team.find({ 'owner.type': 'event', 'owner.id': eventId, status: { $in: OPEN_STATUSES } })
        .select('_id')
        .limit(500);
    let disbanded = 0;
    for (const t of open) {
        try {
            await disbandTeam(t._id, 'event_cancelled');
            disbanded++;
        } catch (err) {
            if (!(err instanceof ServiceError)) console.error(`[registration-service] disband failed for ${t._id}:`, err);
        }
    }
    return disbanded;
}

/* ------------------------------------------------------------------ *
 * Auction purse (called by the Event Service through /internal)
 * ------------------------------------------------------------------ */

/**
 * Idempotent on `requestId` (`<lot>:<team_id>:debit`): the id is recorded in the same write that moves
 * the money, so a retry after a timeout finds it and answers with the team instead of debiting
 * again. The bound is checked against the stored total in the same write (`$expr`), not a value
 * read a moment earlier.
 */
export async function debitPurse(teamId: string, amount: number, requestId: string): Promise<ITeam> {
    const updated = await Team.findOneAndUpdate(
        {
            _id: teamId,
            auction: { $ne: null },
            'auction.applied_ops': { $ne: requestId },
            $expr: { $lte: [{ $add: ['$auction.purse_spent', amount] }, '$auction.purse_total'] },
        },
        { $inc: { 'auction.purse_spent': amount, 'auction.version': 1 }, $push: { 'auction.applied_ops': requestId } },
        { returnDocument: 'after' }
    );
    if (updated) return updated;
    return replayOrRefuse(teamId, requestId, 'insufficient_purse');
}

/**
 * The mirror of `debitPurse`. A refund larger than what was spent is refused, never clamped: the
 * old clamp was a separate `save()` that could overwrite a concurrent debit and mint purse.
 */
export async function refundPurse(teamId: string, amount: number, requestId: string): Promise<ITeam> {
    const updated = await Team.findOneAndUpdate(
        {
            _id: teamId,
            auction: { $ne: null },
            'auction.applied_ops': { $ne: requestId },
            'auction.purse_spent': { $gte: amount },
        },
        { $inc: { 'auction.purse_spent': -amount, 'auction.version': 1 }, $push: { 'auction.applied_ops': requestId } },
        { returnDocument: 'after' }
    );
    if (updated) return updated;
    return replayOrRefuse(teamId, requestId, 'refund_exceeds_spent');
}

async function replayOrRefuse(teamId: string, requestId: string, refusal: string): Promise<ITeam> {
    const team = await getTeam(teamId);
    if (!team.auction) throw new ServiceError(409, 'not_auction_team');
    if (team.auction.applied_ops?.includes(requestId)) return team; // already applied: a retry
    throw new ServiceError(409, refusal);
}

/** Auction start: every live team of the event that has no purse yet gets the default. Idempotent. */
export async function setAuctionPurses(eventId: string, purseTotal: number): Promise<{ updated_count: number }> {
    const res = await Team.updateMany(
        { 'owner.type': 'event', 'owner.id': eventId, status: { $ne: 'disbanded' }, auction: null },
        {
            $set: {
                auction: {
                    purse_total: purseTotal,
                    purse_spent: 0,
                    version: 0,
                    is_overridden: false,
                    override_reason: null,
                    overridden_by: null,
                    applied_ops: [],
                },
            },
        }
    );
    return { updated_count: res.modifiedCount };
}

/** A captain's budget override (the Event Service decides whether it is allowed; this applies it once). */
export async function setAuctionBudget(
    teamId: string,
    input: { purse_total: number; reason: string | null; overridden_by: string }
): Promise<ITeam> {
    const team = await getTeam(teamId);
    if (team.owner.type !== 'event') throw new ServiceError(409, 'not_event_team');
    if (team.status === 'disbanded') throw new ServiceError(409, 'team_disbanded');
    if (team.auction?.is_overridden) throw new ServiceError(409, 'team_already_overridden');

    const spent = team.auction?.purse_spent ?? 0;
    if (input.purse_total < spent) throw new ServiceError(409, 'purse_below_spent');

    const updated = await Team.findOneAndUpdate(
        {
            _id: teamId,
            status: { $ne: 'disbanded' },
            ...(team.auction ? { 'auction.version': team.auction.version, 'auction.is_overridden': { $ne: true } } : { auction: null }),
        },
        {
            $set: {
                auction: {
                    purse_total: input.purse_total,
                    purse_spent: spent,
                    version: (team.auction?.version ?? 0) + 1,
                    is_overridden: true,
                    override_reason: input.reason,
                    overridden_by: input.overridden_by,
                    applied_ops: team.auction?.applied_ops ?? [],
                },
            },
        },
        { returnDocument: 'after' }
    );
    if (!updated) throw new ServiceError(409, 'concurrent_override_conflict');
    return updated;
}
