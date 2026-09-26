/**
 * Founder bootstrap (owner decision): `npm run seed:founder`.
 *
 * The role API can never mint a founder — ASSIGNABLE_ROLES stops at core, and promotion past
 * coordinator needs Founder 2FA that does not exist yet — so the first founder has to come from
 * outside the API. This is that path, and only that:
 *
 *   1. register the account normally (so it has a password, a verified-able email, a real row);
 *   2. FOUNDER_EMAIL=you@example.com npm run seed:founder
 *
 * Idempotent: re-running for the same account reports `already_founder` and writes nothing.
 * Refuses when the account does not exist, is not active, or when a DIFFERENT founder already
 * exists — a bootstrap is a one-time act, not a back door for promoting people later.
 *
 * The write is the same claim-then-audit-with-rollback as every other role change: a CAS on the
 * role that was read, an audit row (actor null, reason 'bootstrap'), and the claim undone if the
 * audit row cannot be written.
 */
import mongoose from 'mongoose';
import {
    User,
    UserRole,
    UserStatus,
    connectDB,
    connectEventBus,
    disconnectEventBus,
    publish,
    recordAudit,
} from '@bgsc/shared';

export type SeedResult = 'promoted' | 'already_founder';

export async function seedFounder(rawEmail: string): Promise<SeedResult> {
    const email = rawEmail.trim().toLowerCase();
    if (!email) throw new Error('FOUNDER_EMAIL is not set');

    const user = await User.findOne({ email, deleted_at: null });
    if (!user) throw new Error(`no live account for ${email} — register it first`);
    if (user.role === UserRole.FOUNDER) return 'already_founder';
    if (user.status !== UserStatus.ACTIVE) throw new Error(`account ${user._id} is ${user.status}, not active`);

    const other = await User.exists({ role: UserRole.FOUNDER, _id: { $ne: user._id } });
    if (other) throw new Error('a founder already exists; bootstrap refuses to mint another');

    const previous = user.role;
    const claimed = await User.findOneAndUpdate(
        { _id: user._id, role: previous, status: UserStatus.ACTIVE, deleted_at: null },
        { $set: { role: UserRole.FOUNDER } },
        { returnDocument: 'after' }
    );
    if (!claimed) throw new Error('the account changed while seeding; re-run');

    try {
        await recordAudit({
            actor_id: null,
            action: 'user.role_changed',
            target_type: 'user',
            target_id: user._id,
            previous_value: { role: previous },
            new_value: { role: UserRole.FOUNDER },
            reason: 'bootstrap',
        });
    } catch (err) {
        await User.updateOne({ _id: user._id, role: UserRole.FOUNDER }, { $set: { role: previous } });
        throw err;
    }

    publish('UserRoleChanged', 'user-service', {
        user_id: user._id,
        old_role: previous,
        new_role: UserRole.FOUNDER,
        changed_by: null,
    });
    return 'promoted';
}

if (require.main === module) {
    (async () => {
        await connectDB();
        await connectEventBus();
        try {
            const result = await seedFounder(process.env.FOUNDER_EMAIL ?? '');
            console.log(`seed:founder — ${result}`);
        } finally {
            await disconnectEventBus();
            await mongoose.disconnect();
        }
    })().catch((err) => {
        console.error(`seed:founder failed: ${(err as Error).message}`);
        process.exit(1);
    });
}
