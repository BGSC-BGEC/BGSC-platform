import { ALLOW_EDIT_UNTIL, FIELD_TYPE, FORM_STATUS, VISIBLE_IF_OP } from '@bgsc/shared';
import { z } from 'zod';
import { PATTERN_MAX_LENGTH, patternProblem } from '../registrations/validation';
import { PageQuery } from '../registrations/registration.schemas';
import { FILE_MAX_BYTES } from '../storage/storage';

const KEY_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
const TEXT_TYPES = new Set(['short_text', 'long_text', 'email', 'phone', 'url']);

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
    options: z
        .array(z.object({ value: z.string().min(1).max(200), label: z.string().min(1).max(200) }))
        .max(200)
        .nullable()
        .optional(),
    validation: z
        .object({
            min: z.number().finite().nullable().optional(),
            max: z.number().finite().nullable().optional(),
            pattern: z.string().max(PATTERN_MAX_LENGTH).nullable().optional(),
            accept: z.array(z.string().max(100)).max(20).nullable().optional(),
            max_size_bytes: z.number().int().positive().max(FILE_MAX_BYTES).nullable().optional(),
        })
        .optional(),
    visible_if: VisibleIfSchema.nullable().optional(),
    admin_only: z.boolean().default(false),
    order: z.number().int().min(0),
});

type FieldInput = z.infer<typeof FormFieldSchema>;

/**
 * Everything the FormDefinition model's pre-validate hook checks, and what the validation engine
 * needs to be safe, checked here as a 422. The model throws a plain Error (a 500), and on a
 * published form that 500 came AFTER the archive row was written — so every later edit hit the
 * archive's unique index and the form could never be edited again (backend-audit, registration).
 */
function checkFields(fields: FieldInput[], ctx: z.RefinementCtx): void {
    const issue = (i: number, key: string, message: string) =>
        ctx.addIssue({ code: 'custom', path: [i, key], message });
    const byKey = new Map<string, FieldInput>();

    fields.forEach((f, i) => {
        if (byKey.has(f.key)) issue(i, 'key', 'duplicate_key');
        byKey.set(f.key, f);

        const needsOptions = f.type === 'select' || f.type === 'multi_select';
        if (needsOptions) {
            const values = (f.options ?? []).map((o) => o.value);
            if (values.length === 0) issue(i, 'options', 'options_required');
            if (new Set(values).size !== values.length) issue(i, 'options', 'duplicate_option');
        }

        const v = f.validation;
        if (v?.min != null && v?.max != null && v.min > v.max) issue(i, 'validation', 'min_exceeds_max');
        if (v?.pattern) {
            if (!TEXT_TYPES.has(f.type)) issue(i, 'validation', 'pattern_only_on_text');
            const problem = patternProblem(v.pattern);
            if (problem) issue(i, 'validation', problem);
        }
    });

    // visible_if must name another field, and the references must not loop.
    fields.forEach((f, i) => {
        if (!f.visible_if) return;
        if (f.visible_if.field_key === f.key || !byKey.has(f.visible_if.field_key)) {
            issue(i, 'visible_if', 'unknown_visible_if_field');
            return;
        }
        const seen = new Set([f.key]);
        for (let cur = byKey.get(f.visible_if.field_key); cur?.visible_if; cur = byKey.get(cur.visible_if.field_key)) {
            if (seen.has(cur.key)) {
                issue(i, 'visible_if', 'visible_if_cycle');
                break;
            }
            seen.add(cur.key);
        }
    });
}

const FieldsSchema = z.array(FormFieldSchema).max(200).superRefine(checkFields);

export const CreateFormSchema = z
    .object({
        owner: z.object({
            type: z.enum(['event', 'challenge', 'generic']),
            id: z.string().uuid().nullable(),
        }),
        title: z.string().min(1).max(200),
        description: z.string().max(2000).nullable().optional(),
        fields: FieldsSchema.optional(),
        settings: z
            .object({
                allow_edit_until: z.enum(ALLOW_EDIT_UNTIL).optional(),
                confirmation_message: z.string().max(500).nullable().optional(),
            })
            .optional(),
    })
    // An event or challenge form without an id registered people for nothing (and skipped the seat).
    .refine((b) => (b.owner.type === 'generic') === (b.owner.id === null), {
        path: ['owner', 'id'],
        message: 'owner_id_required_unless_generic',
    });

export const UpdateFormSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    fields: FieldsSchema.optional(),
    settings: z
        .object({
            allow_edit_until: z.enum(ALLOW_EDIT_UNTIL).optional(),
            confirmation_message: z.string().max(500).nullable().optional(),
        })
        .optional(),
});

export const FormIdParams = z.object({ id: z.string().uuid() });

export const FormVersionParams = z.object({
    id: z.string().uuid(),
    version: z.coerce.number().int().min(1),
});

export const ListFormsQuery = z.object({
    owner_type: z.enum(['event', 'challenge', 'generic']).optional(),
    owner_id: z.string().uuid().optional(),
    status: z.enum(FORM_STATUS).optional(),
    ...PageQuery,
});

export type CreateFormInput = z.infer<typeof CreateFormSchema>;
export type UpdateFormInput = z.infer<typeof UpdateFormSchema>;
export type ListFormsInput = z.infer<typeof ListFormsQuery>;
