import { CAPTAIN_APPLICATION_STATUS, EVENT_ROLE, SUBMISSION_STATUS, TEAM_VISIBILITY } from '@bgsc/shared';
import { z } from 'zod';

export const SubmitRegistrationSchema = z.object({
    form_id: z.string().uuid(),
    owner: z.object({
        type: z.enum(['event', 'challenge', 'generic']),
        id: z.string().uuid().nullable(),
    }),
    answers: z.record(z.string(), z.unknown()),
    files: z
        .array(
            z.object({
                field_key: z.string(),
                url: z.string(),
                name: z.string(),
                size: z.number().positive(),
                mime: z.string(),
            })
        )
        .optional(),
    context: z
        .object({
            event: z
                .object({
                    role: z.enum(EVENT_ROLE),
                    team_visibility: z.enum(TEAM_VISIBILITY).optional(),
                    base_price: z.number().positive().nullable().optional(),
                })
                .optional(),
            challenge: z
                .object({
                    team_id: z.string().uuid().nullable().optional(),
                })
                .optional(),
        })
        .optional(),
});

export const UpdateRegistrationSchema = z.object({
    answers: z.record(z.string(), z.unknown()).optional(),
    files: z
        .array(
            z.object({
                field_key: z.string(),
                url: z.string(),
                name: z.string(),
                size: z.number().positive(),
                mime: z.string(),
            })
        )
        .optional(),
});

export const UpdateCaptainApplicationSchema = z.object({
    status: z.enum(['approved', 'declined']),
    note: z.string().max(500).optional(),
});

export const UpdateStatusSchema = z.object({
    status: z.enum(['confirmed', 'waitlisted', 'rejected']),
    reason: z.string().max(500).optional(),
});

export const CancelRegistrationSchema = z
    .object({ reason: z.string().max(500).optional() })
    // Express 5 leaves req.body undefined when a DELETE carries no body, which is the normal way
    // to send one. Defaulting here means the route does not 500 on a bodyless cancel.
    .default({});

export const IdParams = z.object({ id: z.string().uuid() });

export const ListRegistrationsQuery = z.object({
    owner_id: z.string().uuid().optional(),
    status: z.enum(SUBMISSION_STATUS).optional(),
    user_id: z.string().uuid().optional(),
});

export const MyRegistrationQuery = z.object({ owner_id: z.string().uuid() });

export type SubmitRegistrationInput = z.infer<typeof SubmitRegistrationSchema>;
export type UpdateRegistrationInput = z.infer<typeof UpdateRegistrationSchema>;
export type UpdateCaptainApplicationInput = z.infer<typeof UpdateCaptainApplicationSchema>;
export type UpdateStatusInput = z.infer<typeof UpdateStatusSchema>;
export type CancelRegistrationInput = z.infer<typeof CancelRegistrationSchema>;
