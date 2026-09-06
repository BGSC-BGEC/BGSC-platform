import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User, IUser, UserRole, UserStatus } from '../models/User';
import { config } from '../config/env';
import { publish } from '../events/publish';
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
   * Registers a new user.
   */
  static async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await User.findOne({
      $or: [{ email: input.email }, { username: input.username }],
    });

    if (existing) {
      const error = new Error('conflict');
      (error as any).statusCode = 409;
      throw error;
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
  static async login(input: LoginInput): Promise<AuthResult | { account_status: string; days_remaining: number }> {
    const loginQuery = input.login.toLowerCase();
    const user = await User.findOne({
      $or: [{ email: loginQuery }, { username: loginQuery }],
    }).select('+password_hash +refresh_token_hash');

    if (!user) {
      const error = new Error('unauthorized');
      (error as any).statusCode = 401;
      throw error;
    }

    // Check soft delete status (45-day grace period)
    if (user.status === UserStatus.DELETED) {
      if (user.deleted_at) {
        const diffMs = Date.now() - user.deleted_at.getTime();
        const daysElapsed = diffMs / (1000 * 60 * 60 * 24);
        if (daysElapsed <= 45) {
          const daysRemaining = Math.max(0, Math.ceil(45 - daysElapsed));
          return {
            account_status: 'scheduled_for_deletion',
            days_remaining: daysRemaining,
          };
        }
      }
      const error = new Error('unauthorized');
      (error as any).statusCode = 401;
      throw error;
    }

    if (user.status === UserStatus.SUSPENDED) {
      const error = new Error('forbidden');
      (error as any).statusCode = 403;
      throw error;
    }

    if (!user.password_hash) {
      const error = new Error('unauthorized');
      (error as any).statusCode = 401;
      throw error;
    }

    const isMatch = await bcrypt.compare(input.password, user.password_hash);
    if (!isMatch) {
      const error = new Error('unauthorized');
      (error as any).statusCode = 401;
      throw error;
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
      payload = jwt.verify(oldRefreshToken, config.jwt.refreshSecret) as { sub: string };
    } catch {
      const error = new Error('unauthorized');
      (error as any).statusCode = 401;
      throw error;
    }

    const user = await User.findById(payload.sub).select('+refresh_token_hash');
    if (!user || !user.refresh_token_hash) {
      const error = new Error('unauthorized');
      (error as any).statusCode = 401;
      throw error;
    }

    const isMatch = await bcrypt.compare(oldRefreshToken, user.refresh_token_hash);
    if (!isMatch) {
      // Possible token reuse / breach - invalidate stored session
      user.refresh_token_hash = null;
      await user.save();
      const error = new Error('unauthorized');
      (error as any).statusCode = 401;
      throw error;
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
      const error = new Error('invalid_or_expired_token');
      (error as any).statusCode = 400;
      throw error;
    }

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
      // Return cleanly to prevent email enumeration
      return;
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
      return; // Do not leak email existence
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
      const error = new Error('invalid_or_expired_token');
      (error as any).statusCode = 400;
      throw error;
    }

    user.password_hash = await bcrypt.hash(input.new_password, 10);
    user.password_reset_token = null;
    user.password_reset_expires = null;
    user.refresh_token_hash = null; // Revoke active sessions
    await user.save();
  }

  /**
   * Soft deletes user account (initiates 45-day grace period).
   */
  static async deleteAccount(userId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      $set: {
        status: UserStatus.DELETED,
        deleted_at: new Date(),
        refresh_token_hash: null,
      },
    });
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
      const error = new Error('unauthorized');
      (error as any).statusCode = 401;
      throw error;
    }

    const diffDays = (Date.now() - user.deleted_at.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 45) {
      const error = new Error('account_permanently_deleted');
      (error as any).statusCode = 410;
      throw error;
    }

    if (!user.password_hash) {
      const error = new Error('unauthorized');
      (error as any).statusCode = 401;
      throw error;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      const error = new Error('unauthorized');
      (error as any).statusCode = 401;
      throw error;
    }

    user.status = UserStatus.ACTIVE;
    user.deleted_at = null;
    const tokens = this.generateTokenPair(user);
    user.refresh_token_hash = await bcrypt.hash(tokens.refresh_token, 10);
    await user.save();

    return {
      user: this.formatUser(user),
      tokens,
    };
  }

  /**
   * Generates Google OAuth consent URL.
   */
  static getGoogleAuthUrl(state?: string): string {
    if (!config.google.clientId || !config.google.clientSecret) {
      const error = new Error('google_oauth_not_configured');
      (error as any).statusCode = 503;
      throw error;
    }

    const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    const params = new URLSearchParams({
      client_id: config.google.clientId,
      redirect_uri: config.google.callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
    });

    if (state) {
      params.append('state', state);
    }

    return `${rootUrl}?${params.toString()}`;
  }

  /**
   * Handles Google OAuth callback and returns tokens.
   */
  static async handleGoogleCallback(code: string): Promise<AuthResult> {
    if (!config.google.clientId || !config.google.clientSecret) {
      const error = new Error('google_oauth_not_configured');
      (error as any).statusCode = 503;
      throw error;
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
      const error = new Error('google_token_exchange_failed');
      (error as any).statusCode = 401;
      throw error;
    }

    const tokenData = (await tokenResponse.json()) as { access_token: string };

    // 2. Fetch user profile from Google
    const userinfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userinfoResponse.ok) {
      const error = new Error('google_userinfo_failed');
      (error as any).statusCode = 401;
      throw error;
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
      if (!user.google_id) {
        user.google_id = googleUser.id;
      }
      user.is_email_verified = true;
      user.last_login_at = new Date();
      user.last_active_at = new Date();
    } else {
      // Generate clean unique username from email
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
  static async sendPhoneOtp(userId: string, phoneNumber: string): Promise<{ message: string; expires_in: number }> {
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error('unauthorized');
      (error as any).statusCode = 401;
      throw error;
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    user.pending_phone_number = phoneNumber;
    user.phone_verification_otp_hash = otpHash;
    user.phone_verification_expires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    user.phone_verification_attempts = 0;
    await user.save();

    // Dev mode logger
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
      const error = new Error('no_otp_pending');
      (error as any).statusCode = 400;
      throw error;
    }

    if (user.phone_verification_expires < new Date()) {
      user.phone_verification_otp_hash = null;
      user.phone_verification_expires = null;
      await user.save();
      const error = new Error('otp_expired');
      (error as any).statusCode = 400;
      throw error;
    }

    if (user.pending_phone_number !== phoneNumber) {
      const error = new Error('phone_number_mismatch');
      (error as any).statusCode = 400;
      throw error;
    }

    if ((user.phone_verification_attempts || 0) >= 3) {
      user.phone_verification_otp_hash = null;
      user.phone_verification_expires = null;
      await user.save();
      const error = new Error('too_many_attempts');
      (error as any).statusCode = 429;
      throw error;
    }

    const isMatch = await bcrypt.compare(otp, user.phone_verification_otp_hash);
    if (!isMatch) {
      user.phone_verification_attempts = (user.phone_verification_attempts || 0) + 1;
      await user.save();
      const error = new Error('invalid_otp');
      (error as any).statusCode = 400;
      throw error;
    }

    user.profile.phone_number = phoneNumber;
    user.is_phone_verified = true;
    user.pending_phone_number = null;
    user.phone_verification_otp_hash = null;
    user.phone_verification_expires = null;
    user.phone_verification_attempts = 0;
    await user.save();

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
