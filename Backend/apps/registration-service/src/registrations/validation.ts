import { FormField } from '@bgsc/shared';
import vm from 'vm';

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

export interface ValidationContext {
    isAdmin: boolean;
    /**
     * Stored admin_only answers, for an owner's edit. A non-admin never sends them, but a field
     * whose `visible_if` points at one must still see the value the admin set.
     */
    adminAnswers?: Record<string, unknown>;
}

/**
 * Hard length ceilings, applied whatever the form says and before any pattern runs. A form with no
 * `validation.max` used to take a 1 MB string per field and hand all of it to the admin's regex.
 */
const TEXT_CAP: Record<string, number> = { short_text: 1000, email: 320, phone: 40, url: 2000, long_text: 10000 };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9 ().-]{5,40}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}(T[0-9:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;

/** Own properties only: a field keyed `constructor` must not read `Object.prototype.constructor`. */
const own = (obj: Record<string, unknown> | undefined, key: string): unknown =>
    obj && Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;

/**
 * `file` fields are answered in `files[]`, not `answers` — so `files` has to be part of the same
 * call. Mutates both: `answers` is coerced in place and loses hidden/admin-only keys, and `files`
 * loses entries for fields the form never asked this submitter.
 */
export function validateAnswers(
    answers: Record<string, unknown>,
    fields: FormField[],
    files: SubmissionFile[],
    context: ValidationContext
): ValidationError[] {
    const errors: ValidationError[] = [];
    const budget: RegexBudget = { remainingMs: REGEX_BUDGET_MS };
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
            errors.push({ field_key: key, code: 'not_a_file_field', message: `${field.label} does not take a file` });
        }
    }

    for (const key of Object.keys(answers)) {
        if (!fieldMap.has(key)) {
            errors.push({ field_key: key, code: 'unknown_field', message: `Field '${key}' not in form` });
        }
    }

    /**
     * Every answer is coerced once, up front, and visibility reads the coerced value of a
     * *visible* controller. Reading raw answers let a hidden controller's answer still hide a
     * required field, and let `"20"` fail a `visible_if … eq 20` that the stored `20` would pass
     * (backend-audit-2026-09-26 H4).
     */
    const coerced = new Map<string, Coerced>();
    const valueOf = (field: FormField): unknown => {
        if (field.type === 'file') return undefined;
        let c = coerced.get(field.key);
        if (!c) {
            const raw = field.admin_only && !context.isAdmin ? own(context.adminAnswers, field.key) : own(answers, field.key);
            c = coerce(field, raw);
            coerced.set(field.key, c);
        }
        return c.kind === 'ok' ? c.value : undefined;
    };

    const visibility = new Map<string, boolean>();
    const visiting = new Set<string>();
    const isVisible = (field: FormField): boolean => {
        const known = visibility.get(field.key);
        if (known !== undefined) return known;
        const cond = field.visible_if;
        if (!cond) return true;
        // A cycle is refused at form save; one stored before that rule hides the fields in it.
        if (visiting.has(field.key)) return false;
        visiting.add(field.key);
        const controller = fieldMap.get(cond.field_key);
        const shown = !controller
            ? true // unknown reference (also refused at save): show the field rather than drop an answer
            : evaluateVisibleIf(cond, isVisible(controller) ? valueOf(controller) : undefined);
        visiting.delete(field.key);
        visibility.set(field.key, shown);
        return shown;
    };

    for (const field of fields) {
        /**
         * admin_only first, then visibility: an admin_only field behind a condition the submitter
         * controls must still refuse their value, and a refused or hidden answer is deleted rather
         * than stored unvalidated.
         */
        if (field.admin_only && !context.isAdmin) {
            const supplied = !isEmptyValue(own(answers, field.key)) || (filesByKey.get(field.key)?.length ?? 0) > 0;
            if (supplied) {
                errors.push({ field_key: field.key, code: 'admin_only', message: `${field.label} can only be set by admin` });
            }
            delete answers[field.key];
            continue;
        }

        if (!isVisible(field)) {
            delete answers[field.key];
            dropFiles(files, field.key);
            continue;
        }

        if (field.type === 'file') {
            errors.push(...validateFiles(field, filesByKey.get(field.key) ?? []));
            continue;
        }

        valueOf(field);
        const c = coerced.get(field.key)!;

        // A required checkbox is a consent box: `false` is not an answer to it.
        const empty = c.kind === 'empty' || (field.type === 'checkbox' && c.kind === 'ok' && c.value === false);
        if (empty) {
            if (field.required) {
                errors.push({ field_key: field.key, code: 'required', message: `${field.label} is required` });
            }
            if (c.kind === 'empty') delete answers[field.key];
            else answers[field.key] = false;
            continue;
        }
        if (c.kind === 'error') {
            errors.push({ field_key: field.key, code: c.code, message: `${field.label} ${c.message}` });
            continue;
        }

        answers[field.key] = c.value;
        const ruleError = validateRules(field, c.value, budget);
        if (ruleError) errors.push({ field_key: field.key, ...ruleError });
    }

    return errors;
}

type Coerced = { kind: 'ok'; value: unknown } | { kind: 'empty' } | { kind: 'error'; code: string; message: string };

const bad = (code: string, message: string): Coerced => ({ kind: 'error', code, message });

function isEmptyValue(value: unknown): boolean {
    return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

/**
 * Strict per type. `Number(true)`, `Number([5])`, `new Date(true)` and a whitespace-only "required"
 * answer all used to pass; only the shapes a form input actually produces are accepted now.
 */
function coerce(field: FormField, raw: unknown): Coerced {
    if (isEmptyValue(raw)) return { kind: 'empty' };

    switch (field.type) {
        case 'short_text':
        case 'long_text':
        case 'email':
        case 'phone':
        case 'url': {
            if (typeof raw !== 'string') return bad('invalid_type', 'must be a string');
            const value = raw.trim();
            if (value === '') return { kind: 'empty' };
            if (value.length > TEXT_CAP[field.type]) return bad('too_long', `must be at most ${TEXT_CAP[field.type]} characters`);
            if (field.type === 'email' && !EMAIL_RE.test(value)) return bad('invalid_format', 'must be an email address');
            if (field.type === 'phone' && !PHONE_RE.test(value)) return bad('invalid_format', 'must be a phone number');
            if (field.type === 'url' && !isHttpUrl(value)) return bad('invalid_format', 'must be an http(s) URL');
            return { kind: 'ok', value };
        }

        case 'number': {
            const num = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
            if (!Number.isFinite(num)) return bad('invalid_type', 'must be a number');
            return { kind: 'ok', value: num };
        }

        case 'select':
            if (typeof raw !== 'string') return bad('invalid_type', 'must be a string');
            if (!field.options?.some((opt) => opt.value === raw)) return bad('invalid_option', 'has invalid option');
            return { kind: 'ok', value: raw };

        case 'multi_select': {
            if (!Array.isArray(raw)) return bad('invalid_type', 'must be an array');
            for (const v of raw) {
                if (typeof v !== 'string' || !field.options?.some((opt) => opt.value === v)) {
                    return bad('invalid_option', 'has invalid option');
                }
            }
            // Duplicates would count toward `min` selections.
            if (new Set(raw).size !== raw.length) return bad('duplicate_option', 'lists an option twice');
            return { kind: 'ok', value: raw };
        }

        case 'checkbox':
            if (typeof raw !== 'boolean') return bad('invalid_type', 'must be a boolean');
            return { kind: 'ok', value: raw };

        case 'date': {
            // A stored answer is already a Date: a files-only edit re-validates it and must not fail.
            if (raw instanceof Date) return isNaN(raw.getTime()) ? bad('invalid_type', 'must be a valid date') : { kind: 'ok', value: raw };
            if (typeof raw !== 'string' || !DATE_RE.test(raw)) return bad('invalid_type', 'must be an ISO date');
            const date = new Date(raw);
            if (isNaN(date.getTime())) return bad('invalid_type', 'must be a valid date');
            return { kind: 'ok', value: date };
        }

        case 'user_ref':
            // ponytail: shape only. The spec makes the existence check optional and it needs a read
            // per field; add it here when a form actually carries one.
            if (typeof raw !== 'string' || !UUID_RE.test(raw)) return bad('invalid_type', 'must be a UUID');
            return { kind: 'ok', value: raw };

        case 'file':
        default:
            return bad('invalid_field', 'should be in files[], not answers');
    }
}

function isHttpUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

function evaluateVisibleIf(cond: NonNullable<FormField['visible_if']>, refValue: unknown): boolean {
    // A date controller compares by instant, not by object identity.
    const v = refValue instanceof Date ? refValue.toISOString() : refValue;
    switch (cond.op) {
        case 'eq':
            return v === cond.value;
        case 'neq':
            return v !== cond.value;
        case 'in':
            return Array.isArray(cond.value) && cond.value.includes(v);
        default:
            return true; // unknown op: show the field
    }
}

function dropFiles(files: SubmissionFile[], key: string): void {
    for (let i = files.length - 1; i >= 0; i--) if (files[i].field_key === key) files.splice(i, 1);
}

/**
 * `accept` and `max_size_bytes` are checked against the upload record's own metadata, which the
 * caller resolved server-side (registration.service `resolveFiles`), not against the client's claim.
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
        errors.push({ field_key: field.key, code: 'too_many', message: `${field.label} takes one file` });
        return errors;
    }

    const [file] = uploaded;
    const accept = field.validation?.accept;
    if (accept && accept.length > 0 && !accept.includes(file.mime)) {
        errors.push({ field_key: field.key, code: 'invalid_mime', message: `${field.label} must be one of: ${accept.join(', ')}` });
    }

    const maxBytes = field.validation?.max_size_bytes;
    if (maxBytes !== null && maxBytes !== undefined && file.size > maxBytes) {
        errors.push({ field_key: field.key, code: 'too_large', message: `${field.label} must be at most ${maxBytes} bytes` });
    }

    return errors;
}

function validateRules(field: FormField, value: unknown, budget: RegexBudget): { code: string; message: string } | null {
    const val = field.validation;
    if (!val) return null;
    const has = (n: number | null | undefined): n is number => n !== null && n !== undefined;

    switch (field.type) {
        case 'number': {
            const num = value as number;
            if (has(val.min) && num < val.min) return { code: 'too_small', message: `${field.label} must be at least ${val.min}` };
            if (has(val.max) && num > val.max) return { code: 'too_large', message: `${field.label} must be at most ${val.max}` };
            break;
        }

        case 'short_text':
        case 'long_text':
        case 'email':
        case 'phone':
        case 'url': {
            const str = value as string;
            if (has(val.min) && str.length < val.min) {
                return { code: 'too_short', message: `${field.label} must be at least ${val.min} characters` };
            }
            if (has(val.max) && str.length > val.max) {
                return { code: 'too_long', message: `${field.label} must be at most ${val.max} characters` };
            }
            if (val.pattern) {
                const matched = safeTest(val.pattern, str, budget);
                if (matched === null) return { code: 'pattern_timeout', message: `${field.label} could not be checked` };
                if (!matched) return { code: 'pattern_mismatch', message: `${field.label} format is invalid` };
            }
            break;
        }

        case 'multi_select': {
            const arr = value as unknown[];
            if (has(val.min) && arr.length < val.min) {
                return { code: 'too_few', message: `${field.label} must have at least ${val.min} selections` };
            }
            if (has(val.max) && arr.length > val.max) {
                return { code: 'too_many', message: `${field.label} must have at most ${val.max} selections` };
            }
            break;
        }
    }

    return null;
}

/* ------------------------------------------------------------------ *
 * Admin-supplied patterns
 * ------------------------------------------------------------------ */

/**
 * A pattern is written by an admin and run against every submitter's input, so one catastrophic
 * `^(a+)+$` froze the whole service for any user who typed 30 characters (audit H3). Four layers,
 * no new dependency:
 *  1. `patternProblem` refuses invalid, over-long and backreferencing patterns at form save, and
 *     any quantified group whose body is itself quantified or holds an alternation — `(a+)+`,
 *     `(a|a)+`, `(\w|\d)*` — the shapes that backtrack exponentially (audit #2);
 *  2. `TEXT_CAP` bounds the input before any pattern sees it;
 *  3. each match runs under a vm timeout, which V8 honours inside the regex engine;
 *  4. one request shares a total budget (`REGEX_BUDGET_MS`) across ALL its fields, so a form with
 *     many slow-but-legal patterns cannot buy 50 ms per field. An exhausted budget is a
 *     `pattern_timeout` field error (422), never the event loop.
 */
export const PATTERN_MAX_LENGTH = 200;
export const REGEX_BUDGET_MS = 100;
const PER_MATCH_MS = 50;

export interface RegexBudget {
    remainingMs: number;
}

export function patternProblem(pattern: string): string | null {
    if (pattern.length > PATTERN_MAX_LENGTH) return 'pattern_too_long';
    try {
        new RegExp(pattern);
    } catch {
        return 'pattern_invalid';
    }
    if (/\\[1-9]|\\k</.test(pattern)) return 'pattern_unsafe';
    return hasAmbiguousRepeat(pattern) ? 'pattern_unsafe' : null;
}

/** A group repeated by `*`, `+` or `{…}` whose body contains a quantifier or an alternation. */
function hasAmbiguousRepeat(p: string): boolean {
    const stack: { quantified: boolean; alternation: boolean }[] = [];
    let inClass = false;
    for (let i = 0; i < p.length; i++) {
        const ch = p[i];
        if (ch === '\\') {
            i++;
            continue;
        }
        if (inClass) {
            if (ch === ']') inClass = false;
            continue;
        }
        const top = stack[stack.length - 1];
        if (ch === '[') inClass = true;
        else if (ch === '(') {
            stack.push({ quantified: false, alternation: false });
            if (p[i + 1] === '?') i++; // `(?:`, `(?=` — that `?` is syntax, not a quantifier
        } else if (ch === ')') {
            const inner = stack.pop() ?? { quantified: false, alternation: false };
            const next = p[i + 1];
            const repeated = next === '*' || next === '+' || next === '{';
            if (repeated && (inner.quantified || inner.alternation)) return true;
            const parent = stack[stack.length - 1];
            if (parent) {
                parent.quantified ||= inner.quantified || repeated || next === '?';
                parent.alternation ||= inner.alternation;
            }
        } else if (top && (ch === '*' || ch === '+' || ch === '{' || ch === '?')) {
            top.quantified = true;
        } else if (top && ch === '|') {
            top.alternation = true;
        }
    }
    return false;
}

const sandbox = vm.createContext({ re: null as RegExp | null, s: '' });
const probe = new vm.Script('re.test(s)');
const compiled = new Map<string, RegExp | null>();

/**
 * true / false, or null when the match — or the request's remaining budget — ran out of time. An
 * uncompilable stored pattern is skipped.
 */
function safeTest(pattern: string, input: string, budget: RegexBudget): boolean | null {
    let re = compiled.get(pattern);
    if (re === undefined) {
        try {
            re = new RegExp(pattern);
        } catch {
            console.error(`[registration-service] stored pattern does not compile, skipped: ${pattern}`);
            re = null;
        }
        // ponytail: unbounded cache keyed by admin patterns; a platform has dozens, not millions.
        compiled.set(pattern, re);
    }
    if (!re) return true;

    const timeout = Math.floor(Math.min(PER_MATCH_MS, budget.remainingMs));
    if (timeout < 1) return null;
    sandbox.re = re;
    sandbox.s = input;
    const started = performance.now();
    try {
        return probe.runInContext(sandbox, { timeout }) === true;
    } catch {
        return null;
    } finally {
        budget.remainingMs -= performance.now() - started;
    }
}
