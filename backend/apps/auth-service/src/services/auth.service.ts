import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserCredential } from '../entities/user-credential.entity';
import { LoginAuditLog } from '../entities/login-audit-log.entity';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { SessionService } from './session.service';
import { EventBusService } from './event-bus.service';
import { RegisterDto } from '../dto/register.dto';
import { UserRole, UserStatus } from '../constants/roles.constant';
import { InvalidCredentialsException } from '../exceptions/invalid-credentials.exception';
import { AccountDisabledException } from '../exceptions/account-disabled.exception';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserCredential)
    private readonly userRepository: Repository<UserCredential>,
    @InjectRepository(LoginAuditLog)
    private readonly auditLogRepository: Repository<LoginAuditLog>,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    private readonly eventBusService: EventBusService,
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
