import { IUser, User, UserRole, config } from '@bgsc/shared';
import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';

/**
 * Fixtures for the feedback selfchecks. A scratch database, dropped at the START — the throttle
 * collection is written by every submission, and a half-finished run would leave a rate limit
 * behind for whoever ran it next.
 */
const SCRATCH_DB = config.mongoUri.replace(/\/([^/?]+)(\?|$)/, '/bgsc_selfcheck_feedback$2');

export async function openScratchDb(): Promise<void> {
    await mongoose.connect(SCRATCH_DB);
    await mongoose.connection.dropDatabase();
    // The unique ticket_no index is what makes a collision a retry rather than a second ticket.
    await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).syncIndexes()));
}

export async function closeScratchDb(): Promise<void> {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
}

export async function seedUser(fullName: string, role: UserRole = UserRole.USER): Promise<IUser> {
    const id = uuid();
    return User.create({
        _id: id,
        email: `${id}@selfcheck.local`,
        username: `sc_${id.slice(0, 8)}`,
        role,
        profile: { full_name: fullName },
    });
}

/** A complete, valid submission body. Spread over it to make one field wrong at a time. */
export const ticketInput = (over: Record<string, unknown> = {}) => ({
    subject: 'The scoreboard shows the wrong total',
    description: 'After the second half it added ten points that nobody scored.',
    category: 'bug' as const,
    severity: 'medium' as const,
    is_anonymous: false,
    attachments: [],
    ...over,
});
