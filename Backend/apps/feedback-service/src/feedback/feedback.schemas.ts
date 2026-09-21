import { FEEDBACK_CATEGORY, FEEDBACK_SEVERITY, FEEDBACK_STATUS, FEEDBACK_KIND } from '@bgsc/shared';
import { z } from 'zod';
import { TICKET_NO_PATTERN } from './ticketNo';

/**
 * Request schemas. Zod strips unknown keys, so a client cannot set `status`, `reporter`,
 * `ticket_no` or `response` by adding the field to a submission — all four are the server's
 * (be2-feedback-bracket-plan.md §3).
 */

/**
 * Attachments are URLs, never uploads (plan D7) — and never `javascript:` or `data:`, which round
 * trip through a bare `z.string()` and land in an admin's browser. The same rule
 * `announcement.schemas.ts` applies to `media_url`, for the same reason.
 */
const AttachmentUrl = z
    .string()
    .trim()
    .max(500)
    .refine((v) => {
        if (v.startsWith('/uploads/')) return /^\/uploads\/[\w./-]+$/.test(v) && !v.split('/').includes('..');
        try {
            const u = new URL(v);
            return u.protocol === 'http:' || u.protocol === 'https:';
        } catch {
            return false;
        }
    }, 'attachment must be an http(s) URL or an /uploads path');

const Base = {
    subject: z.string().trim().min(1).max(140),
    description: z.string().trim().min(1).max(5000),
    attachments: z.array(AttachmentUrl).max(5).optional(),
    event_id: z.string().uuid().nullable().optional(),
    is_anonymous: z.boolean().default(false),
    // Required when anonymous — checked in the service, where the identity of the caller is known.
    contact_email: z.string().trim().toLowerCase().email().max(200).nullable().optional(),
};

export const SubmitFeedbackSchema = z.object({
    ...Base,
    category: z.enum(FEEDBACK_CATEGORY),
    // The reporter's own read of how bad it is. Staff re-triage; see PATCH /severity.
    severity: z.enum(FEEDBACK_SEVERITY).default('low'),
});

/**
 * Contact-us is the same ticket with a narrower front door: no severity to choose (it is not an
 * incident report) and no category beyond "general", so neither is accepted here.
 */
export const SubmitContactSchema = z.object(Base);

export const TicketNoParams = z.object({
    ticket_no: z.string().trim().toUpperCase().regex(TICKET_NO_PATTERN, 'not a ticket number'),
});

export const ListTicketsQuery = z.object({
    status: z.enum(FEEDBACK_STATUS).optional(),
    category: z.enum(FEEDBACK_CATEGORY).optional(),
    severity: z.enum(FEEDBACK_SEVERITY).optional(),
    kind: z.enum(FEEDBACK_KIND).optional(),
    event_id: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().max(400).optional(),
});

export const UpdateStatusSchema = z.object({
    status: z.enum(FEEDBACK_STATUS),
    /** Optional, and stored on the ticket: the reply the reporter is emailed. */
    response: z.string().trim().min(1).max(5000).optional(),
});

export const UpdateSeveritySchema = z.object({ severity: z.enum(FEEDBACK_SEVERITY) });

export type SubmitFeedbackInput = z.infer<typeof SubmitFeedbackSchema>;
export type SubmitContactInput = z.infer<typeof SubmitContactSchema>;
export type ListTicketsInput = z.infer<typeof ListTicketsQuery>;
export type UpdateStatusInput = z.infer<typeof UpdateStatusSchema>;
export type UpdateSeverityInput = z.infer<typeof UpdateSeveritySchema>;
