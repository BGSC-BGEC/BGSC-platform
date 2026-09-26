import { z } from 'zod';

export const ActivitiesQuery = z.object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().max(400).optional(),
});

export const UserIdParams = z.object({ id: z.string().uuid() });

/** What the callback bounced to the app, posted back under the app's own session. */
export const LinkBody = z.object({
    code: z.string().min(1).max(512),
    state: z.string().min(1).max(2048),
    // The scopes the athlete actually granted (Strava's callback `scope`), which may be fewer
    // than requested. May be empty; the service refuses one without an activity scope.
    scope: z.string().max(200),
});

export type ActivitiesInput = z.infer<typeof ActivitiesQuery>;
