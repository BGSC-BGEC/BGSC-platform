import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { AuthService } from '../src/services/auth.service';
import { UserCredential } from '../src/entities/user-credential.entity';
import { LoginAuditLog } from '../src/entities/login-audit-log.entity';
import { PasswordService } from '../src/services/password.service';
import { TokenService } from '../src/services/token.service';
import { SessionService } from '../src/services/session.service';
import { EventBusService } from '../src/services/event-bus.service';
import { EmailService } from '../src/services/email.service';
import { UserRole, UserStatus } from '../src/constants/roles.constant';
import { InvalidCredentialsException } from '../src/exceptions/invalid-credentials.exception';
import { AccountDisabledException } from '../src/exceptions/account-disabled.exception';
import { TokenReuseDetectedException } from '../src/exceptions/token-reuse-detected.exception';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: any;
  let auditLogRepository: any;
  let passwordService: any;
  let tokenService: any;
  let sessionService: any;
  let eventBusService: any;
  let emailService: any;
  let redis: any;

  beforeEach(async () => {
    userRepository = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation((user) => Promise.resolve({ id: 'mock-uuid', ...user })),
    };

    auditLogRepository = {
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation((log) => Promise.resolve({ id: 'log-uuid', ...log })),
    };

    passwordService = {
      hashPassword: jest.fn().mockResolvedValue('hashed_pass'),
      verifyPassword: jest.fn(),
      generateResetToken: jest.fn().mockReturnValue({ raw: 'a'.repeat(64), hash: 'reset-hash' }),
      hashResetToken: jest.fn().mockReturnValue('reset-hash'),
    };

    tokenService = {
      generateRefreshToken: jest.fn().mockReturnValue({
        raw: 'mock-uuid.family-uuid.random-hex',
        hash: 'sha256-hash',
        familyId: 'family-uuid',
      }),
      signAccessToken: jest.fn().mockReturnValue('access_jwt_token'),
      signTempToken: jest.fn().mockReturnValue('temp_jwt_token'),
      hashToken: jest.fn().mockReturnValue('sha256-hash'),
    };

    sessionService = {
      createSession: jest.fn().mockResolvedValue(undefined),
      validateAndRotateSession: jest.fn().mockResolvedValue(true),
      revokeSession: jest.fn().mockResolvedValue(undefined),
      revokeAllSessions: jest.fn().mockResolvedValue(undefined),
      revokeAllSessionsExcept: jest.fn().mockResolvedValue(undefined),
      blacklistJti: jest.fn().mockResolvedValue(undefined),
    };

    eventBusService = {
      emit: jest.fn(),
    };

    emailService = {
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    };

    redis = {
      hset: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      hgetall: jest.fn().mockResolvedValue({}),
      del: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(UserCredential),
          useValue: userRepository,
        },
        {
          provide: getRepositoryToken(LoginAuditLog),
          useValue: auditLogRepository,
        },
        {
          provide: PasswordService,
          useValue: passwordService,
        },
        {
          provide: TokenService,
          useValue: tokenService,
        },
        {
          provide: SessionService,
          useValue: sessionService,
        },
        {
          provide: EventBusService,
          useValue: eventBusService,
        },
        {
          provide: EmailService,
          useValue: emailService,
        },
        {
          provide: 'REDIS_CLIENT',
          useValue: redis,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      userRepository.findOne.mockResolvedValue(null); // No existing username or email

      const result = await service.register(
        {
          username: 'NewUser',
          email: 'new@example.com',
          password: 'Password1!',
          acceptedTos: true,
        },
        '127.0.0.1',
        'test-ua',
      );

      expect(result).toBeDefined();
      expect(result.user.username).toBe('newuser');
      expect(result.accessToken).toBe('access_jwt_token');
      expect(result.refreshToken).toBe('mock-uuid.family-uuid.random-hex');
      expect(eventBusService.emit).toHaveBeenCalledWith('UserRegistered', expect.any(Object));
    });

    it('should throw ConflictException if username exists', async () => {
      userRepository.findOne.mockResolvedValueOnce({ id: 'existing' }); // Mock existing username

      await expect(
        service.register(
          {
            username: 'NewUser',
            email: 'new@example.com',
            password: 'Password1!',
            acceptedTos: true,
          },
          '127.0.0.1',
          'test-ua',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('validateAndLogUser', () => {
    it('should validate active user with correct password', async () => {
      const mockUser = {
        id: 'u-1',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hashed',
        status: UserStatus.ACTIVE,
      };
      userRepository.findOne.mockResolvedValue(mockUser);
      passwordService.verifyPassword.mockResolvedValue(true);

      const user = await service.validateAndLogUser('testuser', 'pass', '127.0.0.1', 'ua');
      expect(user).toBeDefined();
      expect(user.id).toBe(mockUser.id);
      expect(auditLogRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, failureReason: undefined }),
      );
    });

    it('should throw InvalidCredentialsException for incorrect password', async () => {
      const mockUser = {
        id: 'u-1',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hashed',
        status: UserStatus.ACTIVE,
      };
      userRepository.findOne.mockResolvedValue(mockUser);
      passwordService.verifyPassword.mockResolvedValue(false);

      await expect(
        service.validateAndLogUser('testuser', 'wrongpass', '127.0.0.1', 'ua'),
      ).rejects.toThrow(InvalidCredentialsException);

      expect(auditLogRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, failureReason: 'invalid_credentials' }),
      );
    });

    it('should throw AccountDisabledException if user status is disabled', async () => {
      const mockUser = {
        id: 'u-1',
        username: 'disableduser',
        email: 'disabled@example.com',
        passwordHash: 'hashed',
        status: UserStatus.DISABLED,
      };
      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.validateAndLogUser('disableduser', 'pass', '127.0.0.1', 'ua'),
      ).rejects.toThrow(AccountDisabledException);

      expect(auditLogRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, failureReason: 'account_disabled' }),
      );
    });
  });

  describe('login', () => {
    it('should return temp token if TOTP is enabled', async () => {
      const mockUser = new UserCredential();
      mockUser.id = 'u-1';
      mockUser.totpEnabled = true;

      const result = await service.login(mockUser, '127.0.0.1', 'ua');
      expect(result.requiresTOTP).toBe(true);
      expect(result.tempToken).toBe('temp_jwt_token');
    });

    it('should issue tokens if TOTP is disabled', async () => {
      const mockUser = new UserCredential();
      mockUser.id = 'u-1';
      mockUser.username = 'testuser';
      mockUser.totpEnabled = false;

      const result = await service.login(mockUser, '127.0.0.1', 'ua');
      expect(result.requiresTOTP).toBe(false);
      expect(result.accessToken).toBe('access_jwt_token');
      expect(result.refreshToken).toBe('mock-uuid.family-uuid.random-hex');
      expect(eventBusService.emit).toHaveBeenCalledWith('UserLoggedIn', expect.any(Object));
    });
  });

  describe('refreshTokens', () => {
    it('should successfully rotate tokens', async () => {
      const mockUser = { id: 'u-1', status: UserStatus.ACTIVE };
      userRepository.findOne.mockResolvedValue(mockUser);
      sessionService.validateAndRotateSession.mockResolvedValue(true);

      const result = await service.refreshTokens('u-1.fam-1.random', '127.0.0.1', 'ua');
      expect(result.accessToken).toBe('access_jwt_token');
      expect(result.refreshToken).toBe('mock-uuid.family-uuid.random-hex');
    });

    it('should log a breach when token reuse is detected', async () => {
      const mockUser = { id: 'u-1', status: UserStatus.ACTIVE };
      userRepository.findOne.mockResolvedValue(mockUser);
      
      const staleException = new TokenReuseDetectedException();
      sessionService.validateAndRotateSession.mockRejectedValue(staleException);

      await expect(
        service.refreshTokens('u-1.fam-1.random', '127.0.0.1', 'ua'),
      ).rejects.toThrow(TokenReuseDetectedException);

      expect(eventBusService.emit).toHaveBeenCalledWith('UserSessionBreach', expect.any(Object));
    });
  });

  describe('forgotPassword', () => {
    it('should always return generic response and not send email when user is missing', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.forgotPassword({ email: 'missing@example.com' });

      expect(result.message).toContain('If an account with that email exists');
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(redis.hset).not.toHaveBeenCalled();
    });

    it('should store reset hash in Redis and DB then send reset email for active user', async () => {
      const user = {
        id: 'u-1',
        email: 'user@example.com',
        status: UserStatus.ACTIVE,
      };
      userRepository.findOne.mockResolvedValue(user);

      const result = await service.forgotPassword({ email: ' USER@EXAMPLE.COM ' });

      expect(result.message).toContain('If an account with that email exists');
      expect(user.passwordResetTokenHash).toBe('reset-hash');
      expect(user.passwordResetExpires).toBeInstanceOf(Date);
      expect(userRepository.save).toHaveBeenCalledWith(user);
      expect(redis.hset).toHaveBeenCalledWith('auth:password_reset:reset-hash', expect.objectContaining({ userId: 'u-1' }));
      expect(redis.expire).toHaveBeenCalledWith('auth:password_reset:reset-hash', 60 * 60);
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith('user@example.com', 'a'.repeat(64));
    });

    it('should still return generic response if reset email sending fails', async () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const user = {
        id: 'u-1',
        email: 'user@example.com',
        status: UserStatus.ACTIVE,
      };
      userRepository.findOne.mockResolvedValue(user);
      emailService.sendPasswordResetEmail.mockRejectedValue(new Error('smtp unavailable'));

      const result = await service.forgotPassword({ email: 'user@example.com' });

      expect(result.message).toContain('If an account with that email exists');
      loggerSpy.mockRestore();
    });
  });

  describe('resetPassword', () => {
    it('should reset password, clear token, revoke sessions, and emit event', async () => {
      const user = {
        id: 'u-1',
        status: UserStatus.ACTIVE,
        passwordResetTokenHash: 'reset-hash',
        passwordResetExpires: new Date(Date.now() + 60_000),
      };
      redis.hgetall.mockResolvedValue({ userId: 'u-1' });
      userRepository.findOne.mockResolvedValue(user);

      const result = await service.resetPassword({ token: 'a'.repeat(64), newPassword: 'NewPassword1!' });

      expect(result.message).toBe('Password has been reset successfully.');
      expect(user.passwordHash).toBe('hashed_pass');
      expect(user.passwordResetTokenHash).toBeNull();
      expect(user.passwordResetExpires).toBeNull();
      expect(redis.del).toHaveBeenCalledWith('auth:password_reset:reset-hash');
      expect(sessionService.revokeAllSessions).toHaveBeenCalledWith('u-1');
      expect(eventBusService.emit).toHaveBeenCalledWith('UserPasswordChanged', expect.objectContaining({ userId: 'u-1' }));
    });

    it('should reject expired or invalid reset token', async () => {
      const user = {
        id: 'u-1',
        status: UserStatus.ACTIVE,
        passwordResetTokenHash: 'reset-hash',
        passwordResetExpires: new Date(Date.now() - 60_000),
      };
      redis.hgetall.mockResolvedValue({ userId: 'u-1' });
      userRepository.findOne.mockResolvedValue(user);

      await expect(
        service.resetPassword({ token: 'a'.repeat(64), newPassword: 'NewPassword1!' }),
      ).rejects.toThrow(BadRequestException);

      expect(sessionService.revokeAllSessions).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('should require current password when the user has a password', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'u-1',
        status: UserStatus.ACTIVE,
        passwordHash: 'old_hash',
      });

      await expect(
        service.changePassword('u-1', { newPassword: 'NewPassword1!' }, 'fam-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should change password and revoke other sessions for password users', async () => {
      const user = {
        id: 'u-1',
        status: UserStatus.ACTIVE,
        passwordHash: 'old_hash',
      };
      userRepository.findOne.mockResolvedValue(user);
      passwordService.verifyPassword.mockResolvedValue(true);

      const result = await service.changePassword(
        'u-1',
        { currentPassword: 'OldPassword1!', newPassword: 'NewPassword1!' },
        'fam-1',
      );

      expect(result.message).toBe('Password changed successfully.');
      expect(passwordService.verifyPassword).toHaveBeenCalledWith('OldPassword1!', 'old_hash');
      expect(user.passwordHash).toBe('hashed_pass');
      expect(sessionService.revokeAllSessionsExcept).toHaveBeenCalledWith('u-1', 'fam-1');
      expect(eventBusService.emit).toHaveBeenCalledWith('UserPasswordChanged', expect.objectContaining({ userId: 'u-1' }));
    });

    it('should set password for OAuth-only users without current password', async () => {
      const user = {
        id: 'u-1',
        status: UserStatus.ACTIVE,
        passwordHash: null,
      };
      userRepository.findOne.mockResolvedValue(user);

      await service.changePassword('u-1', { newPassword: 'NewPassword1!' }, 'fam-1');

      expect(passwordService.verifyPassword).not.toHaveBeenCalled();
      expect(user.passwordHash).toBe('hashed_pass');
      expect(sessionService.revokeAllSessionsExcept).toHaveBeenCalledWith('u-1', 'fam-1');
    });
  });
});
