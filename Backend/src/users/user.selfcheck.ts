/**
 * Runnable check for the User Service pure logic: masking, visibility, rating, image sniffing.
 * No DB and no server — the HTTP path is exercised by user.e2e.ts.
 *
 *   npx ts-node src/users/user.selfcheck.ts
 */
import assert from 'assert';
import { IUser, UserRole } from '../models/User';
import { maskEmail, maskPhone, visibilityFor, serializeUser, snapshotOf } from './user.serializer';
import { computeRating, RATING_VERSION, RATING_WEIGHTS } from './playerCard';
import { sniffImage } from '../storage/storage';
import { isUuid } from './user.schemas';

/* -------------------------------- masking -------------------------------- */

assert.strictEqual(maskEmail('ana@gmail.com'), 'a***@gmail.com', 'masks the local part');
assert.strictEqual(maskEmail('a@b.co'), 'a***@b.co', 'single-char local part still masks');
assert.strictEqual(maskEmail('verylongaddress@x.com'), 'v***@x.com', 'mask width does not leak length');
assert.strictEqual(maskEmail('broken'), '***', 'a malformed address reveals nothing');
assert.ok(!maskEmail('ana@gmail.com').includes('na@'), 'the local part is genuinely gone');

assert.strictEqual(maskPhone('+919876543210'), '+91******3210', 'keeps country code and last four');
assert.strictEqual(maskPhone('9876543210'), '******3210', 'bare number keeps last four');
assert.strictEqual(maskPhone('12'), '***', 'too short to mask safely');

/* ------------------------------- visibility ------------------------------- */

const mk = (over: Record<string, unknown> = {}): IUser =>
    ({
        _id: 'u-1',
        username: 'ana',
        email: 'ana@gmail.com',
        role: UserRole.USER,
        status: 'active',
        is_email_verified: true,
        profile: {
            full_name: 'Ana R',
            avatar_url: '/uploads/a.png',
            phone_number: '+919876543210',
            bio: 'hi',
            interests: ['chess'],
            social_links: { strava_id: 's1', instagram: null, linkedin: null, steam_id: null },
        },
        player_card: { card_tier: 'Rookie', stats: {} },
        points_balance: 120,
        announcements: { last_seen_at: null, read_ids: [] },
        settings: { notifications: { email: true, whatsapp: true }, privacy: { is_profile_public: true }, theme: 'system' },
        created_at: new Date(),
        ...over,
    } as unknown as IUser);

const self = { id: 'u-1', role: UserRole.USER };
const stranger = { id: 'u-2', role: UserRole.USER };
const core = { id: 'u-3', role: UserRole.CORE };
const coordinator = { id: 'u-4', role: UserRole.COORDINATOR };

assert.strictEqual(visibilityFor(mk(), self), 'full', 'a user sees their own record in full');
assert.strictEqual(visibilityFor(mk(), coordinator), 'full', 'coordinator sees full PII (§5.15.5)');
assert.strictEqual(visibilityFor(mk(), core), 'public', 'core sees the masked view by default');
assert.strictEqual(
    visibilityFor(mk(), core, true),
    'full',
    'core sees full PII only when elevated — i.e. it administers an event this user is registered for'
);
assert.strictEqual(
    visibilityFor(mk(), stranger, true),
    'full',
    'the elevated flag is resolved by piiScopeFor, which never returns a plain user'
);
assert.strictEqual(visibilityFor(mk(), undefined, true), 'public', 'elevated is meaningless without a viewer');
assert.strictEqual(visibilityFor(mk(), stranger), 'public', 'another user sees the masked view');
assert.strictEqual(visibilityFor(mk(), undefined), 'public', 'anonymous sees the masked view');

const privateUser = mk({
    settings: { notifications: { email: true, whatsapp: true }, privacy: { is_profile_public: false }, theme: 'system' },
});
assert.strictEqual(visibilityFor(privateUser, stranger), 'minimal', 'a private profile is minimal to strangers');
assert.strictEqual(visibilityFor(privateUser, self), 'full', 'a private profile is still full to its owner');
assert.strictEqual(visibilityFor(privateUser, coordinator), 'full', 'admins see through the privacy flag');

/* ------------------------------- serializer ------------------------------- */

const full = serializeUser(mk(), self);
assert.strictEqual(full.email, 'ana@gmail.com', 'self sees the real email');
assert.strictEqual(full.profile.phone_number, '+919876543210', 'self sees the real phone');
assert.ok(full.settings, 'self sees settings');

const pub = serializeUser(mk(), stranger);
assert.strictEqual(pub.email, 'a***@gmail.com', 'a stranger sees a masked email');
assert.strictEqual(pub.profile.phone_number, '+91******3210', 'a stranger sees a masked phone');
assert.strictEqual(pub.settings, undefined, 'settings are never public');
assert.strictEqual(pub.announcements, undefined, 'read state is never public');

const coreElevated = serializeUser(mk(), core, true);
assert.strictEqual(coreElevated.email, 'ana@bgsc.test'.replace('bgsc.test', 'gmail.com'), 'elevated core sees the real email');
assert.strictEqual(serializeUser(mk(), core, false).email, 'a***@gmail.com', 'unelevated core sees it masked');

const min = serializeUser(privateUser, stranger);
assert.strictEqual(min.private, true, 'a private profile is flagged so FE can render a stub');
assert.strictEqual(min.email, undefined, 'a private profile exposes no email at all, not even masked');
assert.strictEqual(min.profile.full_name, undefined, 'a private profile exposes no real name');
assert.ok(min.username && 'avatar_url' in min.profile, 'username and avatar survive for deep links (D9)');

// Secrets are select:false, but the serializer must not pass them through even if a caller opts in.
const withSecrets = serializeUser(
    mk({ password_hash: 'HASH', refresh_token_hash: 'RT', password_reset_token: 'PR' }),
    self
);
const flat = JSON.stringify(withSecrets);
for (const secret of ['HASH', 'RT', 'PR']) {
    assert.ok(!flat.includes(secret), `serialized output must never contain ${secret}`);
}

const snap = snapshotOf(mk());
assert.deepStrictEqual(
    snap,
    { user_id: 'u-1', display_name: 'Ana R', avatar_url: '/uploads/a.png' },
    'snapshot matches the shape six collections embed'
);
assert.strictEqual(
    snapshotOf(mk({ profile: { full_name: undefined } })).display_name,
    'ana',
    'snapshot falls back to username when there is no full name'
);

/* --------------------------------- rating --------------------------------- */

const r = computeRating({ participations: 3, podiums: 2, challenges: 4, points_balance: 260 });
assert.strictEqual(r.rating, 3 * 2 + 2 * 15 + 4 * 5 + 5, 'rating matches the D1 formula');
assert.strictEqual(r.formula_version, RATING_VERSION, 'result carries the formula version');
assert.strictEqual(
    computeRating({ participations: 0, podiums: 0, challenges: 0, points_balance: 0 }).rating,
    0,
    'a new user rates zero, not NaN'
);
assert.strictEqual(
    computeRating({ participations: 0, podiums: 0, challenges: 0, points_balance: 49 }).rating,
    0,
    'points below the divisor contribute nothing (floor, not round)'
);
assert.ok(RATING_WEIGHTS.podium > RATING_WEIGHTS.participation, 'winning outweighs showing up');

/* ------------------------------ image sniffing ---------------------------- */

const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(16)]);

assert.strictEqual(sniffImage(jpg), 'image/jpeg', 'detects jpeg');
assert.strictEqual(sniffImage(png), 'image/png', 'detects png');
assert.strictEqual(sniffImage(webp), 'image/webp', 'detects webp');
assert.strictEqual(sniffImage(Buffer.from('GIF89a-------------')), null, 'gif is not accepted');
assert.strictEqual(sniffImage(Buffer.from('<?php system($_GET[1]); ?>')), null, 'a php payload is not an image');
assert.strictEqual(sniffImage(Buffer.from('%PDF-1.7 ----------')), null, 'a pdf is not an image');
assert.strictEqual(sniffImage(Buffer.alloc(4)), null, 'a truncated buffer is rejected, not read past');

/* ---------------------------------- refs ---------------------------------- */

assert.ok(isUuid('3f2a1b4c-5d6e-4f7a-8b9c-0d1e2f3a4b5c'), 'accepts a v4 uuid');
assert.ok(!isUuid('ana'), 'a username is not a uuid');
assert.ok(!isUuid('3f2a1b4c5d6e4f7a8b9c0d1e2f3a4b5c'), 'an unhyphenated hex string is not a uuid');

console.log('user service selfcheck: all assertions passed');
