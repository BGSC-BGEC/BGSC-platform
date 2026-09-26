import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { ACCOUNT_DELETION_GRACE_DAYS, AuditLog, IUser, ServiceError, TOKEN_ALGORITHMS, User, UserRole, UserStatus, config, publish, recordAudit } from '@bgsc/shared';
import { MailerService } from './mailer.service';
import {
  RegisterInput,
  LoginInput,
  ResetPasswordInput,
} from './auth.schemas';

export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
    username: string;
    role: UserRole;
    status: UserStatus;
    is_email_verified: boolean;
    profile: IUser['profile'];
  };
  tokens: TokenPair;
}

/** Wrong guesses allowed per OTP window. A resend does not buy more (see sendPhoneOtp). */
export const OTP_MAX_ATTEMPTS = 3;
const OTP_TTL_MS = 5 * 60 * 1000;
/** The Google callback's one-time login code: long enough for one redirect, no longer. */
const LOGIN_CODE_TTL_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Replay window and page for the UserRestored sweep. */
export const RESTORE_REPLAY_WINDOW_MS = 7 * DAY_MS;
const RESTORE_REPLAY_PAGE = 500;

/**
 * A caller-supplied OAuth return path must be a same-site relative path. Anything else — a full
 * URL, `//evil.example`, `/\evil.example` — would turn the frontend's post-login redirect into an
 * open redirect carrying a fresh session. Control characters and backslashes are refused anywhere:
 * browsers strip tab/CR/LF while parsing, so `/\t/evil.example` would otherwise become `//evil.example`.
 */
export const isSafeReturnPath = (p: string): boolean => p.length <= 200 && /^\/(?![/\\])[^\x00-\x1f\x7f\\]*$/.test(p);

/**
 * One-time secrets are stored as sha256 digests. sha256, not bcrypt: every one of these is 256
 * random bits (or a signed JWT), so there is nothing to slow down, and bcrypt silently ignores
 * everything past byte 72 — which for a refresh JWT is the header plus half the user id, so every
 * refresh token a user was ever issued matched the stored hash (audit Sep 26, C3).
 */
export const sha256 = (value: string): string => crypto.createHash('sha256').update(value).digest('hex');

export function digestsMatch(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/**
 * Compared against when there is no real hash, so "no such user" costs the same bcrypt round as
 * "wrong password". Otherwise response time alone says which logins exist.
 */
const TIMING_DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);

export class AuthService {
  /**
   * Access token (15m, accessSecret) and refresh token (7d, refreshSecret). The refresh token
   * carries a random `jti`: without one, two tokens minted for one user in the same second are
   * byte-identical, and rotation would hand back the token it was meant to retire.
   *
   * `sid` names the session family: minted fresh at every sign-in, carried unchanged through every
   * rotation. Replay detection revokes only when the replayed token belongs to the CURRENT family —
   * an old device's leftover token is a plain 401, not a reason to log out the newer device.
   */
  static generateTokenPair(user: IUser, sid: string = crypto.randomUUID()): TokenPair {
    const access_token = jwt.sign(
      { sub: user._id, role: user.role },
      config.jwt.accessSecret,
      { expiresIn: config.jwt.accessExpiresIn } as jwt.SignOptions
    );

    const refresh_token = jwt.sign(
      { sub: user._id, sid, jti: crypto.randomUUID() },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn } as jwt.SignOptions
    );

    return { access_token, refresh_token };
  }

  /** The fields that make `tokens` the account's current session. */
  static sessionSet(tokens: TokenPair): { refresh_token_hash: string; refresh_session_id: string } {
    const { sid } = jwt.decode(tokens.refresh_token) as { sid: string };
    return { refresh_token_hash: sha256(tokens.refresh_token), refresh_session_id: sid };
  }

  /**
   * Formats the public user response (excluding internal secrets).
   */
  static formatUser(user: IUser) {
    return {
      id: user._id,
      email: user.email,
      username: user.username,
      role: user.role,
      status: user.status,
      is_email_verified: user.is_email_verified,
      profile: user.profile,
    };
  }

  /**
   * Every path that mints a token pair runs this first.
   *
   * `login` and `reactivateAccount` checked account status and the others did not, so a suspended
   * user could keep minting access tokens from a refresh token indefinitely — suspension did
   * nothing — and a soft-deleted one could skip the grace-period flow entirely by refreshing or by
   * clicking their email-verification link. One guard, called from every minting path, so a new
   * one cannot quietly forget.
   */
  private static assertUsable(user: IUser): void {
    if (user.status === UserStatus.DELETED) {
      throw new ServiceError(403, 'account_deactivated');
    }
    if (user.status === UserStatus.SUSPENDED) {
      throw new ServiceError(403, 'forbidden');
    }
  }

  /**
   * Registers a new user.
   */
  static async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await User.findOne({
      $or: [{ email: input.email }, { username: input.username }],
    });

    if (existing) {
      throw new ServiceError(409, 'conflict');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + DAY_MS);

    let user: IUser;
    try {
      user = await User.create({
        email: input.email,
        username: input.username,
        password_hash: passwordHash,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        is_email_verified: false,
        email_verification_token: sha256(verificationToken),
        email_verification_expires: verificationExpires,
        profile: {
          full_name: input.full_name,
          avatar_url: null,
          phone_number: null,
          bio: '',
          interests: [],
          social_links: {
            strava_id: null,
            instagram: null,
            linkedin: null,
            steam_id: null,
          },
        },
        player_card: {
          card_tier: 'Rookie',
          stats: {},
        },
        settings: {
          notifications: { email: true, whatsapp: true },
          privacy: { is_profile_public: true },
          theme: 'system',
        },
      });
    } catch (err) {
      // Two sign-ups for one email/username in the same instant: the unique index decides, and the
      // loser gets the same 409 the pre-check would have given it, not a 500.
      if ((err as { code?: number }).code === 11000) throw new ServiceError(409, 'conflict');
      throw err;
    }

    const tokens = this.generateTokenPair(user);
    await User.updateOne({ _id: user._id }, { $set: this.sessionSet(tokens) });

    await MailerService.sendVerificationEmail(user._id, user.email, verificationToken);

    // Id only: no consumer needs the address, and the bus is not a place for PII.
    publish('UserRegistered', 'auth-service', { user_id: user._id });

    return {
      user: this.formatUser(user),
      tokens,
    };
  }

  /**
   * Logs in a user via email or username.
   *
   * The password is checked before anything about the account is disclosed. This used to answer a
   * deleted account's countdown and a suspended account's 403 to anyone who typed the username,
   * and skipped bcrypt entirely for unknown users — a status oracle and a timing oracle.
   */
  static async login(
    input: LoginInput
  ): Promise<AuthResult | { account_status: string; days_remaining: number }> {
    const loginQuery = input.login.toLowerCase();
    const user = await User.findOne({
      $or: [{ email: loginQuery }, { username: loginQuery }],
    }).select('+password_hash +refresh_token_hash');

    const isMatch = await bcrypt.compare(input.password, user?.password_hash ?? TIMING_DUMMY_HASH);
    if (!user || !user.password_hash || !isMatch) {
      throw new ServiceError(401, 'unauthorized');
    }

    // Soft-deleted: the owner (password proven) is told how long a restore remains possible.
    if (user.status === UserStatus.DELETED) {
      const until = this.restorableUntil(user);
      if (until && Date.now() <= until.getTime()) {
        return {
          account_status: 'scheduled_for_deletion',
          days_remaining: Math.max(0, Math.ceil((until.getTime() - Date.now()) / DAY_MS)),
        };
      }
      throw new ServiceError(401, 'unauthorized');
    }

    // DELETED is handled above with a countdown, which is why login does not simply delegate.
    this.assertUsable(user);

    // Conditional on the password hash and status just checked. A password reset (or a suspension)
    // landing between the compare and this write used to be overwritten by a fresh session minted
    // from the OLD password — the reset's session revocation silently undone.
    const tokens = this.generateTokenPair(user);
    const now = new Date();
    const started = await User.updateOne(
      { _id: user._id, password_hash: user.password_hash, status: user.status, deleted_at: null },
      { $set: { ...this.sessionSet(tokens), last_login_at: now, last_active_at: now } }
    );
    if (started.matchedCount === 0) {
      throw new ServiceError(401, 'unauthorized');
    }
    user.last_login_at = now;

    publish('UserLoggedIn', 'auth-service', {
      user_id: user._id,
    });

    return {
      user: this.formatUser(user),
      tokens,
    };
  }

  /**
   * The stamped `restorable_until` wins over recomputing from `deleted_at`: it is what the user was
   * told at deletion time and what User Service reports.
   */
  private static restorableUntil(user: IUser): Date | null {
    if (!user.deleted_at) return null;
    return (
      user.deletion?.restorable_until ??
      new Date(user.deleted_at.getTime() + ACCOUNT_DELETION_GRACE_DAYS * DAY_MS)
    );
  }

  /**
   * Refreshes access token with single-use token rotation.
   *
   * One session per account (the stored digest + its family `sid`). A presented token of the
   * CURRENT family that is not the current token is a rotated-out token being replayed — possible
   * theft — so the session is ended. A token of an older family (another device, since replaced by
   * a newer sign-in) is just stale: plain 401, and the newer session survives. Rotation is a
   * compare-and-swap on the digest: of two refreshes racing on the same token, exactly one wins.
   *
   * ponytail: one refresh digest per user, so a second device's login retires the first device's
   * session. Store a digest per device when multi-device sessions are wanted.
   */
  static async refreshToken(oldRefreshToken: string): Promise<TokenPair> {
    let payload: { sub: string; sid?: string };
    try {
      // Algorithms pinned, exactly as the access-token verifier pins them: an unpinned verifier
      // would accept a token an attacker signed with HS256 using the public key, if this ever
      // moves to RS256. The refresh token is the long-lived one, so it is the worse one to leave open.
      payload = jwt.verify(oldRefreshToken, config.jwt.refreshSecret, {
        algorithms: TOKEN_ALGORITHMS,
      }) as { sub: string; sid?: string };
    } catch {
      throw new ServiceError(401, 'unauthorized');
    }
    if (typeof payload.sub !== 'string') throw new ServiceError(401, 'unauthorized');

    const user = await User.findById(payload.sub).select('+refresh_token_hash +refresh_session_id');
    if (!user || !user.refresh_token_hash) {
      throw new ServiceError(401, 'unauthorized');
    }

    // A refresh token outlives the session that made it, so status is re-checked on every use.
    this.assertUsable(user);

    const presented = sha256(oldRefreshToken);
    if (!digestsMatch(presented, user.refresh_token_hash)) {
      const sameFamily =
        typeof payload.sid === 'string' &&
        typeof user.refresh_session_id === 'string' &&
        digestsMatch(payload.sid, user.refresh_session_id);
      if (sameFamily) {
        // Replay of a retired token of the live session: end it. Conditional on the digest we
        // read, so this cannot wipe a session that rotated again in the meantime.
        await User.updateOne(
          { _id: user._id, refresh_token_hash: user.refresh_token_hash },
          { $set: { refresh_token_hash: null, refresh_session_id: null } }
        );
      }
      throw new ServiceError(401, 'unauthorized');
    }

    // Same family carries on; a legacy token without a sid starts one.
    const tokens = this.generateTokenPair(user, payload.sid ?? crypto.randomUUID());
    const rotated = await User.updateOne(
      { _id: user._id, refresh_token_hash: presented },
      { $set: { ...this.sessionSet(tokens), last_active_at: new Date() } }
    );
    if (rotated.matchedCount === 0) {
      // Lost the race to a concurrent refresh with the same token.
      throw new ServiceError(401, 'unauthorized');
    }

    return tokens;
  }

  /**
   * Terminates active session.
   */
  static async logout(userId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      $set: { refresh_token_hash: null, refresh_session_id: null },
    });
  }

  /**
   * Verifies user email via one-time verification token.
   *
   * Marks the address verified and nothing else. It used to mint a token pair, which made a
   * 24-hour link sitting in an inbox (or a Referer header) a password-free login.
   */
  static async verifyEmail(token: string): Promise<{ is_email_verified: true }> {
    // Consumed atomically: the same link clicked twice verifies once.
    const user = await User.findOneAndUpdate(
      {
        email_verification_token: sha256(token),
        email_verification_expires: { $gt: new Date() },
      },
      { $set: { is_email_verified: true, email_verification_token: null, email_verification_expires: null } },
      { returnDocument: 'after' }
    );

    if (!user) {
      throw new ServiceError(400, 'invalid_or_expired_token');
    }

    publish('UserEmailVerified', 'auth-service', {
      user_id: user._id,
    });

    return { is_email_verified: true };
  }

  /**
   * Resends verification email.
   */
  static async resendVerification(email: string): Promise<void> {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || user.is_email_verified) {
      return; // Generic success to prevent email enumeration
    }

    const token = crypto.randomBytes(32).toString('hex');
    await User.updateOne(
      { _id: user._id },
      { $set: { email_verification_token: sha256(token), email_verification_expires: new Date(Date.now() + DAY_MS) } }
    );

    await MailerService.sendVerificationEmail(user._id, user.email, token);
  }

  /**
   * Generates password reset token and sends email.
   */
  static async forgotPassword(email: string): Promise<void> {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return; // Generic success to prevent email enumeration
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    await User.updateOne(
      { _id: user._id },
      { $set: { password_reset_token: sha256(resetToken), password_reset_expires: new Date(Date.now() + 60 * 60 * 1000) } }
    );

    await MailerService.sendPasswordResetEmail(user._id, user.email, resetToken);
  }

  /**
   * Resets password using valid token. Consumed atomically, so one token resets once.
   */
  static async resetPassword(input: ResetPasswordInput): Promise<void> {
    const passwordHash = await bcrypt.hash(input.new_password, 10);
    const user = await User.findOneAndUpdate(
      {
        password_reset_token: sha256(input.token),
        password_reset_expires: { $gt: new Date() },
      },
      {
        $set: {
          password_hash: passwordHash,
          password_reset_token: null,
          password_reset_expires: null,
          refresh_token_hash: null, // Revoke active sessions
          refresh_session_id: null,
        },
      }
    );

    if (!user) {
      throw new ServiceError(400, 'invalid_or_expired_token');
    }
  }

  /**
   * Reactivates account within the 45-day grace period.
   *
   * Restores the status the account had when it was deleted (`deletion.prior_status`), and refuses
   * outright when that was `suspended`: otherwise a suspended user could delete with a still-valid
   * access token and come straight back as active, which made suspension optional.
   */
  static async reactivateAccount(login: string, password: string, ip: string | null = null): Promise<AuthResult> {
    const loginQuery = login.toLowerCase();
    const user = await User.findOne({
      $or: [{ email: loginQuery }, { username: loginQuery }],
      status: UserStatus.DELETED,
    }).select('+password_hash');

    // Password first, always a bcrypt round: neither existence nor the window leaks to a stranger.
    const isMatch = await bcrypt.compare(password, user?.password_hash ?? TIMING_DUMMY_HASH);
    if (!user || !user.deleted_at || !user.password_hash || !isMatch) {
      throw new ServiceError(401, 'unauthorized');
    }

    const until = this.restorableUntil(user)!;
    if (new Date() > until) {
      throw new ServiceError(410, 'account_permanently_deleted');
    }

    const prior = await this.priorStatusOf(user);
    if (prior === null) {
      // No stamped status and no deletion audit row to read it from: a human decides.
      throw new ServiceError(403, 'admin_review_required');
    }
    if (prior === UserStatus.SUSPENDED) {
      throw new ServiceError(403, 'forbidden');
    }
    const restoredStatus = prior === UserStatus.PENDING_VERIFICATION ? prior : UserStatus.ACTIVE;

    const previous = { status: user.status, deleted_at: user.deleted_at };
    const deletionBlock = user.toObject().deletion ?? null;
    const tokens = this.generateTokenPair(user);

    // Claim the restore atomically. Read-then-save would let two simultaneous reactivations both
    // succeed and write two audit rows for one event; whoever flips deleted_at back wins.
    const claimed = await User.findOneAndUpdate(
      // password_hash pinned too: a reset landing mid-request must not be undone by this session.
      { _id: user._id, status: UserStatus.DELETED, deleted_at: { $ne: null }, password_hash: user.password_hash },
      {
        $set: {
          status: restoredStatus,
          deleted_at: null,
          // Cleared with the restore — a stale block would leave the account reading as
          // pending-deletion to every serializer that checks it.
          deletion: null,
          // What the UserRestored replay sweep keys on.
          restored_at: new Date(),
          ...this.sessionSet(tokens),
        },
      },
      { returnDocument: 'after' }
    );

    if (!claimed) {
      // Someone else restored it between the read and the write.
      throw new ServiceError(409, 'not_deleted');
    }

    // Restoring an account is an auditable lifecycle event, exactly as deleting one is. Claim,
    // audit, and roll the claim back if the audit cannot be written — never a restore with no trail.
    try {
      await recordAudit({
        actor_id: claimed._id,
        action: 'user.restored',
        target_type: 'user',
        target_id: claimed._id,
        previous_value: previous,
        new_value: { status: restoredStatus, deleted_at: null },
        reason: 'self-service reactivation within the window',
        ip,
      });
    } catch (auditErr) {
      await User.updateOne(
        { _id: user._id },
        { $set: { status: UserStatus.DELETED, deleted_at: user.deleted_at, deletion: deletionBlock, restored_at: user.restored_at ?? null, refresh_token_hash: null, refresh_session_id: null } }
      ).catch((rollbackErr) =>
        console.error('CRITICAL: restore audit failed and rollback failed. Unaudited restore.', { auditErr, rollbackErr })
      );
      throw auditErr;
    }

    publish('UserRestored', 'auth-service', { user_id: claimed._id });

    return {
      user: this.formatUser(claimed),
      tokens,
    };
  }

  /**
   * The status an account had when it was deleted. Stamped on `deletion.prior_status` since Sep 26;
   * older deletion blocks predate it, and a default of `active` would have waved every pre-existing
   * suspended-then-deleted account back in. For those, the deletion's own audit row recorded the
   * status it replaced. No stamp and no row: `null`, and the caller refuses.
   */
  static async priorStatusOf(user: IUser): Promise<UserStatus | null> {
    const stamped = user.deletion?.prior_status;
    if (stamped) return stamped;

    const row = await AuditLog.findOne({ target_type: 'user', target_id: user._id, action: 'user.deleted' })
      .sort({ created_at: -1 })
      .lean();
    const recorded = (row?.previous_value as { status?: unknown } | null | undefined)?.status;
    return typeof recorded === 'string' && (Object.values(UserStatus) as string[]).includes(recorded)
      ? (recorded as UserStatus)
      : null;
  }

  /**
   * Replay sweep. There is no outbox: a `UserRestored` lost between the claim and a
   * consumer (bus down, consumer restarting) left that user anonymised in every service holding a
   * snapshot. Re-publishing every restore of the last 7 days is safe because consumers re-snapshot
   * from `users` — idempotent by construction.
   *
   * ponytail: bounded page, newest first, every instance. Paginate if >500 restores a week happens.
   */
  static async replayRestored(now: Date = new Date()): Promise<number> {
    const users = await User.find({
      restored_at: { $gte: new Date(now.getTime() - RESTORE_REPLAY_WINDOW_MS) },
      deleted_at: null,
    })
      .select('_id')
      .sort({ restored_at: -1 })
      .limit(RESTORE_REPLAY_PAGE)
      .lean();
    for (const u of users) publish('UserRestored', 'auth-service', { user_id: u._id });
    return users.length;
  }

  /**
   * Generates Google OAuth consent URL.
   *
   * `nonce` is the value the controller also puts in an HttpOnly cookie. The callback accepts the
   * state only when the two agree, which ties the flow to the browser that started it.
   */
  static getGoogleAuthUrl(nonce: string, state?: string): string {
    if (!config.google.clientId || !config.google.clientSecret) {
      throw new ServiceError(503, 'google_oauth_not_configured');
    }

    const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    const params = new URLSearchParams({
      client_id: config.google.clientId,
      redirect_uri: config.google.callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
      state: this.signState(nonce, state),
    });

    return `${rootUrl}?${params.toString()}`;
  }

  /**
   * OAuth CSRF protection (RFC 6749 §10.12).
   *
   * A signed state alone proved nothing: anyone could mint one by visiting `/auth/google`, finish
   * consent with their own Google account, and hand a victim the callback URL — logging the victim
   * into the attacker's account (audit Sep 26). The nonce inside the signed state must now equal the
   * nonce cookie set on the browser that started the flow, and an attacker cannot plant that cookie.
   *
   * The caller's own `state` (a return path, typically) rides along and comes back out.
   */
  static signState(nonce: string, caller?: string): string {
    if (caller !== undefined && !isSafeReturnPath(caller)) {
      throw new ServiceError(400, 'invalid_return_path');
    }
    return jwt.sign({ typ: 'oauth_state', nonce, s: caller ?? null }, config.jwt.accessSecret, {
      algorithm: 'HS256',
      expiresIn: '10m',
    });
  }

  static verifyState(state: string | undefined, cookieNonce: string | undefined): string | null {
    if (!state || !cookieNonce) {
      throw new ServiceError(400, 'invalid_oauth_state');
    }
    let payload: { typ?: string; nonce?: string; s?: string | null };
    try {
      payload = jwt.verify(state, config.jwt.accessSecret, {
        algorithms: TOKEN_ALGORITHMS,
      }) as typeof payload;
    } catch {
      // Expired or forged: both mean this callback did not start here.
      throw new ServiceError(400, 'invalid_oauth_state');
    }
    if (payload.typ !== 'oauth_state' || typeof payload.nonce !== 'string' || !digestsMatch(payload.nonce, cookieNonce)) {
      throw new ServiceError(400, 'invalid_oauth_state');
    }
    // Re-checked on the way out, so a state signed before the rule existed cannot smuggle one through.
    return typeof payload.s === 'string' && isSafeReturnPath(payload.s) ? payload.s : null;
  }

  /**
   * Exchanges the authorization code and resolves (links or creates) the local account. Mints nothing.
   */
  private static async resolveGoogleUser(code: string): Promise<IUser> {
    if (!config.google.clientId || !config.google.clientSecret) {
      throw new ServiceError(503, 'google_oauth_not_configured');
    }

    // 1. Exchange code for Google tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri: config.google.callbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      throw new ServiceError(401, 'google_token_exchange_failed');
    }

    const tokenData = (await tokenResponse.json()) as { access_token: string };

    // 2. Fetch user profile from Google
    const userinfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userinfoResponse.ok) {
      throw new ServiceError(401, 'google_userinfo_failed');
    }

    return this.upsertGoogleUser(
      (await userinfoResponse.json()) as GoogleProfile
    );
  }

  /**
   * Links or creates the account for a Google profile. Split out so the linking rules are
   * checkable without Google.
   *
   * Only a Google-VERIFIED email may match an existing account. Google lets an account carry an
   * address it never verified, so matching on the bare email let anyone who registered a Google
   * account with a victim's address sign in as the victim (audit Sep 26).
   */
  static async upsertGoogleUser(googleUser: GoogleProfile): Promise<IUser> {
    if (!googleUser.id || typeof googleUser.email !== 'string' || !googleUser.email) {
      throw new ServiceError(401, 'google_userinfo_failed');
    }
    if (googleUser.verified_email !== true) {
      throw new ServiceError(401, 'google_email_unverified');
    }

    const email = googleUser.email.toLowerCase();
    // google_id first: it is the stable identity. Email only when no account holds this google_id.
    let user = await User.findOne({ google_id: googleUser.id }).select('+google_id');
    let linkingByEmail = false;
    if (!user) {
      user = await User.findOne({ email }).select('+google_id');
      // Already linked to a different Google account: never re-link by email.
      if (user && user.google_id && user.google_id !== googleUser.id) {
        throw new ServiceError(409, 'conflict');
      }
      linkingByEmail = !!user;
    }

    if (user) {
      // Without this, Google sign-in was a way around the gates entirely: a soft-deleted account
      // got a fresh token pair and stayed `deleted`, and a suspended one simply logged in.
      this.assertUsable(user);

      if (linkingByEmail && !user.is_email_verified) {
        await this.evictUnprovenCredentials(user);
      }

      if (!user.google_id) {
        user.google_id = googleUser.id;
      }
      user.is_email_verified = true;
      user.last_login_at = new Date();
      user.last_active_at = new Date();
      await user.save();
      return user;
    }

    let baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
    if (baseUsername.length < 3) baseUsername = `user_${baseUsername}`;
    let candidate = baseUsername;
    let counter = 1;
    while (await User.findOne({ username: candidate })) {
      candidate = `${baseUsername}_${counter++}`;
    }

    // The probe above races other first sign-ins. Losing it on the USERNAME is not a conflict —
    // retry with a random suffix (3 tries). Losing it on the EMAIL is: same person, two tabs.
    let created: IUser;
    for (let attempt = 0; ; attempt++) {
      try {
        created = await this.createGoogleUser(googleUser, email, candidate);
        break;
      } catch (err) {
        const dup = err as { code?: number; keyPattern?: Record<string, unknown> };
        if (dup.code === 11000 && dup.keyPattern?.username && attempt < 3) {
          candidate = `${baseUsername}_${crypto.randomBytes(3).toString('hex')}`;
          continue;
        }
        if (dup.code === 11000) throw new ServiceError(409, 'conflict');
        throw err;
      }
    }

    publish('UserRegistered', 'auth-service', { user_id: created._id });
    return created;
  }

  /**
   * Pre-account takeover: someone registers with the victim's address (never verifying it) and a
   * password of their choosing, then waits. When the real owner signs in with Google, the account
   * is linked to them — and before this, the squatter's password (and any live session, reset or
   * verification link) kept working on it. Linking to an unverified account therefore clears every
   * credential the email's owner did not prove, and audits it.
   */
  private static async evictUnprovenCredentials(user: IUser): Promise<void> {
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          password_hash: null,
          refresh_token_hash: null,
          refresh_session_id: null,
          password_reset_token: null,
          password_reset_expires: null,
          email_verification_token: null,
          email_verification_expires: null,
          oauth_login_code_hash: null,
          oauth_login_code_expires: null,
        },
      }
    );
    await recordAudit({
      actor_id: user._id,
      action: 'user.google_linked_unverified',
      target_type: 'user',
      target_id: user._id,
      previous_value: { is_email_verified: false, password: 'set-by-unverified-registrant' },
      new_value: { is_email_verified: true, password: null },
      reason: 'Google-verified email linked to an unverified account; prior credentials cleared',
    });
  }

  private static async createGoogleUser(googleUser: GoogleProfile, email: string, candidate: string): Promise<IUser> {
    return await User.create({
      email,
      username: candidate,
      google_id: googleUser.id,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      is_email_verified: true,
      profile: {
        full_name: googleUser.name || candidate,
        avatar_url: googleUser.picture || null,
        phone_number: null,
        bio: '',
        interests: [],
        social_links: {
          strava_id: null,
          instagram: null,
          linkedin: null,
          steam_id: null,
        },
      },
      player_card: {
        card_tier: 'Rookie',
        stats: {},
      },
      settings: {
        notifications: { email: true, whatsapp: true },
        privacy: { is_profile_public: true },
        theme: 'system',
      },
    });
  }

  /** Mints a session for an account whose identity is already established. */
  private static async startSession(user: IUser): Promise<AuthResult> {
    const tokens = this.generateTokenPair(user);
    // Conditional on the account still being usable: a suspension or deletion landing after the
    // status check must not be answered with a live session.
    const started = await User.updateOne(
      { _id: user._id, deleted_at: null, status: { $nin: [UserStatus.DELETED, UserStatus.SUSPENDED] } },
      { $set: this.sessionSet(tokens) }
    );
    if (started.matchedCount === 0) throw new ServiceError(401, 'unauthorized');

    publish('UserLoggedIn', 'auth-service', {
      user_id: user._id,
    });

    return {
      user: this.formatUser(user),
      tokens,
    };
  }

  /**
   * Handles Google OAuth callback and returns tokens (non-browser callers, which receive them in
   * the response body rather than a URL).
   */
  static async handleGoogleCallback(code: string): Promise<AuthResult> {
    return this.startSession(await this.resolveGoogleUser(code));
  }

  /**
   * Browser callers get a one-time login code instead of the tokens. Tokens in a redirect URL land
   * in browser history, proxy and access logs; this code is single-use, lives 60 seconds, and is
   * worthless once the frontend has swapped it at POST /auth/google/exchange.
   */
  static async googleLoginCode(code: string): Promise<string> {
    const user = await this.resolveGoogleUser(code);
    const loginCode = crypto.randomBytes(32).toString('hex');
    await User.updateOne(
      { _id: user._id },
      { $set: { oauth_login_code_hash: sha256(loginCode), oauth_login_code_expires: new Date(Date.now() + LOGIN_CODE_TTL_MS) } }
    );
    return loginCode;
  }

  static async exchangeLoginCode(loginCode: string): Promise<AuthResult> {
    // Consumed atomically: a replayed code finds nothing.
    const user = await User.findOneAndUpdate(
      { oauth_login_code_hash: sha256(loginCode), oauth_login_code_expires: { $gt: new Date() } },
      { $set: { oauth_login_code_hash: null, oauth_login_code_expires: null } },
      { returnDocument: 'after' }
    );
    if (!user) throw new ServiceError(401, 'unauthorized');
    // Status can change inside the minute between callback and exchange.
    this.assertUsable(user);
    return this.startSession(user);
  }

  /**
   * Generates and dispatches a 6-digit Phone verification OTP.
   *
   * A resend inside a live window replaces the code but keeps the attempt count: resetting it made
   * "resend" a way to buy three fresh guesses on demand. Once the window is spent (three wrong
   * guesses), no new code until it expires.
   */
  static async sendPhoneOtp(
    userId: string,
    phoneNumber: string
  ): Promise<{ message: string; expires_in: number }> {
    const exists = await User.exists({ _id: userId });
    if (!exists) {
      throw new ServiceError(401, 'unauthorized');
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const now = new Date();
    const fresh = {
      pending_phone_number: phoneNumber,
      phone_verification_otp_hash: await bcrypt.hash(otp, 10),
      phone_verification_expires: new Date(now.getTime() + OTP_TTL_MS),
    };

    // Window still open and guesses left: new code, same count. Conditional updates, not a
    // read-then-save, so a racing verify's $inc is never overwritten with a stale count.
    const kept = await User.updateOne(
      { _id: userId, phone_verification_expires: { $gt: now }, phone_verification_attempts: { $lt: OTP_MAX_ATTEMPTS } },
      { $set: fresh }
    );
    if (kept.matchedCount === 0) {
      const reopened = await User.updateOne(
        { _id: userId, $or: [{ phone_verification_expires: null }, { phone_verification_expires: { $lte: now } }] },
        { $set: { ...fresh, phone_verification_attempts: 0 } }
      );
      if (reopened.matchedCount === 0) {
        throw new ServiceError(429, 'too_many_attempts');
      }
    }

    if (config.nodeEnv === 'development' || config.nodeEnv === 'test') {
      console.log('----------------------------------------------------');
      console.log(`📱 [DEV SMS/WhatsApp OTP] To: ${phoneNumber}`);
      console.log(`Your BGSC verification OTP is: ${otp} (valid for 5 mins)`);
      console.log('----------------------------------------------------');
    } else {
      console.log(`[PROD SMS STUB] OTP dispatched for user ${userId}`); // user id only: no phone numbers in prod logs
    }

    return {
      message: 'otp_sent',
      expires_in: OTP_TTL_MS / 1000,
    };
  }

  /**
   * Verifies the 6-digit Phone OTP and marks phone verified.
   *
   * The attempt is spent with an atomic `$inc` BEFORE the guess is compared. The old
   * read-check-save let N parallel requests all read `attempts = 0` and all get a guess.
   */
  static async verifyPhoneOtp(
    userId: string,
    phoneNumber: string,
    otp: string
  ): Promise<{ message: string; is_phone_verified: boolean }> {
    const now = new Date();
    const user = await User.findOneAndUpdate(
      {
        _id: userId,
        phone_verification_otp_hash: { $type: 'string' },
        phone_verification_expires: { $gt: now },
        phone_verification_attempts: { $lt: OTP_MAX_ATTEMPTS },
      },
      { $inc: { phone_verification_attempts: 1 } },
      { returnDocument: 'after' }
    ).select('+phone_verification_otp_hash +pending_phone_number');

    if (!user) {
      // Say which precondition failed; the attempt was not spent.
      const current = await User.findById(userId).select(
        '+phone_verification_otp_hash +phone_verification_expires +phone_verification_attempts'
      );
      if (!current || !current.phone_verification_otp_hash || !current.phone_verification_expires) {
        throw new ServiceError(400, 'no_otp_pending');
      }
      if (current.phone_verification_expires <= now) {
        throw new ServiceError(400, 'otp_expired');
      }
      throw new ServiceError(429, 'too_many_attempts');
    }

    if (user.pending_phone_number !== phoneNumber) {
      throw new ServiceError(400, 'phone_number_mismatch');
    }

    const otpHash = user.phone_verification_otp_hash!;
    if (!(await bcrypt.compare(otp, otpHash))) {
      throw new ServiceError(400, 'invalid_otp');
    }

    // The unique index is the real guard; this turns losing that race into a clear refusal
    // instead of a duplicate-key error surfacing as a 500.
    const taken = await User.findOne({
      _id: { $ne: user._id },
      'profile.phone_number': phoneNumber,
      is_phone_verified: true,
    }).select('_id');
    if (taken) {
      throw new ServiceError(409, 'phone_number_taken');
    }

    try {
      // Conditional on the code just checked: a resend in between voids this success.
      const done = await User.updateOne(
        { _id: user._id, phone_verification_otp_hash: otpHash },
        {
          $set: {
            'profile.phone_number': phoneNumber,
            is_phone_verified: true,
            pending_phone_number: null,
            phone_verification_otp_hash: null,
            phone_verification_expires: null,
            phone_verification_attempts: 0,
          },
        }
      );
      if (done.matchedCount === 0) throw new ServiceError(400, 'no_otp_pending');
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 11000) {
        throw new ServiceError(409, 'phone_number_taken');
      }
      throw err;
    }

    // Id only: the number is PII and no consumer needs it on the bus.
    publish('UserPhoneVerified', 'auth-service', { user_id: user._id });

    return {
      message: 'phone_verified',
      is_phone_verified: true,
    };
  }
}

/** The fields of Google's v2 userinfo response this service reads. */
export interface GoogleProfile {
  id: string;
  email?: string;
  verified_email?: boolean;
  name?: string;
  picture?: string;
}
