import { Challenge, FormSubmission, ITeam, ServiceError, Team, User, publish } from '@bgsc/shared';
import { v4 as uuid } from 'uuid';

interface CreateTeamInput {
    owner: { type: 'event' | 'challenge'; id: string };
    name: string;
    captain_user_id: string;
    join_policy?: 'open' | 'invite_only' | 'closed';
    size_min?: number;
    size_max?: number;
}

/**
 * ponytail: roster bounds default here instead of being copied from the event, because the Event
 * Service that owns `teaming` does not exist yet. Read them from the event once it does — a team
 * whose size_max disagrees with its event is a roster that locks at the wrong number.
 *
 * Challenge owners no longer use these: `challenges.teaming` exists and is read below.
 */
const DEFAULT_SIZE_MIN = 1;
const DEFAULT_SIZE_MAX = 10;

/**
 * Who may captain a team, and where the member's registration id comes from — the one thing that
 * genuinely differs between the two owner types.
 *
 * An EVENT team groups registrations, so its captain must hold an approved captain application and
 * every member carries a `registration_id` (Team.ts:158).
 *
 * A CHALLENGE team has no form and no registration at all, so the same lookup was an unconditional
 * 403 for every challenge owner — and had it passed, `registration_id` would have tripped the
 * model's own invariant (Team.ts:161) as a 500. Challenge teams are formed by anyone who can see
 * the challenge; the acceptance guard that actually matters (captain, size, one team per member)
 * lives in the Challenge Service at accept time.
 */
async function captainContext(input: CreateTeamInput): Promise<{
    display_name: string;
    avatar_url: string | null;
    registration_id: string | null;
    size_min: number;
    size_max: number;
}> {
    if (input.owner.type === 'challenge') {
        const challenge = await Challenge.findOne({ _id: input.owner.id, deleted_at: null }).select('teaming status');
        if (!challenge) throw new ServiceError(404, 'challenge_not_found');
        if (!challenge.teaming.enabled) throw new ServiceError(409, 'teaming_not_enabled');
        // A team exists in order to accept, and only an `active` challenge accepts
        // (challenge-model.md §2.1). Forming one against a draft, completed or archived challenge
        // builds a roster that can never be used, which the members only discover at accept time.
        if (challenge.status !== 'active') throw new ServiceError(409, 'challenge_not_active');

        // The captain is a member of their own team from the first save (Team.ts:148), and a
        // challenge team has no registration to name them from.
        const user = await User.findOne({ _id: input.captain_user_id, deleted_at: null }).select(
            'username profile.full_name profile.avatar_url'
        );
        if (!user) throw new ServiceError(404, 'user_not_found');

        return {
            display_name: user.profile?.full_name || user.username,
            avatar_url: user.profile?.avatar_url ?? null,
            registration_id: null,
            // Taken from the owner and NOT overridable by the caller: `size_min`/`size_max` are
            // client-supplied on POST /teams, so honouring them here let a captain open a team for
            // 100 when the challenge caps teams at 4. The roster fills, everyone waits, and the
            // Challenge Service refuses the acceptance — the members find out last. The challenge's
            // own bounds are the only ones that can ever be accepted, so they are the only ones
            // worth locking at.
            size_min: challenge.teaming.team_size_min ?? DEFAULT_SIZE_MIN,
            size_max: challenge.teaming.team_size_max ?? DEFAULT_SIZE_MAX,
        };
    }

    // Verify captain is registered and approved
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
        size_min: input.size_min ?? DEFAULT_SIZE_MIN,
        size_max: input.size_max ?? DEFAULT_SIZE_MAX,
    };
}

export async function createTeam(input: CreateTeamInput): Promise<ITeam> {
    const captain = await captainContext(input);

    // Check if captain already has a team
    const existingTeam = await Team.findOne({
        'owner.id': input.owner.id,
        captain_user_id: input.captain_user_id,
        status: { $ne: 'disbanded' },
    });

    if (existingTeam) {
        throw new ServiceError(409, 'captain_already_has_team');
    }

    const team = new Team({
        _id: uuid(),
        owner: input.owner,
        name: input.name,
        name_lower: input.name.toLowerCase(),
        logo_url: null,
        captain_user_id: input.captain_user_id,
        // The captain is a member, not a separate role: the model requires captain_user_id to
        // appear in members[], and a team created with an empty roster never saved at all.
        members: [
            {
                user_id: input.captain_user_id,
                display_name: captain.display_name,
                avatar_url: captain.avatar_url,
                // null for a challenge team: there is no registration, and the model forbids one
                // (Team.ts:161).
                registration_id: captain.registration_id,
                joined_at: new Date(),
                acquired_via: 'created',
            },
        ],
        join_policy: input.join_policy ?? 'invite_only',
        invite_code: uuid().replace(/-/g, '').substring(0, 8),
        size_min: captain.size_min,
        size_max: captain.size_max,
        pending: [],
        status: 'forming',
        auction: null, // Set by Event Service for auction events
    });

    await team.save();

    // Link captain's registration to team. Challenge teams have no registration to link.
    if (captain.registration_id) {
        const captainReg = await FormSubmission.findById(captain.registration_id);
        if (captainReg?.context.event) {
            captainReg.context.event.team_id = team._id;
            await captainReg.save();
        }
    }

    await publish(
        'TeamCreated',
        'registration-service',
        {
            team_id: team._id,
            owner: input.owner,
            captain_user_id: input.captain_user_id,
            name: team.name,
        }
    );

    return team;
}

export async function getTeam(teamId: string): Promise<ITeam> {
    const team = await Team.findById(teamId);
    if (!team) {
        throw new ServiceError(404, 'team_not_found');
    }
    return team;
}

export async function listTeams(filter: {
    owner_id?: string;
    status?: string;
    join_policy?: string;
}): Promise<ITeam[]> {
    const query: Record<string, unknown> = {};
    if (filter.owner_id) query['owner.id'] = filter.owner_id;
    if (filter.status) query.status = filter.status;
    if (filter.join_policy) query.join_policy = filter.join_policy;

    return Team.find(query).sort({ created_at: -1 });
}

/** The challenge-team half of `addMemberToTeam`: no registration, name taken from the user. */
async function addChallengeMember(
    team: ITeam,
    userId: string,
    acquiredVia: 'invite' | 'join' | 'auction'
): Promise<ITeam> {
    const user = await User.findOne({ _id: userId, deleted_at: null }).select(
        'username profile.full_name profile.avatar_url'
    );
    if (!user) throw new ServiceError(404, 'user_not_found');

    // One team per challenge per user: the Challenge Service refuses a participation whose roster
    // overlaps another's, but a user sitting on two rosters before either accepts is still a
    // confusing state to have created.
    const elsewhere = await Team.findOne({
        'owner.id': team.owner.id,
        'members.user_id': userId,
        status: { $ne: 'disbanded' },
    });
    if (elsewhere) throw new ServiceError(409, 'already_in_team');

    team.members.push({
        user_id: userId,
        display_name: user.profile?.full_name || user.username,
        avatar_url: user.profile?.avatar_url ?? null,
        registration_id: null,
        joined_at: new Date(),
        acquired_via: acquiredVia === 'join' ? 'join_request' : acquiredVia,
    });
    await team.save();

    await publish('TeamMemberAdded', 'registration-service', {
        team_id: team._id,
        user_id: userId,
        acquired_via: acquiredVia,
    });
    return team;
}

/**
 * `registrationId` is null for a CHALLENGE team and required for an EVENT one. A challenge has no
 * form, so there is no registration to check eligibility against or to link back — and the model
 * forbids a non-null one on this owner type (Team.ts:161). The eligibility that matters for a
 * challenge team is checked by the Challenge Service at accept time (size, captain, one team per
 * member), which is the only place that can see `challenges.teaming`.
 */
export async function addMemberToTeam(
    teamId: string,
    userId: string,
    registrationId: string | null,
    acquiredVia: 'invite' | 'join' | 'auction'
): Promise<ITeam> {
    const team = await getTeam(teamId);

    if (team.status === 'locked') {
        throw new ServiceError(400, 'team_locked');
    }

    if (team.status === 'disbanded') {
        throw new ServiceError(400, 'team_disbanded');
    }

    // Check if already a member
    if (team.members.some((m) => m.user_id === userId)) {
        throw new ServiceError(409, 'already_member');
    }

    // Checked here so a full roster is a 409, not the model invariant surfacing as a 500.
    if (team.members.length >= team.size_max) {
        throw new ServiceError(409, 'team_full');
    }

    if (team.owner.type === 'challenge') return addChallengeMember(team, userId, acquiredVia);

    if (!registrationId) throw new ServiceError(400, 'registration_id_required');

    // Verify registration exists and is eligible
    const registration = await FormSubmission.findById(registrationId);
    if (!registration) {
        throw new ServiceError(404, 'registration_not_found');
    }

    /**
     * `userId` and `registrationId` arrive as independent arguments, and nothing tied them
     * together. The invite and join handlers look the registration up by the user, so they were
     * consistent by construction — but POST /internal/teams/:id/add-member takes both straight from
     * the request body, so the auction path could seat one user against another's registration and
     * write a member row carrying A's id with B's name.
     */
    if (registration.user.user_id !== userId) {
        throw new ServiceError(400, 'registration_user_mismatch');
    }

    // A team's members must be registered for the same thing the team belongs to. Without this a
    // registration for a different event could be seated on this roster.
    if (registration.owner.type !== team.owner.type || registration.owner.id !== team.owner.id) {
        throw new ServiceError(400, 'registration_owner_mismatch');
    }

    // Event registrations carry the context branch this function writes into; a challenge or
    // generic one does not, and assigning through it threw a TypeError as a 500.
    if (!registration.context.event) {
        throw new ServiceError(400, 'not_event_registration');
    }

    if (registration.status !== 'confirmed') {
        throw new ServiceError(400, 'registration_not_confirmed');
    }

    if (registration.context.event.team_id) {
        throw new ServiceError(409, 'already_in_team');
    }

    // Add member (need display_name and avatar_url from registration)
    team.members.push({
        user_id: userId,
        display_name: registration.user.display_name,
        avatar_url: registration.user.avatar_url,
        registration_id: registrationId,
        joined_at: new Date(),
        acquired_via: acquiredVia === 'join' ? 'join_request' : acquiredVia,
    });

    await team.save();

    // Link registration to team
    registration.context.event.team_id = team._id;
    await registration.save();

    await publish(
        'TeamMemberAdded',
        'registration-service',
        {
            team_id: team._id,
            registration_id: registrationId,
            user_id: userId,
            acquired_via: acquiredVia === 'join' ? 'join_request' : acquiredVia,
        }
    );

    return team;
}

export async function removeMemberFromTeam(
    teamId: string,
    userId: string,
    removedBy: string,
    reason?: string
): Promise<ITeam> {
    const team = await getTeam(teamId);

    if (team.status === 'locked') {
        throw new ServiceError(400, 'team_locked');
    }

    if (userId === team.captain_user_id) {
        // The model requires the captain in members[]; removing them makes the team unsaveable.
        throw new ServiceError(400, 'cannot_remove_captain');
    }

    const memberIndex = team.members.findIndex((m) => m.user_id === userId);
    if (memberIndex === -1) {
        throw new ServiceError(404, 'not_a_member');
    }

    const member = team.members[memberIndex];
    team.members.splice(memberIndex, 1);
    await team.save();

    // Unlink registration
    const registration = await FormSubmission.findById(member.registration_id);
    if (registration) {
        registration.context.event!.team_id = null;
        await registration.save();
    }

    await publish(
        'TeamMemberRemoved',
        'registration-service',
        {
            team_id: team._id,
            registration_id: member.registration_id,
            user_id: userId,
            reason: reason ?? 'removed',
        }
    );

    return team;
}

export async function lockTeam(teamId: string, lockedBy: string): Promise<ITeam> {
    const team = await getTeam(teamId);

    if (team.status === 'locked') {
        throw new ServiceError(400, 'already_locked');
    }
    if (team.status === 'disbanded') {
        throw new ServiceError(400, 'team_disbanded');
    }

    // The model refuses to save a locked team below size_min, so checking here is the difference
    // between a 409 the caller can act on and an unhandled invariant surfacing as a 500.
    if (team.members.length < team.size_min) {
        throw new ServiceError(409, 'team_below_minimum_size', {
            size_min: team.size_min,
            members: team.members.length,
        });
    }

    team.status = 'locked';
    await team.save();

    await publish(
        'TeamLocked',
        'registration-service',
        {
            team_id: team._id,
            locked_by: lockedBy,
        }
    );

    return team;
}

export async function disbandTeam(teamId: string, reason?: string): Promise<ITeam> {
    const team = await getTeam(teamId);

    if (team.status === 'locked') {
        throw new ServiceError(400, 'cannot_disband_locked_team');
    }

    team.status = 'disbanded';
    await team.save();

    // Unlink all member registrations
    for (const member of team.members) {
        const registration = await FormSubmission.findById(member.registration_id);
        if (registration) {
            registration.context.event!.team_id = null;
            await registration.save();
        }
    }

    await publish(
        'TeamDisbanded',
        'registration-service',
        {
            team_id: team._id,
            reason: reason ?? 'disbanded',
        }
    );

    return team;
}

export async function debitPurse(teamId: string, amount: number): Promise<ITeam> {
    const team = await getTeam(teamId);

    if (!team.auction) {
        throw new ServiceError(400, 'not_auction_team');
    }

    const updated = await Team.findOneAndUpdate(
        {
            _id: teamId,
            'auction.purse_spent': { $lte: team.auction.purse_total - amount },
        },
        {
            $inc: { 'auction.purse_spent': amount, 'auction.version': 1 },
        },
        { returnDocument: 'after' }
    );

    if (!updated) {
        throw new ServiceError(400, 'insufficient_purse');
    }

    return updated;
}

export async function refundPurse(teamId: string, amount: number): Promise<ITeam> {
    const team = await getTeam(teamId);

    if (!team.auction) {
        throw new ServiceError(400, 'not_auction_team');
    }

    const updated = await Team.findOneAndUpdate(
        { _id: teamId },
        {
            $inc: { 'auction.purse_spent': -amount, 'auction.version': 1 },
        },
        { returnDocument: 'after' }
    );

    if (!updated) {
        throw new ServiceError(404, 'team_not_found');
    }

    if (updated.auction && updated.auction.purse_spent < 0) {
        updated.auction.purse_spent = 0;
        await updated.save();
    }

    return updated;
}

export async function getTeamSnapshots(teamIds: string[]): Promise<any[]> {
    if (teamIds.length === 0) return [];

    const teams = await Team.find({ _id: { $in: teamIds } });

    return teams.map((t) => ({
        team_id: t._id,
        name: t.name,
        captain_user_id: t.captain_user_id,
        member_count: t.members.length,
    }));
}
