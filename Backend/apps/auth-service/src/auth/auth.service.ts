import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { ACCOUNT_DELETION_GRACE_DAYS, IUser, ServiceError, TOKEN_ALGORITHMS, User, UserRole, UserStatus, config, publish, recordAudit } from '@bgsc/shared';
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

export class AuthService {
  /**
   * Generates Access Token (15m, signed with accessSecret)
   * and Refresh Token (7d, signed with refreshSecret).
   */
  static generateTokenPair(user: IUser): TokenPair {
    const access_token = jwt.sign(
      { sub: user._id, role: user.role },
      config.jwt.accessSecret,
      { expiresIn: config.jwt.accessExpiresIn } as jwt.SignOptions
    );

    const refresh_token = jwt.sign(
      { sub: user._id },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn } as jwt.SignOptions
    );

    return { access_token, refresh_token };
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
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await User.create({
      email: input.email,
      username: input.username,
      password_hash: passwordHash,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      is_email_verified: false,
      email_verification_token: verificationToken,
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

    const tokens = this.generateTokenPair(user);
    user.refresh_token_hash = await bcrypt.hash(tokens.refresh_token, 10);
    await user.save();

    await MailerService.sendVerificationEmail(user.email, verificationToken);

    publish('UserRegistered', 'auth-service', {
      user_id: user._id,
      email: user.email,
      username: user.username,
    });

    return {
      user: this.formatUser(user),
      tokens,
    };
  }

  /**
   * Logs in a user via email or username.
   */
  static async login(
    input: LoginInput
  ): Promise<AuthResult | { account_status: string; days_remaining: number }> {
    const loginQuery = input.login.toLowerCase();
    const user = await User.findOne({
      $or: [{ email: loginQuery }, { username: loginQuery }],
    }).select('+password_hash +refresh_token_hash');

    if (!user) {
      throw new ServiceError(401, 'unauthorized');
    }

    // Check soft delete status (45-day grace period)
    if (user.status === UserStatus.DELETED) {
      if (user.deleted_at) {
        const diffMs = Date.now() - user.deleted_at.getTime();
        const daysElapsed = diffMs / (1000 * 60 * 60 * 24);
        if (daysElapsed <= ACCOUNT_DELETION_GRACE_DAYS) {
          const daysRemaining = Math.max(0, Math.ceil(ACCOUNT_DELETION_GRACE_DAYS - daysElapsed));
          return {
            account_status: 'scheduled_for_deletion',
            days_remaining: daysRemaining,
          };
        }
      }
      throw new ServiceError(401, 'unauthorized');
    }

    // DELETED is handled above with a countdown, which is why login does not simply delegate.
    this.assertUsable(user);

    if (!user.password_hash) {
      throw new ServiceError(401, 'unauthorized');
    }

    const isMatch = await bcrypt.compare(input.password, user.password_hash);
    if (!isMatch) {
      throw new ServiceError(401, 'unauthorized');
    }

    const tokens = this.generateTokenPair(user);
    user.refresh_token_hash = await bcrypt.hash(tokens.refresh_token, 10);
    user.last_login_at = new Date();
    user.last_active_at = new Date();
    await user.save();

    publish('UserLoggedIn', 'auth-service', {
      user_id: user._id,
    });

    return {
      user: this.formatUser(user),
      tokens,
    };
  }

  /**
   * Refreshes access token with single-use token rotation.
   */
  static async refreshToken(oldRefreshToken: string): Promise<TokenPair> {
    let payload: { sub: string };
    try {
      // Algorithms pinned, exactly as the access-token verifier pins them: an unpinned verifier
      // would accept a token an attacker signed with HS256 using the public key, if this ever
      // moves to RS256. The refresh token is the long-lived one, so it is the worse one to leave open.
      payload = jwt.verify(oldRefreshToken, config.jwt.refreshSecret, {
        algorithms: TOKEN_ALGORITHMS,
      }) as { sub: string };
    } catch {
      throw new ServiceError(401, 'unauthorized');
    }

    const user = await User.findById(payload.sub).select('+refresh_token_hash');
    if (!user || !user.refresh_token_hash) {
      throw new ServiceError(401, 'unauthorized');
    }

    // A refresh token outlives the session that made it, so status is re-checked on every use.
    this.assertUsable(user);

    const isMatch = await bcrypt.compare(oldRefreshToken, user.refresh_token_hash);
    if (!isMatch) {
      // Possible token reuse / breach - invalidate stored session
      user.refresh_token_hash = null;
      await user.save();
      throw new ServiceError(401, 'unauthorized');
    }

    // Issue rotated token pair
    const tokens = this.generateTokenPair(user);
    user.refresh_token_hash = await bcrypt.hash(tokens.refresh_token, 10);
    user.last_active_at = new Date();
    await user.save();

    return tokens;
  }

  /**
   * Terminates active session.
   */
  static async logout(userId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      $set: { refresh_token_hash: null },
    });
  }

  /**
   * Verifies user email via one-time verification token.
   */
  static async verifyEmail(token: string): Promise<AuthResult> {
    const user = await User.findOne({
      email_verification_token: token,
      email_verification_expires: { $gt: new Date() },
    }).select('+email_verification_token +email_verification_expires');

    if (!user) {
      throw new ServiceError(400, 'invalid_or_expired_token');
    }

    this.assertUsable(user);

    user.is_email_verified = true;
    user.email_verification_token = null;
    user.email_verification_expires = null;

    const tokens = this.generateTokenPair(user);
    user.refresh_token_hash = await bcrypt.hash(tokens.refresh_token, 10);
    await user.save();

    publish('UserEmailVerified', 'auth-service', {
      user_id: user._id,
    });

    return {
      user: this.formatUser(user),
      tokens,
    };
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
    user.email_verification_token = token;
    user.email_verification_expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    await MailerService.sendVerificationEmail(user.email, token);
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
    user.password_reset_token = resetToken;
    user.password_reset_expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    await MailerService.sendPasswordResetEmail(user.email, resetToken);
  }

  /**
   * Resets password using valid token.
   */
  static async resetPassword(input: ResetPasswordInput): Promise<void> {
    const user = await User.findOne({
      password_reset_token: input.token,
      password_reset_expires: { $gt: new Date() },
    }).select('+password_reset_token +password_reset_expires');

    if (!user) {
      throw new ServiceError(400, 'invalid_or_expired_token');
    }

    user.password_hash = await bcrypt.hash(input.new_password, 10);
    user.password_reset_token = null;
    user.password_reset_expires = null;
    user.refresh_token_hash = null; // Revoke active sessions
    await user.save();
  }

  /**
   * Reactivates account within the 45-day grace period.
   */
  static async reactivateAccount(login: string, password: string): Promise<AuthResult> {
    const loginQuery = login.toLowerCase();
    const user = await User.findOne({
      $or: [{ email: loginQuery }, { username: loginQuery }],
      status: UserStatus.DELETED,
    }).select('+password_hash');

    if (!user || !user.deleted_at) {
      throw new ServiceError(401, 'unauthorized');
    }

    // The stamped date wins over recomputing from deleted_at: it is what the user was told at
    // deletion time and what User Service reports as `restorable_until`.
    const until =
      user.deletion?.restorable_until ??
      new Date(user.deleted_at.getTime() + ACCOUNT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
    if (new Date() > until) {
      throw new ServiceError(410, 'account_permanently_deleted');
    }

    if (!user.password_hash) {
      throw new ServiceError(401, 'unauthorized');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new ServiceError(401, 'unauthorized');
    }

    const previous = { status: user.status, deleted_at: user.deleted_at };
    const tokens = this.generateTokenPair(user);

    // Claim the restore atomically. Read-then-save would let two simultaneous reactivations both
    // succeed and write two audit rows for one event; whoever flips deleted_at back wins.
    const claimed = await User.findOneAndUpdate(
      { _id: user._id, deleted_at: { $ne: null } },
      {
        $set: {
          status: UserStatus.ACTIVE,
          deleted_at: null,
          // Cleared with the restore — a stale block would leave the account reading as
          // pending-deletion to every serializer that checks it.
          deletion: null,
          refresh_token_hash: await bcrypt.hash(tokens.refresh_token, 10),
        },
      },
      { returnDocument: 'after' }
    );

    if (!claimed) {
      // Someone else restored it between the read and the write.
      throw new ServiceError(409, 'not_deleted');
    }

    // Restoring an account is an auditable lifecycle event, exactly as deleting one is. This
    // moved here with the endpoint: User Service used to write it and no longer can.
    await recordAudit({
      actor_id: claimed._id,
      action: 'user.restored',
      target_type: 'user',
      target_id: claimed._id,
      previous_value: previous,
      new_value: { status: UserStatus.ACTIVE, deleted_at: null },
      reason: 'self-service reactivation within the window',
    });

    publish('UserRestored', 'auth-service', { user_id: claimed._id });

    return {
      user: this.formatUser(claimed),
      tokens,
    };
  }

  /**
   * Generates Google OAuth consent URL.
   */
  static getGoogleAuthUrl(state?: string): string {
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
      state: this.signState(state),
    });

    return `${rootUrl}?${params.toString()}`;
  }

  /**
   * OAuth CSRF protection (RFC 6749 §10.12). `state` was previously passed through unchecked and
   * ignored on the way back, so an attacker could feed a victim a callback URL carrying their own
   * authorization code and silently bind the victim's session to the attacker's Google account.
   *
   * Signed rather than stored: a random nonce inside a short-lived HMAC token is self-verifying,
   * so this needs no session store and no new dependency. The caller's own `state` (a return path,
   * typically) rides along inside it and comes back out on the other side.
   */
  private static signState(caller?: string): string {
    return jwt.sign({ nonce: crypto.randomUUID(), s: caller ?? null }, config.jwt.accessSecret, {
      algorithm: 'HS256',
      expiresIn: '10m',
    });
  }

  static verifyState(state: string | undefined): string | null {
    if (!state) {
      throw new ServiceError(400, 'invalid_oauth_state');
    }
    try {
      const payload = jwt.verify(state, config.jwt.accessSecret, {
        algorithms: TOKEN_ALGORITHMS,
      }) as { nonce?: string; s?: string | null };
      if (!payload.nonce) throw new Error('missing nonce');
      return payload.s ?? null;
    } catch {
      // Expired or forged: both mean this callback did not start here.
      throw new ServiceError(400, 'invalid_oauth_state');
    }
  }

  /**
   * Handles Google OAuth callback and returns tokens.
   */
  static async handleGoogleCallback(code: string): Promise<AuthResult> {
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

    const googleUser = (await userinfoResponse.json()) as {
      id: string;
      email: string;
      name?: string;
      picture?: string;
    };

    const email = googleUser.email.toLowerCase();
    let user = await User.findOne({
      $or: [{ google_id: googleUser.id }, { email }],
    }).select('+google_id');

    if (user) {
      // Without this, Google sign-in was a way around the gates entirely: a soft-deleted account
      // got a fresh token pair and stayed `deleted`, and a suspended one simply logged in.
      this.assertUsable(user);

      if (!user.google_id) {
        user.google_id = googleUser.id;
      }
      user.is_email_verified = true;
      user.last_login_at = new Date();
      user.last_active_at = new Date();
    } else {
      let baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
      if (baseUsername.length < 3) baseUsername = `user_${baseUsername}`;
      let candidate = baseUsername;
      let counter = 1;
      while (await User.findOne({ username: candidate })) {
        candidate = `${baseUsername}_${counter++}`;
      }

      user = await User.create({
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

      publish('UserRegistered', 'auth-service', {
        user_id: user._id,
        email: user.email,
        username: user.username,
      });
    }

    const tokens = this.generateTokenPair(user);
    user.refresh_token_hash = await bcrypt.hash(tokens.refresh_token, 10);
    await user.save();

    publish('UserLoggedIn', 'auth-service', {
      user_id: user._id,
    });

    return {
      user: this.formatUser(user),
      tokens,
    };
  }

  /**
   * Generates and dispatches a 6-digit Phone verification OTP.
   */
  static async sendPhoneOtp(
    userId: string,
    phoneNumber: string
  ): Promise<{ message: string; expires_in: number }> {
    const user = await User.findById(userId);
    if (!user) {
      throw new ServiceError(401, 'unauthorized');
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    user.pending_phone_number = phoneNumber;
    user.phone_verification_otp_hash = otpHash;
    user.phone_verification_expires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    user.phone_verification_attempts = 0;
    await user.save();

    if (config.nodeEnv === 'development' || config.nodeEnv === 'test') {
      console.log('----------------------------------------------------');
      console.log(`📱 [DEV SMS/WhatsApp OTP] To: ${phoneNumber}`);
      console.log(`Your BGSC verification OTP is: ${otp} (valid for 5 mins)`);
      console.log('----------------------------------------------------');
    } else {
      console.log(`[PROD SMS STUB] OTP dispatched to ${phoneNumber}`);
    }

    return {
      message: 'otp_sent',
      expires_in: 300,
    };
  }

  /**
   * Verifies the 6-digit Phone OTP and marks phone verified.
   */
  static async verifyPhoneOtp(
    userId: string,
    phoneNumber: string,
    otp: string
  ): Promise<{ message: string; is_phone_verified: boolean }> {
    const user = await User.findById(userId).select(
      '+phone_verification_otp_hash +phone_verification_expires +phone_verification_attempts +pending_phone_number'
    );

    if (!user || !user.phone_verification_otp_hash || !user.phone_verification_expires) {
      throw new ServiceError(400, 'no_otp_pending');
    }

    if (user.phone_verification_expires < new Date()) {
      user.phone_verification_otp_hash = null;
      user.phone_verification_expires = null;
      await user.save();
      throw new ServiceError(400, 'otp_expired');
    }

    if (user.pending_phone_number !== phoneNumber) {
      throw new ServiceError(400, 'phone_number_mismatch');
    }

    if ((user.phone_verification_attempts || 0) >= 3) {
      user.phone_verification_otp_hash = null;
      user.phone_verification_expires = null;
      await user.save();
      throw new ServiceError(429, 'too_many_attempts');
    }

    const isMatch = await bcrypt.compare(otp, user.phone_verification_otp_hash);
    if (!isMatch) {
      user.phone_verification_attempts = (user.phone_verification_attempts || 0) + 1;
      await user.save();
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

    user.profile.phone_number = phoneNumber;
    user.is_phone_verified = true;
    user.pending_phone_number = null;
    user.phone_verification_otp_hash = null;
    user.phone_verification_expires = null;
    user.phone_verification_attempts = 0;
    try {
      await user.save();
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 11000) {
        throw new ServiceError(409, 'phone_number_taken');
      }
      throw err;
    }

    publish('UserPhoneVerified', 'auth-service', {
      user_id: user._id,
      phone_number: phoneNumber,
    });

    return {
      message: 'phone_verified',
      is_phone_verified: true,
    };
  }
}
