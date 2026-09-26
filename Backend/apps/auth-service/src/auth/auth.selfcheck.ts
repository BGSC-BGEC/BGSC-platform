/**
 * Runnable selfcheck for Auth Service schemas and token generation.
 *
 *   npx ts-node src/auth/auth.selfcheck.ts
 */
import assert from 'assert';
import jwt from 'jsonwebtoken';
import {
  RegisterSchema,
  LoginSchema,
  LogoutSchema,
  ResetPasswordSchema,
  SendPhoneOtpSchema,
  VerifyPhoneOtpSchema,
} from './auth.schemas';
import { AuthService, digestsMatch, isSafeReturnPath, sha256 } from './auth.service';
import { MailerService } from './mailer.service';
import { IUser, UserRole, config } from '@bgsc/shared';

/* ------------------------------- schemas ------------------------------- */

// RegisterSchema validation
const validReg = RegisterSchema.safeParse({
  email: 'athlete@bgsc.in',
  username: 'athlete_1',
  password: 'Password123!',
  full_name: 'Speedy Athlete',
});
assert.strictEqual(validReg.success, true, 'valid registration payload accepted');

const badEmail = RegisterSchema.safeParse({
  email: 'not-an-email',
  username: 'athlete',
  password: 'Password123!',
  full_name: 'Speedy',
});
assert.strictEqual(badEmail.success, false, 'invalid email rejected');

const badUsername = RegisterSchema.safeParse({
  email: 'athlete@bgsc.in',
  username: 'no spaces allowed!',
  password: 'Password123!',
  full_name: 'Speedy',
});
assert.strictEqual(badUsername.success, false, 'invalid username rejected');

const shortPassword = RegisterSchema.safeParse({
  email: 'athlete@bgsc.in',
  username: 'athlete',
  password: 'short',
  full_name: 'Speedy',
});
assert.strictEqual(shortPassword.success, false, 'short password rejected');

// Trim before measuring: a name of spaces used to pass and 500 at the database.
const reg = (over: Record<string, unknown>) =>
  RegisterSchema.safeParse({ email: 'a@bgsc.in', username: 'athlete', password: 'Password123!', full_name: 'Speedy', ...over });
assert.strictEqual(reg({ full_name: '   ' }).success, false, 'a whitespace-only full_name is refused');
assert.strictEqual(reg({ full_name: 'x'.repeat(121) }).success, false, 'full_name is capped at 120');
assert.strictEqual(reg({ username: '  ab ' }).success, false, 'username length is measured after trimming');
assert.strictEqual(reg({ email: '  Mixed@BGSC.in ' }).data?.email, 'mixed@bgsc.in', 'email trimmed and lowercased before checking');
for (const reserved of ['me', 'search', 'ME']) {
  assert.strictEqual(reg({ username: reserved }).success, false, `username "${reserved}" collides with a /users route`);
}
// bcrypt reads 72 bytes: a longer password would silently match any other with the same prefix.
assert.strictEqual(reg({ password: 'a'.repeat(72) }).success, true, '72 bytes is the most bcrypt reads');
assert.strictEqual(reg({ password: 'a'.repeat(73) }).success, false, '73 bytes is refused');
assert.strictEqual(reg({ password: 'é'.repeat(37) }).success, false, 'bytes, not characters: 37 × é is 74 bytes');
assert.strictEqual(ResetPasswordSchema.safeParse({ token: 't', new_password: 'a'.repeat(73) }).success, false,
  'a reset password has the same cap');
assert.strictEqual(LoginSchema.safeParse({ login: '   ', password: 'x' }).success, false, 'a blank login is refused');
assert.strictEqual(LogoutSchema.safeParse(undefined).success, true, 'logout needs no body');

// LoginSchema validation
const validLogin = LoginSchema.safeParse({
  login: 'athlete@bgsc.in',
  password: 'Password123!',
});
assert.strictEqual(validLogin.success, true, 'valid login accepted');

// Phone OTP Schemas
const validPhone = SendPhoneOtpSchema.safeParse({ phone_number: '+919876543210' });
assert.strictEqual(validPhone.success, true, 'valid phone accepted');

const badPhone = SendPhoneOtpSchema.safeParse({ phone_number: 'abc' });
assert.strictEqual(badPhone.success, false, 'invalid phone rejected');
assert.strictEqual(SendPhoneOtpSchema.safeParse({ phone_number: '+91 (98765) 432-10' }).data?.phone_number, '+919876543210',
  'one number, one spelling: separators are stripped before it is stored or compared');
assert.strictEqual(SendPhoneOtpSchema.safeParse({ phone_number: '9876543210' }).success, false, 'the country code is required');

const validOtp = VerifyPhoneOtpSchema.safeParse({
  phone_number: '+919876543210',
  otp: '123456',
});
assert.strictEqual(validOtp.success, true, 'valid 6-digit OTP accepted');

const badOtp = VerifyPhoneOtpSchema.safeParse({
  phone_number: '+919876543210',
  otp: '12345', // only 5 digits
});
assert.strictEqual(badOtp.success, false, '5-digit OTP rejected');

/* --------------------------- token generation --------------------------- */

const mockUser = {
  _id: '123e4567-e89b-12d3-a456-426614174000',
  role: UserRole.MEMBER,
  email: 'athlete@bgsc.in',
  username: 'athlete',
} as unknown as IUser;

const tokens = AuthService.generateTokenPair(mockUser);
assert.ok(tokens.access_token, 'access token generated');
assert.ok(tokens.refresh_token, 'refresh token generated');

// Verify access token adheres strictly to BE-2's requireAuth contract:
// { sub: <userId string>, role: <UserRole> }
const decodedAccess = jwt.verify(tokens.access_token, config.jwt.accessSecret) as any;
assert.strictEqual(decodedAccess.sub, mockUser._id, 'sub claim matches user _id');
assert.strictEqual(decodedAccess.role, UserRole.MEMBER, 'role claim matches user role');

// Verify refresh token uses refreshSecret
const decodedRefresh = jwt.verify(tokens.refresh_token, config.jwt.refreshSecret) as any;
assert.strictEqual(decodedRefresh.sub, mockUser._id, 'refresh token sub matches user _id');

// bcrypt reads only 72 bytes, which for a refresh JWT is the header plus half the
// user id — so every refresh token of one user shared a "hash". The digest covers the whole token,
// and the jti makes two tokens minted in the same second differ at all.
const again = AuthService.generateTokenPair(mockUser);
assert.notStrictEqual(again.refresh_token, tokens.refresh_token, 'two refresh tokens are never identical');
assert.strictEqual(
  again.refresh_token.slice(0, 72),
  tokens.refresh_token.slice(0, 72),
  'they share the first 72 bytes — exactly what bcrypt would have compared'
);
assert.ok(!digestsMatch(sha256(again.refresh_token), sha256(tokens.refresh_token)), 'the stored digest tells them apart');
assert.ok(digestsMatch(sha256(tokens.refresh_token), sha256(tokens.refresh_token)), 'and matches the right one');
assert.ok(!digestsMatch('abc', 'abcd'), 'a length mismatch is a mismatch, not a throw');

/* ------------------------------ return paths ----------------------------- */

assert.ok(isSafeReturnPath('/events/42?tab=teams'), 'a relative path is a valid OAuth return path');
for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', '/\t/evil.example', '/a\\b', 'events', '/' + 'x'.repeat(200)]) {
  assert.ok(!isSafeReturnPath(bad), `not a return path: ${bad.slice(0, 20)}`);
}

/* ------------------------ production mail log has no PII ------------------- */

void (async () => {
  const cfg = config as unknown as { nodeEnv: string };
  const realEnv = cfg.nodeEnv;
  const realLog = console.log;
  const lines: string[] = [];
  cfg.nodeEnv = 'production';
  console.log = (...a: unknown[]) => void lines.push(a.map(String).join(' '));
  try {
    await MailerService.sendVerificationEmail('u-1', 'secret@x.example', 'tok-secret');
    await MailerService.sendPasswordResetEmail('u-1', 'secret@x.example', 'tok-secret');
  } finally {
    console.log = realLog;
    cfg.nodeEnv = realEnv;
  }
  const out = lines.join('\n');
  assert.ok(out.includes('u-1'), 'the production stub names the user by id');
  assert.ok(!out.includes('secret@x.example') && !out.includes('tok-secret'), 'and never logs the address or token');

  console.log('auth service selfcheck: all assertions passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
