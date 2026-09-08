import { FormField } from '@bgsc/shared';

export interface ValidationError {
    field_key: string;
    code: string;
    message: string;
}

export interface SubmissionFile {
    field_key: string;
    url: string;
    name: string;
    size: number;
    mime: string;
}

/**
 * `file` fields are answered in `files[]`, not `answers` — so `files` has to be part of the same
 * call. Validating only `answers` meant a required file field failed its `required` check no
 * matter what the user uploaded, and the uploaded metadata itself was never checked at all.
 */
export function validateAnswers(
    answers: Record<string, unknown>,
    fields: FormField[],
    files: SubmissionFile[],
    context: { isAdmin: boolean }
): ValidationError[] {
    const errors: ValidationError[] = [];
    const answeredKeys = new Set(Object.keys(answers));
    const fieldMap = new Map(fields.map((f) => [f.key, f]));
    const filesByKey = new Map<string, SubmissionFile[]>();
    for (const file of files) {
        const bucket = filesByKey.get(file.field_key);
        if (bucket) bucket.push(file);
        else filesByKey.set(file.field_key, [file]);
    }

    for (const key of filesByKey.keys()) {
        const field = fieldMap.get(key);
        if (!field) {
            errors.push({ field_key: key, code: 'unknown_field', message: `Field '${key}' not in form` });
        } else if (field.type !== 'file') {
            errors.push({
                field_key: key,
                code: 'not_a_file_field',
                message: `${field.label} does not take a file`,
            });
        }
    }

    // 1. Check unknown keys
    for (const key of answeredKeys) {
        if (!fieldMap.has(key)) {
            errors.push({
                field_key: key,
                code: 'unknown_field',
                message: `Field '${key}' not in form`,
            });
        }
    }

    // 2. Validate each field
    for (const field of fields) {
        // visible_if check (skip if hidden)
        if (field.visible_if && !evaluateVisibleIf(field.visible_if, answers)) {
            continue; // field is hidden, don't validate
        }

        if (field.type === 'file') {
            errors.push(...validateFiles(field, filesByKey.get(field.key) ?? []));
            continue;
        }

        const value = answers[field.key];
        const isEmpty =
            value === null ||
            value === undefined ||
            value === '' ||
            (Array.isArray(value) && value.length === 0);

        // Required check
        if (field.required && isEmpty) {
            errors.push({
                field_key: field.key,
                code: 'required',
                message: `${field.label} is required`,
            });
            continue; // no point in further validation
        }

        // Admin-only rejection
        if (field.admin_only && !context.isAdmin && !isEmpty) {
            errors.push({
                field_key: field.key,
                code: 'admin_only',
                message: `${field.label} can only be set by admin`,
            });
            continue;
        }

        if (isEmpty) continue; // optional and empty, nothing to validate

        // Type validation + coercion (mutates answers in place)
        const typeError = validateType(field, answers);
        if (typeError) {
            errors.push({ field_key: field.key, ...typeError });
            continue;
        }

        // Validation rules (min/max/pattern)
        const ruleError = validateRules(field, answers[field.key]);
        if (ruleError) {
            errors.push({ field_key: field.key, ...ruleError });
        }
    }

    return errors;
}

function evaluateVisibleIf(
    cond: NonNullable<FormField['visible_if']>,
    answers: Record<string, unknown>
): boolean {
    const refValue = answers[cond.field_key];
    switch (cond.op) {
        case 'eq':
            return refValue === cond.value;
        case 'neq':
            return refValue !== cond.value;
        case 'in':
            return Array.isArray(cond.value) && cond.value.includes(refValue);
        default:
            return true; // unknown op: show the field
    }
}

function validateType(
    field: FormField,
    answers: Record<string, unknown>
): { code: string; message: string } | null {
    const value = answers[field.key];

    switch (field.type) {
        case 'short_text':
        case 'long_text':
        case 'email':
        case 'phone':
        case 'url':
            if (typeof value !== 'string') {
                return { code: 'invalid_type', message: `${field.label} must be a string` };
            }
            answers[field.key] = value.trim();
            break;

        case 'number':
            const num = Number(value);
            if (isNaN(num)) {
                return { code: 'invalid_type', message: `${field.label} must be a number` };
            }
            answers[field.key] = num;
            break;

        case 'select':
            if (typeof value !== 'string') {
                return { code: 'invalid_type', message: `${field.label} must be a string` };
            }
            if (!field.options?.some((opt) => opt.value === value)) {
                return { code: 'invalid_option', message: `${field.label} has invalid option` };
            }
            break;

        case 'multi_select':
            if (!Array.isArray(value)) {
                return { code: 'invalid_type', message: `${field.label} must be an array` };
            }
            for (const v of value) {
                if (typeof v !== 'string' || !field.options?.some((opt) => opt.value === v)) {
                    return { code: 'invalid_option', message: `${field.label} has invalid option` };
                }
            }
            break;

        case 'checkbox':
            if (typeof value !== 'boolean') {
                return { code: 'invalid_type', message: `${field.label} must be a boolean` };
            }
            break;

        case 'date':
            const date = new Date(value as any);
            if (isNaN(date.getTime())) {
                return { code: 'invalid_type', message: `${field.label} must be a valid date` };
            }
            answers[field.key] = date;
            break;

        case 'user_ref':
            if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value)) {
                return { code: 'invalid_type', message: `${field.label} must be a UUID` };
            }
            break;

        case 'file':
            // Unreachable: file fields are answered in files[] and handled by validateFiles.
            return { code: 'invalid_field', message: `${field.label} should be in files[], not answers` };
    }

    return null;
}

/**
 * `accept` and `max_size_bytes` are the form author's rules about an upload, and they are enforced
 * here as well as at upload time — the client sends this metadata, so anything that trusts it
 * unchecked is trusting the client.
 */
function validateFiles(field: FormField, uploaded: SubmissionFile[]): ValidationError[] {
    const errors: ValidationError[] = [];

    if (uploaded.length === 0) {
        if (field.required) {
            errors.push({ field_key: field.key, code: 'required', message: `${field.label} is required` });
        }
        return errors;
    }

    // One upload per field: nothing in the form model expresses a multi-file field.
    if (uploaded.length > 1) {
        errors.push({
            field_key: field.key,
            code: 'too_many',
            message: `${field.label} takes one file`,
        });
        return errors;
    }

    const [file] = uploaded;
    const accept = field.validation?.accept;
    if (accept && accept.length > 0 && !accept.includes(file.mime)) {
        errors.push({
            field_key: field.key,
            code: 'invalid_mime',
            message: `${field.label} must be one of: ${accept.join(', ')}`,
        });
    }

    const maxBytes = field.validation?.max_size_bytes;
    if (maxBytes !== null && maxBytes !== undefined && file.size > maxBytes) {
        errors.push({
            field_key: field.key,
            code: 'too_large',
            message: `${field.label} must be at most ${maxBytes} bytes`,
        });
    }

    return errors;
}

function validateRules(
    field: FormField,
    value: unknown
): { code: string; message: string } | null {
    const val = field.validation;
    if (!val) return null;

    switch (field.type) {
        case 'number':
            const num = value as number;
            if (val.min !== null && val.min !== undefined && num < val.min) {
                return { code: 'too_small', message: `${field.label} must be at least ${val.min}` };
            }
            if (val.max !== null && val.max !== undefined && num > val.max) {
                return { code: 'too_large', message: `${field.label} must be at most ${val.max}` };
            }
            break;

        case 'short_text':
        case 'long_text':
        case 'email':
        case 'phone':
        case 'url':
            const str = value as string;
            if (val.min !== null && val.min !== undefined && str.length < val.min) {
                return { code: 'too_short', message: `${field.label} must be at least ${val.min} characters` };
            }
            if (val.max !== null && val.max !== undefined && str.length > val.max) {
                return { code: 'too_long', message: `${field.label} must be at most ${val.max} characters` };
            }
            if (val.pattern) {
                const regex = new RegExp(val.pattern);
                if (!regex.test(str)) {
                    return { code: 'pattern_mismatch', message: `${field.label} format is invalid` };
                }
            }
            break;

        case 'multi_select':
            const arr = value as unknown[];
            if (val.min !== null && val.min !== undefined && arr.length < val.min) {
                return { code: 'too_few', message: `${field.label} must have at least ${val.min} selections` };
            }
            if (val.max !== null && val.max !== undefined && arr.length > val.max) {
                return { code: 'too_many', message: `${field.label} must have at most ${val.max} selections` };
            }
            break;
    }

    return null;
}
