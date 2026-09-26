import assert from 'assert';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import {
    ACCOUNT_DELETION_GRACE_DAYS,
    AuditLog,
    DomainEvent,
    User,
    UserRole,
    UserStatus,
    config,
    subscribe,
} from '@bgsc/shared';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { AuthService, OTP_MAX_ATTEMPTS, sha256 } from './auth.service';

/**
 * Auth Service e2e: the account lifecycle this service owns.
 *
 * Reactivation moved here from User Service on Sep 8, 2026 — a soft-deleted user holds no token,
 * so a route behind requireAuth could never be reached by one. The behaviour that came with it
 * (audit row, UserRestored event, cleared deletion block, atomic claim) is what this pins down.
 *
 * Run: npx ts-node src/auth/auth.e2e.ts   (from apps/auth-service)
 *
 * Scratch database of its own, dropped on exit — never bgsc_dev, never the shared bgsc_e2e.
 */

const TEST_DB = config.mongoUri.replace(/\/([^/?]+)(\?|$)/, '/bgsc_e2e_auth$2');

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
            prior_status: UserStatus.ACTIVE,
        },
    });
    return id;
}

async function activeUser(): Promise<string> {
    const id = await seedDeletedUser(1);
    await User.updateOne({ _id: id }, { $set: { status: UserStatus.ACTIVE, deleted_at: null, deletion: null } });
    return id;
}

/** Status/code of a rejected promise, for concurrency tallies. */
const outcome = (p: Promise<unknown>) =>
    p.then(() => 'ok', (e: any) => `${e.status}:${e.code}`);

async function main() {
    await mongoose.connect(TEST_DB);
    await mongoose.connection.dropDatabase();
    await User.createIndexes();
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
    assert.ok(back!.restored_at, 'restored_at stamped for the replay sweep');
    const beforeReplay = events.length;
    assert.ok((await AuthService.replayRestored()) >= 1, 'the sweep finds restores inside the window');
    assert.ok(events.slice(beforeReplay).some((e) => e.type === 'UserRestored' && e.payload.user_id === id),
        'and re-publishes UserRestored for them');

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
    assert.ok(await User.findById(expiredId), 'and the record still exists — nothing is ever erased');

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
        { $set: { refresh_token_hash: sha256(refreshOfSuspended.refresh_token) } }
    );
    await assert.rejects(
        () => AuthService.refreshToken(refreshOfSuspended.refresh_token),
        (err: any) => err.status === 403 && err.code === 'forbidden',
        'a suspended account cannot refresh its way into a new access token'
    );

    // Verifying an email is not a sign-in: no tokens for anyone, deleted or not.
    const verifyId = await seedDeletedUser(1);
    await User.updateOne(
        { _id: verifyId },
        { $set: { email_verification_token: sha256('tok-e2e'), email_verification_expires: new Date(Date.now() + 60_000) } }
    );
    const verified: any = await AuthService.verifyEmail('tok-e2e');
    assert.strictEqual(verified.tokens, undefined, 'a verification link mints no tokens');
    assert.strictEqual((await User.findById(verifyId))!.status, UserStatus.DELETED, 'and restores nothing');
    await assert.rejects(() => AuthService.verifyEmail('tok-e2e'), (err: any) => err.status === 400,
        'a verification token works once');

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

    // ---- OAuth state is CSRF-protected AND bound to the browser --------------
    const nonce = 'n'.repeat(64);
    const goodState = AuthService.signState(nonce, '/after');
    assert.strictEqual(AuthService.verifyState(goodState, nonce), '/after', 'state + matching cookie nonce passes');
    for (const [label, state, cookie] of [
        ['missing state', undefined, nonce],
        ['empty state', '', nonce],
        ['garbage state', 'not-a-token', nonce],
        ['wrong secret', jwt.sign({ typ: 'oauth_state', nonce }, 'wrong-secret'), nonce],
        ['no cookie', goodState, undefined],
        // The login-CSRF case: a valid state minted in the ATTACKER's browser, replayed in the victim's.
        ['another browser', goodState, 'm'.repeat(64)],
    ] as [string, string | undefined, string | undefined][]) {
        assert.throws(
            () => AuthService.verifyState(state, cookie),
            (err: any) => err.status === 400 && err.code === 'invalid_oauth_state',
            `state refused: ${label}`
        );
    }

    // ---- refresh: digests, not bcrypt; rotation is single-use and atomic ------
    const rtId = await activeUser();
    const rtUser = (await User.findById(rtId))!;
    const hashOf = async () => (await User.findById(rtId).select('+refresh_token_hash'))!.refresh_token_hash;
    const first = AuthService.generateTokenPair(rtUser);
    const olderDevice = AuthService.generateTokenPair(rtUser); // another sign-in = another family (sid)
    await User.updateOne({ _id: rtId }, { $set: AuthService.sessionSet(first) });
    // C3: under bcrypt every refresh token of one user matched, because bcrypt reads 72 bytes.
    await assert.rejects(() => AuthService.refreshToken(olderDevice.refresh_token), (e: any) => e.status === 401,
        'a different refresh token of the same user does not match the stored digest');
    assert.strictEqual(await hashOf(), sha256(first.refresh_token),
        "a stale token of ANOTHER session family is a plain 401 — the current device stays signed in");

    const rotated = await AuthService.refreshToken(first.refresh_token);
    const sidOf = (t: string) => (jwt.decode(t) as { sid: string }).sid;
    assert.strictEqual(sidOf(rotated.refresh_token), sidOf(first.refresh_token), 'rotation keeps the session family');
    await assert.rejects(() => AuthService.refreshToken(first.refresh_token), (e: any) => e.status === 401,
        'a rotated-out refresh token is dead');
    assert.strictEqual(await hashOf(), null, 'and replaying one of the CURRENT family ends that session (theft signal)');

    await User.updateOne({ _id: rtId }, { $set: AuthService.sessionSet(rotated) });
    const racing = await Promise.all(Array.from({ length: 5 }, () => outcome(AuthService.refreshToken(rotated.refresh_token))));
    assert.strictEqual(racing.filter((r) => r === 'ok').length, 1, 'concurrent refreshes of one token: exactly one wins');

    // ---- login discloses nothing without the password ------------------------
    const quietId = await seedDeletedUser(5);
    await assert.rejects(
        () => AuthService.login({ login: `${quietId}@authe2e.local`, password: 'wrong-password' }),
        (e: any) => e.status === 401 && e.code === 'unauthorized',
        'a deleted account with the wrong password is a plain 401, not a countdown');
    await assert.rejects(
        () => AuthService.login({ login: `${suspendedId}@authe2e.local`, password: 'wrong-password' }),
        (e: any) => e.status === 401,
        'a suspended account with the wrong password is a plain 401, not a 403');

    // ---- login loses to a password reset that lands mid-request --------------
    const raceLoginId = await activeUser();
    const realCompare = bcrypt.compare;
    (bcrypt as unknown as { compare: unknown }).compare = async (...args: [string, string]) => {
        const ok = await (realCompare as (a: string, b: string) => Promise<boolean>)(...args);
        // The reset commits between the password check and the session write.
        await User.updateOne({ _id: raceLoginId }, { $set: { password_hash: await bcrypt.hash('reset-won', 4) } });
        return ok;
    };
    const lostRace = await outcome(AuthService.login({ login: `${raceLoginId}@authe2e.local`, password: PASSWORD }));
    (bcrypt as unknown as { compare: unknown }).compare = realCompare;
    assert.strictEqual(lostRace, '401:unauthorized', 'a login that raced a reset is refused');
    assert.strictEqual((await User.findById(raceLoginId).select('+refresh_token_hash'))!.refresh_token_hash, null,
        'and mints no session from the old password');

    // ---- legacy deletion blocks: no prior_status means read the audit, else a human --
    const legacyId = await seedDeletedUser(1);
    await User.updateOne({ _id: legacyId }, { $unset: { 'deletion.prior_status': 1 } });
    await assert.rejects(() => AuthService.reactivateAccount(`${legacyId}@authe2e.local`, PASSWORD),
        (e: any) => e.status === 403 && e.code === 'admin_review_required',
        'an unstamped deletion with no audit row is not waved back in as active');
    await AuditLog.create({ actor_id: legacyId, action: 'user.deleted', target_type: 'user', target_id: legacyId,
        previous_value: { status: UserStatus.SUSPENDED } });
    await assert.rejects(() => AuthService.reactivateAccount(`${legacyId}@authe2e.local`, PASSWORD),
        (e: any) => e.status === 403 && e.code === 'forbidden',
        "the deletion's audit row says it was suspended: refused");

    // ---- deleting does not lift a suspension ---------------------------------
    const escapeeId = await seedDeletedUser(1);
    await User.updateOne({ _id: escapeeId }, { $set: { 'deletion.prior_status': UserStatus.SUSPENDED } });
    await assert.rejects(
        () => AuthService.reactivateAccount(`${escapeeId}@authe2e.local`, PASSWORD),
        (e: any) => e.status === 403,
        'an account deleted while suspended cannot reactivate itself');
    assert.strictEqual((await User.findById(escapeeId))!.status, UserStatus.DELETED, 'and stays deleted');

    // ---- restore audit: no restore without its row ---------------------------
    const noAuditId = await seedDeletedUser(1);
    const realCreate = AuditLog.create.bind(AuditLog);
    (AuditLog as unknown as { create: unknown }).create = async () => { throw new Error('audit store down'); };
    await assert.rejects(() => AuthService.reactivateAccount(`${noAuditId}@authe2e.local`, PASSWORD));
    (AuditLog as unknown as { create: unknown }).create = realCreate;
    assert.strictEqual((await User.findById(noAuditId))!.status, UserStatus.DELETED,
        'a restore whose audit row cannot be written is rolled back');

    // ---- reset tokens: stored hashed, consumed once --------------------------
    const resetId = await activeUser();
    const resetEmail = `${resetId}@authe2e.local`;
    const realLog = console.log;
    let mailed = '';
    console.log = (...a: unknown[]) => { const m = String(a[0]).match(/^Token: ([0-9a-f]{64})$/); if (m) mailed = m[1]; };
    await AuthService.forgotPassword(resetEmail);
    console.log = realLog;
    const stored = (await User.findById(resetId).select('+password_reset_token'))!.password_reset_token;
    assert.ok(mailed && stored === sha256(mailed), 'the reset token is stored as a digest, never raw');
    const resets = await Promise.all([0, 1].map(() => outcome(AuthService.resetPassword({ token: mailed, new_password: 'N3w!Passw0rd' }))));
    assert.deepStrictEqual(resets.sort(), ['400:invalid_or_expired_token', 'ok'], 'one reset token resets once');

    // ---- register race is a 409, not a 500 -----------------------------------
    const regName = `reg_${Date.now()}`;
    const reg = { email: `${regName}@authe2e.local`, username: regName, password: PASSWORD, full_name: 'Reg Race' };
    const regsBefore = events.length;
    const regs = await Promise.all([0, 1].map(() => outcome(AuthService.register(reg))));
    assert.deepStrictEqual(regs.sort(), ['409:conflict', 'ok'], 'two simultaneous sign-ups: one wins, one gets 409');
    const registered = events.slice(regsBefore).find((e) => e.type === 'UserRegistered')!;
    assert.deepStrictEqual(Object.keys(registered.payload), ['user_id'], 'UserRegistered carries the id only, no email');

    // ---- phone OTP: attempts are atomic and a resend buys no new guesses -------
    const otpId = await activeUser();
    const otpPhone = `+9188${Date.now().toString().slice(-8)}`;
    await AuthService.sendPhoneOtp(otpId, otpPhone);
    await User.updateOne({ _id: otpId }, { $set: { phone_verification_otp_hash: await bcrypt.hash('111111', 10) } });
    const guesses = await Promise.all(Array.from({ length: 10 }, () => outcome(AuthService.verifyPhoneOtp(otpId, otpPhone, '222222'))));
    assert.strictEqual(guesses.filter((g) => g === '400:invalid_otp').length, OTP_MAX_ATTEMPTS,
        'ten parallel guesses get exactly three compares');
    assert.strictEqual(guesses.filter((g) => g === '429:too_many_attempts').length, 10 - OTP_MAX_ATTEMPTS, 'the rest are 429');
    await assert.rejects(() => AuthService.sendPhoneOtp(otpId, otpPhone), (e: any) => e.status === 429,
        'a spent window cannot be refreshed by resending');

    const okOtpId = await activeUser();
    const okPhone = `+9177${Date.now().toString().slice(-8)}`;
    await AuthService.sendPhoneOtp(okOtpId, okPhone);
    await User.updateOne({ _id: okOtpId }, { $set: { phone_verification_otp_hash: await bcrypt.hash('333333', 4) } });
    const otpBefore = events.length;
    await AuthService.verifyPhoneOtp(okOtpId, okPhone, '333333');
    const phoneEvt = events.slice(otpBefore).find((e) => e.type === 'UserPhoneVerified')!;
    assert.deepStrictEqual(Object.keys(phoneEvt.payload), ['user_id'], 'UserPhoneVerified carries no phone number');

    // ---- Google: only a Google-verified email links to an existing account ----
    const gId = await activeUser(); // is_email_verified: false — a squatter-shaped account
    const gEmail = `${gId}@authe2e.local`;
    await User.updateOne({ _id: gId }, { $set: { refresh_token_hash: 'squatter-session', password_reset_token: 'squatter-reset' } });
    await assert.rejects(
        () => AuthService.upsertGoogleUser({ id: 'g-attacker', email: gEmail, verified_email: false }),
        (e: any) => e.status === 401 && e.code === 'google_email_unverified',
        'an unverified Google email never matches an existing account');
    assert.strictEqual((await User.findById(gId).select('+google_id'))!.google_id, null, 'and nothing was linked');
    const linked = await AuthService.upsertGoogleUser({ id: 'g-owner', email: gEmail, verified_email: true });
    assert.strictEqual(linked._id, gId, 'a verified email links to the existing account');
    // Pre-account takeover: the registrant never proved the email; Google just did. Their password,
    // session and pending links must not survive the link.
    const evicted = (await User.findById(gId).select('+password_hash +refresh_token_hash +password_reset_token'))!;
    assert.ok(!evicted.password_hash, "the unverified registrant's password is cleared");
    assert.strictEqual(evicted.refresh_token_hash, null, 'and their session');
    assert.strictEqual(evicted.password_reset_token, null, 'and any pending reset');
    assert.strictEqual(evicted.is_email_verified, true, 'the email now counts as verified');
    assert.ok(await AuditLog.exists({ target_id: gId, action: 'user.google_linked_unverified' }), 'and the eviction is audited');
    await assert.rejects(() => AuthService.login({ login: gEmail, password: PASSWORD }), (e: any) => e.status === 401,
        'the squatter can no longer sign in with their password');

    const vId = await activeUser();
    await User.updateOne({ _id: vId }, { $set: { is_email_verified: true } });
    await AuthService.upsertGoogleUser({ id: 'g-verified', email: `${vId}@authe2e.local`, verified_email: true });
    assert.ok((await User.findById(vId).select('+password_hash'))!.password_hash,
        'linking a VERIFIED account keeps its own password');

    // Username probe race: losing on the username retries with a suffix instead of failing.
    await User.create({ email: `gdup_taken@authe2e.local`, username: 'gdup', profile: { full_name: 'Taken' } });
    const realFindOne = User.findOne.bind(User);
    (User as unknown as { findOne: unknown }).findOne = (f: Record<string, unknown>, ...rest: unknown[]) =>
        f && 'username' in f ? Promise.resolve(null) : (realFindOne as (...a: unknown[]) => unknown)(f, ...rest);
    const raced = await AuthService.upsertGoogleUser({ id: 'g-dup', email: 'gdup@authe2e.local', verified_email: true })
        .finally(() => { (User as unknown as { findOne: unknown }).findOne = realFindOne; });
    assert.ok(raced.username.startsWith('gdup_') , 'a lost username probe retries with a suffix, not a 409');

    // Return paths: relative only, or the frontend's post-login redirect is an open redirect.
    for (const bad of ['https://evil.example/x', '//evil.example', '/\\evil.example', 'relative', '/' + 'a'.repeat(250)]) {
        assert.throws(() => AuthService.signState('n'.repeat(64), bad), (e: any) => e.status === 400,
            `return path refused: ${bad.slice(0, 24)}`);
    }
    const smuggled = jwt.sign({ typ: 'oauth_state', nonce: 'k'.repeat(64), s: '//evil.example' }, config.jwt.accessSecret);
    assert.strictEqual(AuthService.verifyState(smuggled, 'k'.repeat(64)), null, 'a pre-rule state cannot smuggle one out');
    await assert.rejects(
        () => AuthService.upsertGoogleUser({ id: 'g-other', email: gEmail, verified_email: true }),
        (e: any) => e.status === 409,
        'an account linked to one Google identity is never re-linked by email');
    await assert.rejects(() => AuthService.upsertGoogleUser({ id: 'g-x' } as any), (e: any) => e.status === 401,
        'a profile without an email is a 401, not a TypeError');

    // ---- Google login code: single use ---------------------------------------
    await User.updateOne({ _id: gId }, { $set: {
        oauth_login_code_hash: sha256('c'.repeat(64)), oauth_login_code_expires: new Date(Date.now() + 60_000) } });
    const exchanged = await AuthService.exchangeLoginCode('c'.repeat(64));
    assert.ok(exchanged.tokens.refresh_token && exchanged.user.role === UserRole.USER, 'a login code swaps for a session');
    await assert.rejects(() => AuthService.exchangeLoginCode('c'.repeat(64)), (e: any) => e.status === 401,
        'and only once');
    await User.updateOne({ _id: gId }, { $set: { status: UserStatus.SUSPENDED,
        oauth_login_code_hash: sha256('d'.repeat(64)), oauth_login_code_expires: new Date(Date.now() + 60_000) } });
    await assert.rejects(() => AuthService.exchangeLoginCode('d'.repeat(64)), (e: any) => e.status === 403,
        'a login code does not outlive a suspension');

    await mongoose.connection.dropDatabase();
    await mongoose.disconnect().catch(() => {});
    console.log('auth service e2e: all assertions passed');
}

main().catch(async (err) => {
    console.error('auth service e2e failed:', err);
    try { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); } catch {}
    process.exit(1);
});
