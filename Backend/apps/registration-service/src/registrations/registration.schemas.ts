import { EVENT_ROLE, SUBMISSION_STATUS, TEAM_VISIBILITY } from '@bgsc/shared';
import { z } from 'zod';

/**
 * A file answer names an upload by the url `POST /registrations/upload-file` returned. `name`,
 * `size` and `mime` are accepted so a client can echo the upload response back unchanged, and are
 * then ignored: the stored values come from the `form_uploads` record.
 */
const FileRef = z.object({
    field_key: z.string().max(32),
    url: z.string().max(500),
    name: z.string().max(120).optional(),
    size: z.number().optional(),
    mime: z.string().max(100).optional(),
});

export const SubmitRegistrationSchema = z.object({
    form_id: z.string().uuid(),
    owner: z.object({
        type: z.enum(['event', 'challenge', 'generic']),
        id: z.string().uuid().nullable(),
    }),
    answers: z.record(z.string(), z.unknown()),
    files: z.array(FileRef).max(20).optional(),
    context: z
        .object({
            event: z
                .object({
                    role: z.enum(EVENT_ROLE),
                    team_visibility: z.enum(TEAM_VISIBILITY).optional(),
                    base_price: z.number().positive().nullable().optional(),
                })
                .optional(),
        })
        .optional(),
});

export const UpdateRegistrationSchema = z.object({
    answers: z.record(z.string(), z.unknown()).optional(),
    files: z.array(FileRef).max(20).optional(),
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

/**
 * The upload endpoint takes its target in the query string because the body is the raw file.
 * `name` is the client's filename and is echoed back into `files[].name`, so it is bounded here
 * rather than trusted — nothing downstream constrains it.
 */
export const UploadFileQuery = z.object({
    form_id: z.string().uuid(),
    field_key: z.string().regex(/^[a-z][a-z0-9_]{0,31}$/, 'field_key must match the form field key pattern'),
    name: z.string().trim().min(1).max(120).optional(),
});

/**
 * Offset paging shared by every list route. Lists used to return the whole collection — every
 * submission on the platform, for an admin. The response stays a bare array so existing clients
 * keep working; a client pages with `offset += limit` until a page comes back short.
 */
export const PageQuery = {
    limit: z.coerce.number().int().min(1).max(500).default(100),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
};

export const ListRegistrationsQuery = z.object({
    owner_id: z.string().uuid().optional(),
    // An admin's list of one form (the only way to list a generic form's registrations).
    form_id: z.string().uuid().optional(),
    status: z.enum(SUBMISSION_STATUS).optional(),
    user_id: z.string().uuid().optional(),
    ...PageQuery,
});

/** Admin answers: admin_only fields of the form, set on someone else's registration. */
export const AdminAnswersSchema = z.object({ answers: z.record(z.string(), z.unknown()) });

export const FileParams = z.object({
    id: z.string().uuid(),
    field_key: z.string().regex(/^[a-z][a-z0-9_]{0,31}$/),
});

export const MyRegistrationQuery = z.object({ owner_id: z.string().uuid() });

export type SubmitRegistrationInput = z.infer<typeof SubmitRegistrationSchema>;
export type UpdateRegistrationInput = z.infer<typeof UpdateRegistrationSchema>;
export type UpdateCaptainApplicationInput = z.infer<typeof UpdateCaptainApplicationSchema>;
export type UpdateStatusInput = z.infer<typeof UpdateStatusSchema>;
export type CancelRegistrationInput = z.infer<typeof CancelRegistrationSchema>;
export type AdminAnswersInput = z.infer<typeof AdminAnswersSchema>;
export type ListRegistrationsInput = z.infer<typeof ListRegistrationsQuery>;
export type FileRefInput = z.infer<typeof FileRef>;

export type UploadFileInput = z.infer<typeof UploadFileQuery>;
