import { Request, Response, NextFunction } from 'express';
import { ZodType, ZodError } from 'zod';

/**
 * Request validation. Parses one part of the request against a zod schema, replaces it with the
 * parsed value (so handlers get coerced, stripped, typed data), and maps failures to the agreed
 * error envelope — docs/handoff-to-be1.md §5.
 *
 *   router.patch('/me', requireAuth, validate({ body: UpdateProfileSchema }), updateProfile);
 *
 * Zod strips unknown keys by default, which is the sanitization half of the job: a client cannot
 * smuggle `role` or `points_balance` into a profile update just by adding it to the payload.
 */

export interface ValidationIssue {
    key: string;
    code: string;
}

export interface Schemas {
    body?: ZodType;
    query?: ZodType;
    params?: ZodType;
}

/** Flattens a ZodError into the `fields` array of the 422 envelope. */
export function issuesOf(err: ZodError): ValidationIssue[] {
    return err.issues.map((i) => ({
        key: i.path.length ? i.path.join('.') : '(root)',
        code: i.code,
    }));
}

export function validate(schemas: Schemas) {
    return function (req: Request, res: Response, next: NextFunction): void {
        const fields: ValidationIssue[] = [];

        for (const part of ['body', 'query', 'params'] as const) {
            const schema = schemas[part];
            if (!schema) continue;

            const result = schema.safeParse(req[part]);
            if (result.success) {
                // Express 5 exposes req.query as a getter, so assign through defineProperty.
                Object.defineProperty(req, part, { value: result.data, writable: true, configurable: true });
            } else {
                fields.push(...issuesOf(result.error));
            }
        }

        if (fields.length > 0) {
            res.status(422).json({ error: 'validation_failed', fields });
            return;
        }
        next();
    };
}
