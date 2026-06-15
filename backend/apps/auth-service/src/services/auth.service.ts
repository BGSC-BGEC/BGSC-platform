import { BadRequestException, ConflictException, Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
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

  async register(
    dto: RegisterDto,
    ip: string,
    userAgent: string,
  ): Promise<{ user: any; accessToken: string; refreshToken: string; isNewUser: boolean }> {
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

    const user = this.userRepository.create({
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    });
    await this.userRepository.save(user);

    const { raw: refreshToken, hash: tokenHash, familyId } = this.tokenService.generateRefreshToken(user.id);
    await this.sessionService.createSession(user.id, tokenHash, familyId, ip, userAgent, true);

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

  async validateAndLogUser(
    usernameOrEmail: string,
    pass: string,
    ip: string,
    userAgent: string,
  ): Promise<UserCredential> {
    const normalized = usernameOrEmail.toLowerCase().trim();

    const user = await this.userRepository.findOne({
      where: [
        { username: normalized },
        { email: normalized },
      ],
    });

    if (!user) {
      await this.logLoginAttempt(undefined, ip, userAgent, 'local', false, 'invalid_credentials');
      throw new InvalidCredentialsException();
    }

    if (user.status !== UserStatus.ACTIVE) {
      const reason = user.status === UserStatus.DISABLED ? 'account_disabled' : 'account_pending_deletion';
      await this.logLoginAttempt(user.id, ip, userAgent, 'local', false, reason);
      
      const message = user.status === UserStatus.DISABLED
        ? 'Account is disabled. Contact support.'
        : 'Account is scheduled for deletion. Log in to cancel.';
      throw new AccountDisabledException(message);
    }

    if (!user.passwordHash) {
      await this.logLoginAttempt(user.id, ip, userAgent, 'local', false, 'no_password_set');
      throw new InvalidCredentialsException();
    }

    const isValid = await this.passwordService.verifyPassword(pass, user.passwordHash);
    if (!isValid) {
      await this.logLoginAttempt(user.id, ip, userAgent, 'local', false, 'invalid_credentials');
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
  ): Promise<{ requiresTOTP: boolean; tempToken?: string; user?: any; accessToken?: string; refreshToken?: string; isNewUser?: boolean }> {
    if (user.totpEnabled) {
      const tempToken = this.tokenService.signTempToken(user.id, 'totp_verification');
      return {
        requiresTOTP: true,
        tempToken,
      };
    }

    const { raw: refreshToken, hash: tokenHash, familyId } = this.tokenService.generateRefreshToken(user.id);
    await this.sessionService.createSession(user.id, tokenHash, familyId, ip, userAgent, !!keepMeLoggedIn);

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

  async refreshTokens(
    rawToken: string,
    ip: string,
    userAgent: string,
  ): Promise<{ accessToken: string; refreshToken: string; keepMeLoggedIn: boolean }> {
    const parts = rawToken.split('.');
    if (parts.length !== 3) {
      throw new InvalidCredentialsException();
    }

    const [userId, familyId] = parts;
    const tokenHash = this.tokenService.hashToken(rawToken);

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      await this.sessionService.revokeSession(userId, familyId);
      throw new InvalidCredentialsException();
    }

    const { raw: newRefreshToken, hash: newTokenHash } = this.tokenService.generateRefreshToken(userId, familyId);
    
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

      return {
        accessToken,
        refreshToken: newRefreshToken,
        keepMeLoggedIn,
      };
    } catch (err) {
      if (err instanceof UnauthorizedException && err.message.includes('Session invalidated for security')) {
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

  async logout(userId: string, familyId: string, jti: string, exp: number): Promise<void> {
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
    const response = { message: 'If an account with that email exists, a reset link has been sent.' };

    const user = await this.userRepository.findOne({ where: { email: normalizedEmail } });
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
      this.logger.error(`Password reset request failed for user ${user.id}`, error instanceof Error ? error.stack : undefined);
    }

    return response;
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const tokenHash = this.passwordService.hashResetToken(dto.token);
    const user = await this.findUserForPasswordReset(tokenHash);

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    user.passwordHash = await this.passwordService.hashPassword(dto.newPassword);
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
        throw new BadRequestException('New password must be different from current password');
      }

      const currentPasswordValid = await this.passwordService.verifyPassword(dto.currentPassword, user.passwordHash);
      if (!currentPasswordValid) {
        throw new InvalidCredentialsException();
      }
    }

    user.passwordHash = await this.passwordService.hashPassword(dto.newPassword);
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

  private async findUserForPasswordReset(tokenHash: string): Promise<UserCredential | null> {
    const key = this.getPasswordResetKey(tokenHash);
    const reset = await this.redis.hgetall(key);
    let user: UserCredential | null = null;

    if (reset?.userId) {
      user = await this.userRepository.findOne({ where: { id: reset.userId } });
    } else {
      user = await this.userRepository.findOne({ where: { passwordResetTokenHash: tokenHash } });
    }

    if (!user || user.status !== UserStatus.ACTIVE) {
      return null;
    }

    if (user.passwordResetTokenHash !== tokenHash || !user.passwordResetExpires) {
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
