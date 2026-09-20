import { z } from 'zod';

export const ActivitiesQuery = z.object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().max(400).optional(),
});

export const UserIdParams = z.object({ id: z.string().uuid() });

export type ActivitiesInput = z.infer<typeof ActivitiesQuery>;
