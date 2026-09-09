import assert from 'assert';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import {
    ACCOUNT_DELETION_GRACE_DAYS,
    AuditLog,
    DomainEvent,
    User,
    UserStatus,
    connectDB,
    disconnectDB,
    subscribe,
} from '@bgsc/shared';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { AuthService } from './auth.service';

/**
 * Auth Service e2e: the account lifecycle this service owns.
 *
 * Reactivation moved here from User Service on Sep 8, 2026 — a soft-deleted user holds no token,
 * so a route behind requireAuth could never be reached by one. The behaviour that came with it
 * (audit row, UserRestored event, cleared deletion block, atomic claim) is what this pins down.
 *
 * Run: npx tsx apps/auth-service/src/auth/auth.e2e.ts
 */

const PASSWORD = 'Str0ng!Passw0rd';
const events: DomainEvent[] = [];

async function seedDeletedUser(daysAgo: number) {
    const id = uuid();
    const deletedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const restorableUntil = new Date(deletedAt.getTime() + ACCOUNT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
    await User.create({
        _id: id,
        email: `${id}@authe2e.local`,
        username: `e2e_${id.slice(0, 8)}`,
        password_hash: await bcrypt.hash(PASSWORD, 10),
        profile: { full_name: 'Lifecycle Test' },
        status: UserStatus.DELETED,
        deleted_at: deletedAt,
        deletion: {
            reason: 'testing',
            research_consent: false,
            restorable_until: restorableUntil,
            disclosure_version: '2026-09-08',
        },
    });
    return id;
}

async function main() {
    await connectDB();
    subscribe('*', (e) => void events.push(e));

    // ---- reactivation inside the window ------------------------------------
    const id = await seedDeletedUser(3);
    const result = await AuthService.reactivateAccount(`${id}@authe2e.local`, PASSWORD);
    assert.ok(result.tokens.access_token, 'reactivation issues a fresh access token');
    assert.ok(result.tokens.refresh_token, 'and a refresh token');

    const back = await User.findById(id);
    assert.strictEqual(back!.status, UserStatus.ACTIVE, 'status back to active');
    assert.strictEqual(back!.deleted_at, null, 'deleted_at cleared');
    // Left behind, this makes a live account keep reading as pending-deletion to every serializer.
    assert.strictEqual(back!.deletion, null, 'the deletion block is cleared with it');

    assert.strictEqual(
        await AuditLog.countDocuments({ target_id: id, action: 'user.restored' }),
        1,
        'reactivation writes exactly one audit row — it is a lifecycle event like deletion'
    );
    assert.ok(events.some((e) => e.type === 'UserRestored'), 'UserRestored emitted');

    // ---- reactivating a live account is a conflict, not a second restore ----
    await assert.rejects(
        () => AuthService.reactivateAccount(`${id}@authe2e.local`, PASSWORD),
        (err: any) => err.status === 401,
        'an account that is not deleted cannot be reactivated'
    );

    // ---- the window is enforced from the stamped date ----------------------
    const expiredId = await seedDeletedUser(ACCOUNT_DELETION_GRACE_DAYS + 1);
    await assert.rejects(
        () => AuthService.reactivateAccount(`${expiredId}@authe2e.local`, PASSWORD),
        (err: any) => err.status === 410 && err.code === 'account_permanently_deleted',
        'past the window, reactivation is gone'
    );
    assert.ok(await User.findById(expiredId), 'and the record still exists — nothing is ever erased (D10)');

    // ---- a wrong password never restores anything --------------------------
    const guardId = await seedDeletedUser(1);
    await assert.rejects(
        () => AuthService.reactivateAccount(`${guardId}@authe2e.local`, 'wrong-password'),
        (err: any) => err.status === 401,
        'a bad password is rejected'
    );
    assert.strictEqual(
        (await User.findById(guardId))!.status,
        UserStatus.DELETED,
        'and the account stays deleted'
    );

    // ---- concurrency: a double-click must not fabricate audit rows ---------
    const raceId = await seedDeletedUser(2);
    const attempts = await Promise.allSettled(
        Array.from({ length: 5 }, () => AuthService.reactivateAccount(`${raceId}@authe2e.local`, PASSWORD))
    );
    assert.strictEqual(
        attempts.filter((a) => a.status === 'fulfilled').length,
        1,
        'exactly one reactivation succeeds'
    );
    assert.strictEqual(
        await AuditLog.countDocuments({ target_id: raceId, action: 'user.restored' }),
        1,
        'one real transition writes one audit row — read-then-save would have written five'
    );
    assert.strictEqual((await User.findById(raceId))!.deleted_at, null, 'the account ends up restored');

    // ---- login refuses a deleted user, and says for how long ---------------
    const pendingId = await seedDeletedUser(5);
    const pending: any = await AuthService.login({ login: `${pendingId}@authe2e.local`, password: PASSWORD });
    assert.strictEqual(pending.account_status, 'scheduled_for_deletion', 'login reports the pending deletion');
    assert.ok(!pending.tokens, 'and issues no tokens — which is why restore cannot live behind requireAuth');
    assert.strictEqual(
        pending.days_remaining,
        ACCOUNT_DELETION_GRACE_DAYS - 5,
        'days_remaining counts down the same window User Service reports'
    );

    // ---- every token-minting path respects account status ------------------
    // These two used to mint freely: a suspended user could refresh forever, and a deleted one
    // could skip the grace-period flow by clicking their verification link.
    const suspendedId = await seedDeletedUser(1);
    await User.updateOne(
        { _id: suspendedId },
        { $set: { status: UserStatus.SUSPENDED, deleted_at: null, deletion: null } }
    );
    const suspended = (await User.findById(suspendedId))!;
    const refreshOfSuspended = AuthService['generateTokenPair'](suspended);
    await User.updateOne(
        { _id: suspendedId },
        { $set: { refresh_token_hash: await bcrypt.hash(refreshOfSuspended.refresh_token, 10) } }
    );
    await assert.rejects(
        () => AuthService.refreshToken(refreshOfSuspended.refresh_token),
        (err: any) => err.status === 403 && err.code === 'forbidden',
        'a suspended account cannot refresh its way into a new access token'
    );

    const verifyId = await seedDeletedUser(1);
    await User.updateOne(
        { _id: verifyId },
        { $set: { email_verification_token: 'tok-e2e', email_verification_expires: new Date(Date.now() + 60_000) } }
    );
    await assert.rejects(
        () => AuthService.verifyEmail('tok-e2e'),
        (err: any) => err.status === 403 && err.code === 'account_deactivated',
        'verifying an email must not hand a deleted account a fresh token pair'
    );

    // ---- one account per verified phone number -----------------------------
    const phone = `+9199${Date.now().toString().slice(-8)}`;
    const ownerId = await seedDeletedUser(1);
    await User.updateOne(
        { _id: ownerId },
        {
            $set: {
                status: UserStatus.ACTIVE, deleted_at: null, deletion: null,
                'profile.phone_number': phone, is_phone_verified: true,
            },
        }
    );

    const rivalId = await seedDeletedUser(1);
    await User.updateOne(
        { _id: rivalId },
        {
            $set: {
                status: UserStatus.ACTIVE, deleted_at: null, deletion: null,
                pending_phone_number: phone,
                phone_verification_otp_hash: await bcrypt.hash('123456', 10),
                phone_verification_expires: new Date(Date.now() + 60_000),
                phone_verification_attempts: 0,
            },
        }
    );
    await assert.rejects(
        () => AuthService.verifyPhoneOtp(rivalId, phone, '123456'),
        (err: any) => err.status === 409 && err.code === 'phone_number_taken',
        'a phone number already verified by someone else cannot be claimed again'
    );
    assert.strictEqual(
        (await User.findById(rivalId))!.is_phone_verified,
        false,
        'and the loser stays unverified'
    );

    // ---- OAuth state is CSRF-protected -------------------------------------
    for (const bad of [undefined, '', 'not-a-token', jwt.sign({ nonce: 'x' }, 'wrong-secret')]) {
        assert.throws(
            () => AuthService.verifyState(bad as string | undefined),
            (err: any) => err.status === 400 && err.code === 'invalid_oauth_state',
            `a forged or missing state is refused (${String(bad).slice(0, 12)})`
        );
    }

    await User.deleteMany({ email: /@authe2e\.local$/ });
    // Straight to the driver: the model refuses deletes because audit_logs is append-only, which
    // is the right guard for application code and the wrong one for a test tidying up after itself.
    await AuditLog.collection.deleteMany({
        target_id: { $in: [id, expiredId, guardId, raceId, pendingId, suspendedId, verifyId, ownerId, rivalId] },
    });
    await disconnectDB();
    await mongoose.disconnect().catch(() => {});
    console.log('auth service e2e: all assertions passed');
}

main().catch((err) => {
    console.error('auth service e2e failed:', err);
    process.exit(1);
});
