import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import Redis from 'ioredis';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { UserCredential } from '../entities/user-credential.entity';
import { LoginAuditLog } from '../entities/login-audit-log.entity';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { SessionService } from './session.service';
import { EventBusService } from './event-bus.service';
import { EmailService } from './email.service';
import { RegisterDto } from '../dto/register.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { UserRole, UserStatus } from '../constants/roles.constant';
import { InvalidCredentialsException } from '../exceptions/invalid-credentials.exception';
import { AccountDisabledException } from '../exceptions/account-disabled.exception';
import { EmailAlreadyLinkedException } from '../exceptions/email-already-linked.exception';
import { TokenReuseDetectedException } from '../exceptions/token-reuse-detected.exception';

export interface GoogleProfilePayload {
  googleId: string;
  email?: string;
  emailVerified: boolean;
  firstName?: string;
  lastName?: string;
  picture?: string;
}

export interface AuthUserResponse {
  id: string;
  username: string;
  email: string;
  role: UserRole;
}

export interface RegisterResult {
  verificationToken: string;
  expiresIn: number;
}

export interface VerifiedRegistrationResult {
  user: AuthUserResponse;
  accessToken: string;
  refreshToken: string;
  isNewUser: boolean;
}

export type LoginResult =
  | {
      requiresTOTP: true;
      tempToken: string;
    }
  | {
      requiresTOTP: false;
      user: AuthUserResponse;
      accessToken: string;
      refreshToken: string;
      isNewUser: boolean;
    };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(UserCredential)
    private readonly userRepository: Repository<UserCredential>,
    @InjectRepository(LoginAuditLog)
    private readonly auditLogRepository: Repository<LoginAuditLog>,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    private readonly eventBusService: EventBusService,
    private readonly emailService: EmailService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResult> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const normalizedUsername = dto.username.toLowerCase().trim();

    const existingUsername = await this.userRepository.findOne({
      where: { username: normalizedUsername },
    });
    if (existingUsername) {
      throw new ConflictException('Username already exists');
    }

    const existingEmail = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (existingEmail) {
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await this.passwordService.hashPassword(dto.password);

    const verificationToken = randomBytes(32).toString('hex');
    const code = randomInt(100000, 1000000).toString();
    const key = this.registrationKey(verificationToken);
    await this.redis.hset(key, {
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
      codeHash: this.registrationCodeHash(verificationToken, code),
      attempts: '0',
    });
    await this.redis.expire(key, 10 * 60);
    try {
      await this.emailService.sendRegistrationCode(normalizedEmail, code);
    } catch (error) {
      await this.redis.del(key);
      this.logger.error(
        'Registration verification email failed',
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException(
        'Unable to send verification email',
      );
    }
    return { verificationToken, expiresIn: 10 * 60 };
  }

  async verifyRegistration(
    verificationToken: string,
    code: string,
    ip: string,
    userAgent: string,
  ): Promise<VerifiedRegistrationResult> {
    const key = this.registrationKey(verificationToken);
    const pending = await this.redis.hgetall(key);
    if (
      !pending?.email ||
      !pending.username ||
      !pending.passwordHash ||
      !pending.codeHash
    ) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }
    const attempts = Number(pending.attempts || 0);
    if (attempts >= 5) {
      await this.redis.del(key);
      throw new UnauthorizedException('Too many invalid verification attempts');
    }
    const expected = Buffer.from(pending.codeHash, 'hex');
    const actual = Buffer.from(
      this.registrationCodeHash(verificationToken, code),
      'hex',
    );
    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      const nextAttempts = await this.redis.hincrby(key, 'attempts', 1);
      if (nextAttempts >= 5) await this.redis.del(key);
      throw new UnauthorizedException('Invalid verification code');
    }

    const existing = await this.userRepository.findOne({
      where: [{ username: pending.username }, { email: pending.email }],
    });
    if (existing) {
      await this.redis.del(key);
      throw new ConflictException('Username or email already exists');
    }
    let user: UserCredential;
    try {
      user = await this.userRepository.save(
        this.userRepository.create({
          username: pending.username,
          email: pending.email,
          passwordHash: pending.passwordHash,
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
        }),
      );
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      ) {
        await this.redis.del(key);
        throw new ConflictException('Username or email already exists');
      }
      throw error;
    }
    await this.redis.del(key);
    const {
      raw: refreshToken,
      hash: tokenHash,
      familyId,
    } = this.tokenService.generateRefreshToken(user.id);
    await this.sessionService.createSession(
      user.id,
      tokenHash,
      familyId,
      ip,
      userAgent,
      true,
    );
    const accessToken = this.tokenService.signAccessToken(user);
    this.eventBusService.emit('UserRegistered', {
      userId: user.id,
      email: user.email,
      username: user.username,
      timestamp: new Date().toISOString(),
    });
    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      accessToken,
      refreshToken,
      isNewUser: true,
    };
  }

  async resendRegistrationCode(verificationToken: string): Promise<void> {
    const key = this.registrationKey(verificationToken);
    const pending = await this.redis.hgetall(key);
    if (!pending?.email)
      throw new UnauthorizedException('Invalid or expired verification code');
    const code = randomInt(100000, 1000000).toString();
    await this.redis.hset(key, {
      codeHash: this.registrationCodeHash(verificationToken, code),
      attempts: '0',
    });
    await this.redis.expire(key, 10 * 60);
    await this.emailService.sendRegistrationCode(pending.email, code);
  }

  async validateAndLogUser(
    usernameOrEmail: string,
    pass: string,
    ip: string,
    userAgent: string,
  ): Promise<UserCredential> {
    const normalized = usernameOrEmail.toLowerCase().trim();

    const user = await this.userRepository.findOne({
      where: [{ username: normalized }, { email: normalized }],
    });

    if (!user) {
      await this.logLoginAttempt(
        undefined,
        ip,
        userAgent,
        'local',
        false,
        'invalid_credentials',
      );
      throw new InvalidCredentialsException();
    }

    if (
      user.status === UserStatus.DISABLED ||
      user.status === UserStatus.DELETED
    ) {
      await this.logLoginAttempt(
        user.id,
        ip,
        userAgent,
        'local',
        false,
        user.status === UserStatus.DISABLED
          ? 'account_disabled'
          : 'account_deleted',
      );
      throw new AccountDisabledException(
        'Account is unavailable. Contact support.',
      );
    }

    if (!user.passwordHash) {
      await this.logLoginAttempt(
        user.id,
        ip,
        userAgent,
        'local',
        false,
        'no_password_set',
      );
      throw new InvalidCredentialsException();
    }

    const isValid = await this.passwordService.verifyPassword(
      pass,
      user.passwordHash,
    );
    if (!isValid) {
      await this.logLoginAttempt(
        user.id,
        ip,
        userAgent,
        'local',
        false,
        'invalid_credentials',
      );
      throw new InvalidCredentialsException();
    }

    await this.logLoginAttempt(user.id, ip, userAgent, 'local', true);
    return user;
  }

  async login(
    user: UserCredential,
    ip: string,
    userAgent: string,
    keepMeLoggedIn?: boolean,
  ): Promise<LoginResult> {
    if (user.totpEnabled) {
      const tempToken = this.tokenService.signTempToken(
        user.id,
        'totp_verification',
      );
      return { requiresTOTP: true, tempToken };
    }

    const {
      raw: refreshToken,
      hash: tokenHash,
      familyId,
    } = this.tokenService.generateRefreshToken(user.id);
    await this.sessionService.createSession(
      user.id,
      tokenHash,
      familyId,
      ip,
      userAgent,
      !!keepMeLoggedIn,
    );
    const accessToken = this.tokenService.signAccessToken(user);
    this.eventBusService.emit('UserLoggedIn', {
      userId: user.id,
      device: userAgent,
      ip,
      method: 'local',
      timestamp: new Date().toISOString(),
    });
    return {
      requiresTOTP: false,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      accessToken,
      refreshToken,
      isNewUser: false,
    };
  }

  async findOrCreateGoogleUser(
    profile: GoogleProfilePayload,
  ): Promise<{ user: UserCredential; isNewUser: boolean }> {
    const existingByGoogleId = await this.userRepository.findOne({
      where: { googleId: profile.googleId },
    });

    if (existingByGoogleId) {
      return { user: existingByGoogleId, isNewUser: false };
    }

    const normalizedEmail = profile.email?.toLowerCase().trim();
    if (normalizedEmail) {
      const existingByEmail = await this.userRepository.findOne({
        where: { email: normalizedEmail },
      });

      if (existingByEmail) {
        throw new EmailAlreadyLinkedException();
      }
    }

    if (!normalizedEmail) {
      throw new ConflictException(
        'Google account must provide a verified email to register',
      );
    }

    const generatedUsername =
      await this.generateUniqueUsername(normalizedEmail);

    const created = this.userRepository.create({
      username: generatedUsername,
      email: normalizedEmail,
      passwordHash: null,
      googleId: profile.googleId,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    });
    const user = await this.userRepository.save(created);

    this.eventBusService.emit('UserRegistered', {
      userId: user.id,
      email: user.email,
      username: user.username,
      method: 'google',
      timestamp: new Date().toISOString(),
    });

    return { user, isNewUser: true };
  }

  async loginWithGoogle(
    user: UserCredential,
    isNewUser: boolean,
    ip: string,
    userAgent: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    isNewUser: boolean;
  }> {
    if (
      user.status === UserStatus.DISABLED ||
      user.status === UserStatus.DELETED
    ) {
      await this.logLoginAttempt(
        user.id,
        ip,
        userAgent,
        'google',
        false,
        user.status === UserStatus.DISABLED
          ? 'account_disabled'
          : 'account_deleted',
      );
      throw new AccountDisabledException(
        'Account is unavailable. Contact support.',
      );
    }

    const {
      raw: refreshToken,
      hash: tokenHash,
      familyId,
    } = this.tokenService.generateRefreshToken(user.id);
    await this.sessionService.createSession(
      user.id,
      tokenHash,
      familyId,
      ip,
      userAgent,
      true,
    );

    const accessToken = this.tokenService.signAccessToken(user);

    await this.logLoginAttempt(user.id, ip, userAgent, 'google', true);

    this.eventBusService.emit('UserLoggedIn', {
      userId: user.id,
      device: userAgent,
      ip,
      method: 'google',
      isNewDevice: true,
      timestamp: new Date().toISOString(),
    });

    return {
      accessToken,
      refreshToken,
      isNewUser,
    };
  }

  private async generateUniqueUsername(email: string): Promise<string> {
    const basePrefix =
      email
        .split('@')[0]
        .replace(/[^a-zA-Z0-9_]/g, '')
        .toLowerCase() || 'user';

    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate =
        attempt === 0
          ? basePrefix.slice(0, 46)
          : `${basePrefix.slice(0, 42)}.${randomBytes(2).toString('hex')}`;

      const collision = await this.userRepository.findOne({
        where: { username: candidate },
      });
      if (!collision) {
        return candidate;
      }
    }

    return `${basePrefix.slice(0, 40)}.${randomBytes(4).toString('hex')}`;
  }

  async refreshTokens(
    rawToken: string,
    ip: string,
    userAgent: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    keepMeLoggedIn: boolean;
  }> {
    const parts = rawToken.split('.');
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const randomHexRegex = /^[0-9a-f]{64}$/i;

    if (
      parts.length !== 3 ||
      !uuidRegex.test(parts[0]) ||
      !uuidRegex.test(parts[1]) ||
      !randomHexRegex.test(parts[2])
    ) {
      await this.logLoginAttempt(
        undefined,
        ip,
        userAgent,
        'refresh',
        false,
        'malformed_token',
      );
      throw new InvalidCredentialsException();
    }

    const [userId, familyId] = parts;
    const tokenHash = this.tokenService.hashToken(rawToken);

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      await this.sessionService.revokeSession(userId, familyId);
      await this.logLoginAttempt(
        user?.id,
        ip,
        userAgent,
        'refresh',
        false,
        user ? 'account_inactive' : 'invalid_token',
      );
      throw new InvalidCredentialsException();
    }

    const { raw: newRefreshToken, hash: newTokenHash } =
      this.tokenService.generateRefreshToken(userId, familyId);

    try {
      const keepMeLoggedIn = await this.sessionService.validateAndRotateSession(
        userId,
        familyId,
        tokenHash,
        newTokenHash,
        ip,
        userAgent,
      );

      const accessToken = this.tokenService.signAccessToken(user);
      await this.logLoginAttempt(user.id, ip, userAgent, 'refresh', true);

      return {
        accessToken,
        refreshToken: newRefreshToken,
        keepMeLoggedIn,
      };
    } catch (err) {
      await this.logLoginAttempt(
        user.id,
        ip,
        userAgent,
        'refresh',
        false,
        err instanceof TokenReuseDetectedException
          ? 'token_reuse'
          : 'invalid_token',
      );
      if (err instanceof TokenReuseDetectedException) {
        // Log token reuse / breach
        this.eventBusService.emit('UserSessionBreach', {
          userId,
          ip,
          userAgent,
          timestamp: new Date().toISOString(),
        });
      }
      throw err;
    }
  }

  async logout(
    userId: string,
    familyId: string,
    jti: string,
    exp: number,
  ): Promise<void> {
    await this.sessionService.revokeSession(userId, familyId);

    const remainingTtl = Math.max(1, exp - Math.floor(Date.now() / 1000));
    await this.sessionService.blacklistJti(jti, remainingTtl);
  }

  async logoutAll(userId: string, jti: string, exp: number): Promise<void> {
    await this.sessionService.revokeAllSessions(userId);

    const remainingTtl = Math.max(1, exp - Math.floor(Date.now() / 1000));
    await this.sessionService.blacklistJti(jti, remainingTtl);

    this.eventBusService.emit('UserAllSessionsRevoked', {
      userId,
      reason: 'User requested logout from all devices',
      timestamp: new Date().toISOString(),
    });
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const response = {
      message:
        'If an account with that email exists, a reset link has been sent.',
    };

    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (!user || user.status !== UserStatus.ACTIVE) {
      return response;
    }

    try {
      const { raw, hash } = this.passwordService.generateResetToken();
      const expires = new Date(Date.now() + 60 * 60 * 1000);

      user.passwordResetTokenHash = hash;
      user.passwordResetExpires = expires;
      await this.userRepository.save(user);

      const key = this.getPasswordResetKey(hash);
      await this.redis.hset(key, {
        userId: user.id,
        createdAt: Date.now().toString(),
      });
      await this.redis.expire(key, 60 * 60);

      await this.emailService.sendPasswordResetEmail(user.email, raw);
    } catch (error) {
      this.logger.error(
        `Password reset request failed for user ${user.id}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    return response;
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const tokenHash = this.passwordService.hashResetToken(dto.token);
    const user = await this.findUserForPasswordReset(tokenHash);

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    user.passwordHash = await this.passwordService.hashPassword(
      dto.newPassword,
    );
    user.passwordResetTokenHash = null;
    user.passwordResetExpires = null;
    await this.userRepository.save(user);

    await this.redis.del(this.getPasswordResetKey(tokenHash));
    await this.sessionService.revokeAllSessions(user.id);

    this.eventBusService.emit('UserPasswordChanged', {
      userId: user.id,
      timestamp: new Date().toISOString(),
    });

    return { message: 'Password has been reset successfully.' };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    currentFamilyId?: string,
  ): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new InvalidCredentialsException();
    }

    if (user.passwordHash) {
      if (!dto.currentPassword) {
        throw new BadRequestException('Current password is required');
      }
      if (dto.currentPassword === dto.newPassword) {
        throw new BadRequestException(
          'New password must be different from current password',
        );
      }

      const currentPasswordValid = await this.passwordService.verifyPassword(
        dto.currentPassword,
        user.passwordHash,
      );
      if (!currentPasswordValid) {
        throw new InvalidCredentialsException();
      }
    }

    user.passwordHash = await this.passwordService.hashPassword(
      dto.newPassword,
    );
    user.passwordResetTokenHash = null;
    user.passwordResetExpires = null;
    await this.userRepository.save(user);

    await this.sessionService.revokeAllSessionsExcept(user.id, currentFamilyId);

    this.eventBusService.emit('UserPasswordChanged', {
      userId: user.id,
      timestamp: new Date().toISOString(),
    });

    return { message: 'Password changed successfully.' };
  }

  private async findUserForPasswordReset(
    tokenHash: string,
  ): Promise<UserCredential | null> {
    const key = this.getPasswordResetKey(tokenHash);
    const reset = await this.redis.hgetall(key);
    let user: UserCredential | null = null;

    if (reset?.userId) {
      user = await this.userRepository.findOne({ where: { id: reset.userId } });
    } else {
      user = await this.userRepository.findOne({
        where: { passwordResetTokenHash: tokenHash },
      });
    }

    if (!user || user.status !== UserStatus.ACTIVE) {
      return null;
    }

    if (
      user.passwordResetTokenHash !== tokenHash ||
      !user.passwordResetExpires
    ) {
      return null;
    }

    if (user.passwordResetExpires.getTime() <= Date.now()) {
      return null;
    }

    return user;
  }

  private getPasswordResetKey(tokenHash: string): string {
    return `auth:password_reset:${tokenHash}`;
  }

  private registrationKey(verificationToken: string): string {
    return `auth:registration:${verificationToken}`;
  }

  private registrationCodeHash(
    verificationToken: string,
    code: string,
  ): string {
    return createHash('sha256')
      .update(`${verificationToken}:${code}`)
      .digest('hex');
  }

  private async logLoginAttempt(
    userId: string | undefined,
    ip: string,
    userAgent: string,
    method: string,
    success: boolean,
    failureReason?: string,
  ): Promise<void> {
    const log = this.auditLogRepository.create({
      userId,
      ipAddress: ip,
      userAgent,
      method,
      success,
      failureReason,
    });
    await this.auditLogRepository.save(log);
  }
}
