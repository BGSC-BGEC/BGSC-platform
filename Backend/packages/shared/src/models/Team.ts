import { Schema, model, Document } from 'mongoose';
import { uuidId, timestamps, Owner, OwnerSchema } from './shared';

/**
 * Registration Service owns `teams`. Event and Challenge services only read them.
 * See docs/modeldocs/team-model.md.
 *
 * One polymorphic collection for both events and challenges: Spec §5.7 says challenge teams follow
 * "the structure of teamed events", so two near-identical models would be one model too many.
 */

export const JOIN_POLICY = ['open', 'invite_only', 'closed'] as const;
export const TEAM_STATUS = ['forming', 'complete', 'locked', 'disbanded'] as const;
export const ACQUIRED_VIA = ['created', 'invite', 'join_request', 'auction'] as const;
export const PENDING_DIRECTION = ['invite', 'request'] as const;

export type JoinPolicy = (typeof JOIN_POLICY)[number];
export type TeamStatus = (typeof TEAM_STATUS)[number];
export type AcquiredVia = (typeof ACQUIRED_VIA)[number];
export type PendingDirection = (typeof PENDING_DIRECTION)[number];

/** team-model.md §3: invites and join requests expire after 72h. */
export const PENDING_TTL_MS = 72 * 60 * 60 * 1000;

export interface ITeam extends Document<string> {
    _id: string;
    owner: Owner;

    name: string;
    name_lower: string;
    logo_url: string | null;

    captain_user_id: string;
    members: {
        user_id: string;
        display_name: string;
        avatar_url: string | null;
        registration_id: string | null;
        joined_at: Date;
        acquired_via: AcquiredVia;
    }[];

    join_policy: JoinPolicy;
    invite_code: string;
    size_min: number;
    size_max: number;

    pending: {
        user_id: string;
        direction: PendingDirection;
        created_by: string;
        created_at: Date;
        expires_at: Date;
    }[];

    status: TeamStatus;

    auction: {
        purse_total: number;
        purse_spent: number;
        version: number;
    } | null;

    created_at: Date;
    updated_at: Date;
}

const MemberSchema = new Schema(
    {
        user_id: { type: String, required: true },
        display_name: { type: String, required: true },
        avatar_url: { type: String, default: null },
        // Required for event owners (team groups registrations); null for challenge owners, which have no form.
        registration_id: { type: String, default: null },
        joined_at: { type: Date, required: true, default: Date.now },
        acquired_via: { type: String, enum: ACQUIRED_VIA, required: true },
    },
    { _id: false }
);

const PendingSchema = new Schema(
    {
        user_id: { type: String, required: true },
        // invite = team -> user, request = user -> team. Accepting either moves the user into members.
        direction: { type: String, enum: PENDING_DIRECTION, required: true },
        created_by: { type: String, required: true },
        created_at: { type: Date, required: true, default: Date.now },
        expires_at: { type: Date, required: true, default: () => new Date(Date.now() + PENDING_TTL_MS) },
    },
    { _id: false }
);

const TeamSchema = new Schema<ITeam>(
    {
        _id: uuidId,
        owner: { type: OwnerSchema, required: true },

        name: { type: String, required: true, trim: true, minlength: 1, maxlength: 60 },
        name_lower: { type: String, required: true }, // derived; backs the per-owner unique index
        logo_url: { type: String, default: null },

        captain_user_id: { type: String, required: true },
        members: { type: [MemberSchema], default: [] },

        join_policy: { type: String, enum: JOIN_POLICY, default: 'invite_only' },
        invite_code: { type: String, required: true, uppercase: true, minlength: 8, maxlength: 8 },
        size_min: { type: Number, required: true, min: 1 }, // copied from the owner at creation
        size_max: { type: Number, required: true, min: 1 },

        pending: { type: [PendingSchema], default: [] },

        status: { type: String, enum: TEAM_STATUS, default: 'forming' },

        // Auction leagues only. Set on AuctionStarted from events.auction.purse_per_team.
        auction: {
            type: new Schema(
                {
                    purse_total: { type: Number, required: true, min: 0 },
                    purse_spent: { type: Number, default: 0, min: 0 },
                    version: { type: Number, default: 0 }, // optimistic lock for concurrent purse debits
                },
                { _id: false }
            ),
            default: null,
        },
    },
    timestamps
);

/** purse_remaining is derived, never stored — one number can't drift from itself. */
TeamSchema.virtual('purse_remaining').get(function (this: ITeam) {
    return this.auction ? this.auction.purse_total - this.auction.purse_spent : null;
});

// team-model.md §4
TeamSchema.pre('validate', function (this: ITeam) {
    const t = this;
    const fail = (msg: string): never => {
        throw new Error(`Team invariant: ${msg}`);
    };

    t.name_lower = t.name.toLowerCase();

    if (!(t.size_min >= 1 && t.size_min <= t.size_max)) return fail('1 <= size_min <= size_max');

    const ids = t.members.map((m) => m.user_id);
    if (new Set(ids).size !== ids.length) return fail('members[].user_id must be unique within a team');
    if (!ids.includes(t.captain_user_id)) return fail('captain_user_id must be one of members[].user_id');
    if (t.members.length > t.size_max) return fail('members.length exceeds size_max');
    if ((t.status === 'complete' || t.status === 'locked') && t.members.length < t.size_min) {
        return fail(`status '${t.status}' requires at least size_min members`);
    }

    if (t.pending.some((p) => ids.includes(p.user_id))) {
        return fail('a pending invite/request cannot name an existing member');
    }

    if (t.owner.type === 'event' && t.members.some((m) => m.registration_id === null)) {
        return fail('every member of an event team needs a registration_id');
    }
    if (t.owner.type === 'challenge' && t.members.some((m) => m.registration_id !== null)) {
        return fail('challenge teams have no registrations, so registration_id must be null');
    }
    if (t.auction && t.owner.type !== 'event') return fail('only event teams can hold an auction purse');
    if (t.auction && t.auction.purse_spent > t.auction.purse_total) return fail('purse_spent exceeds purse_total');
});

TeamSchema.index({ 'owner.type': 1, 'owner.id': 1, status: 1 });
TeamSchema.index({ 'owner.id': 1, name_lower: 1 }, { unique: true }); // unique team names per event/challenge
TeamSchema.index({ invite_code: 1 }, { unique: true });
TeamSchema.index({ 'members.user_id': 1, 'owner.id': 1 }); // "my team here"; backs the duplicate-membership check
TeamSchema.index({ 'owner.id': 1, join_policy: 1, status: 1 }); // team search: open teams still forming

// ponytail: one-team-per-user-per-owner is a check-then-write inside a transaction in the Registration Service —
// a multikey index cannot express it. If the chosen DB has no transactions, add a `team_memberships`
// side collection with a unique { owner_id, user_id }.

export const Team = model<ITeam>('Team', TeamSchema, 'teams');
