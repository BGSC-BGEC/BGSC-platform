import { ALLOW_EDIT_UNTIL, FIELD_TYPE, FORM_STATUS, VISIBLE_IF_OP } from '@bgsc/shared';
import { z } from 'zod';

const KEY_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;

const VisibleIfSchema = z.object({
    field_key: z.string(),
    op: z.enum(VISIBLE_IF_OP),
    value: z.unknown(),
});

const FormFieldSchema = z.object({
    key: z.string().regex(KEY_PATTERN, 'Field key must match ^[a-z][a-z0-9_]{0,31}$'),
    label: z.string().min(1).max(200),
    help_text: z.string().max(500).nullable().optional(),
    type: z.enum(FIELD_TYPE),
    required: z.boolean().default(false),
    placeholder: z.string().max(200).nullable().optional(),
    options: z.array(z.object({ value: z.string(), label: z.string() })).nullable().optional(),
    validation: z.object({
        min: z.number().nullable().optional(),
        max: z.number().nullable().optional(),
        pattern: z.string().nullable().optional(),
        accept: z.array(z.string()).nullable().optional(),
        max_size_bytes: z.number().positive().nullable().optional(),
    }).optional(),
    visible_if: VisibleIfSchema.nullable().optional(),
    admin_only: z.boolean().default(false),
    order: z.number().int().min(0),
});

export const CreateFormSchema = z.object({
    owner: z.object({
        type: z.enum(['event', 'challenge', 'generic']),
        id: z.string().uuid().nullable(),
    }),
    title: z.string().min(1).max(200),
    description: z.string().max(2000).nullable().optional(),
    fields: z.array(FormFieldSchema).optional(),
    settings: z.object({
        allow_edit_until: z.enum(ALLOW_EDIT_UNTIL).optional(),
        confirmation_message: z.string().max(500).nullable().optional(),
    }).optional(),
});

export const UpdateFormSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    fields: z.array(FormFieldSchema).optional(),
    settings: z.object({
        allow_edit_until: z.enum(ALLOW_EDIT_UNTIL).optional(),
        confirmation_message: z.string().max(500).nullable().optional(),
    }).optional(),
});

export const FormIdParams = z.object({ id: z.string().uuid() });

export const ListFormsQuery = z.object({
    owner_type: z.enum(['event', 'challenge', 'generic']).optional(),
    owner_id: z.string().uuid().optional(),
    status: z.enum(FORM_STATUS).optional(),
});

export type CreateFormInput = z.infer<typeof CreateFormSchema>;
export type UpdateFormInput = z.infer<typeof UpdateFormSchema>;
export type ListFormsInput = z.infer<typeof ListFormsQuery>;
