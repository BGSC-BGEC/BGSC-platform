import { JOIN_POLICY, TEAM_STATUS } from '@bgsc/shared';
import { z } from 'zod';
import { PageQuery } from '../registrations/registration.schemas';

export const CreateTeamSchema = z.object({
    owner: z.object({
        type: z.enum(['event', 'challenge']),
        id: z.string().uuid(),
    }),
    name: z.string().trim().min(1).max(60), // matches the Team model's maxlength
    join_policy: z.enum(JOIN_POLICY).optional(),
    // Accepted for older clients and ignored: roster bounds come from the owner's `teaming`
    // (team.service captainContext), never from the captain.
    size_min: z.number().int().min(1).optional(),
    size_max: z.number().int().min(1).optional(),
});

/** The 8-character code `createTeam` issues (hex, stored uppercase). */
export const JoinByCodeSchema = z.object({ code: z.string().trim().regex(/^[0-9a-fA-F]{8}$/) });

export const InviteMemberSchema = z.object({
    user_id: z.string().uuid(),
});

/** Also used by disband: both take an optional reason and may arrive with no body at all. */
export const RemoveMemberSchema = z.object({ reason: z.string().max(500).optional() }).default({});

export const TeamIdParams = z.object({ id: z.string().uuid() });
export const TeamMemberParams = z.object({ id: z.string().uuid(), user_id: z.string().uuid() });

export const ListTeamsQuery = z.object({
    owner_id: z.string().uuid().optional(),
    status: z.enum(TEAM_STATUS).optional(),
    join_policy: z.enum(JOIN_POLICY).optional(),
    // Teams holding a live invite for the caller.
    invited: z.literal('me').optional(),
    ...PageQuery,
});

export type CreateTeamInput = z.infer<typeof CreateTeamSchema>;
export type InviteMemberInput = z.infer<typeof InviteMemberSchema>;
export type JoinByCodeInput = z.infer<typeof JoinByCodeSchema>;
export type RemoveMemberInput = z.infer<typeof RemoveMemberSchema>;
export type ListTeamsInput = z.infer<typeof ListTeamsQuery>;
