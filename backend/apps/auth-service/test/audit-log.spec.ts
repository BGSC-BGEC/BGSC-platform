import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../src/services/auth.service';
import { UserCredential } from '../src/entities/user-credential.entity';
import { LoginAuditLog } from '../src/entities/login-audit-log.entity';
import { PasswordService } from '../src/services/password.service';
import { TokenService } from '../src/services/token.service';
import { SessionService } from '../src/services/session.service';
import { EventBusService } from '../src/services/event-bus.service';
import { EmailService } from '../src/services/email.service';
import { TotpController } from '../src/controllers/totp.controller';
import { TotpService } from '../src/services/totp.service';
import { UserRole, UserStatus } from '../src/constants/roles.constant';
import { InvalidCredentialsException } from '../src/exceptions/invalid-credentials.exception';

describe('Login Audit Logging', () => {
  let authService: AuthService;
  let totpController: TotpController;
  let userRepository: any;
  let auditLogRepository: any;
  let passwordService: any;
  let tokenService: any;
  let sessionService: any;
  let eventBusService: any;
  let emailService: any;
  let totpService: any;
  let redis: any;

  beforeEach(async () => {
    userRepository = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: 'mock-uuid', ...entity })),
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
      verifyTempToken: jest.fn().mockReturnValue('u-1'),
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

    totpService = {
      decryptSecret: jest.fn().mockReturnValue('totp-secret'),
      verifyCode: jest.fn(),
      generateSecret: jest.fn().mockReturnValue('new-secret'),
      generateQRCode: jest.fn().mockResolvedValue('qr-code-url'),
      encryptSecret: jest.fn().mockReturnValue('encrypted-secret'),
      generateBackupCodes: jest.fn().mockResolvedValue({
        plainTextCodes: ['code1', 'code2'],
        hashedCodes: ['hash1', 'hash2'],
      }),
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
        TotpController,
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
          provide: TotpService,
          useValue: totpService,
        },
        {
          provide: 'REDIS_CLIENT',
          useValue: redis,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    totpController = module.get<TotpController>(TotpController);
  });

  describe('AuthService audit logging', () => {
    it('should log success=true with method="local" on successful login', async () => {
      const mockUser = {
        id: 'u-1',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hashed',
        status: UserStatus.ACTIVE,
      };
      userRepository.findOne.mockResolvedValue(mockUser);
      passwordService.verifyPassword.mockResolvedValue(true);

      await authService.validateAndLogUser('testuser', 'correct-pass', '192.168.1.1', 'Mozilla/5.0');

      expect(auditLogRepository.create).toHaveBeenCalledWith({
        userId: 'u-1',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        method: 'local',
        success: true,
        failureReason: undefined,
      });
      expect(auditLogRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, method: 'local' }),
      );
    });

    it('should log success=false with failure reason on failed login', async () => {
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
        authService.validateAndLogUser('testuser', 'wrong-pass', '10.0.0.1', 'curl/7.68'),
      ).rejects.toThrow(InvalidCredentialsException);

      expect(auditLogRepository.create).toHaveBeenCalledWith({
        userId: 'u-1',
        ipAddress: '10.0.0.1',
        userAgent: 'curl/7.68',
        method: 'local',
        success: false,
        failureReason: 'invalid_credentials',
      });
      expect(auditLogRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, failureReason: 'invalid_credentials' }),
      );
    });

    it('should log success=false when user is not found (userId undefined)', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        authService.validateAndLogUser('ghost', 'pass', '127.0.0.1', 'ua'),
      ).rejects.toThrow(InvalidCredentialsException);

      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: undefined,
          method: 'local',
          success: false,
          failureReason: 'invalid_credentials',
        }),
      );
    });

    it('should log method="google" with success=true on Google login', async () => {
      const user = new UserCredential();
      user.id = 'u-1';
      user.username = 'googler';
      user.status = UserStatus.ACTIVE;

      await authService.loginWithGoogle(user, false, '172.16.0.1', 'GoogleBot');

      expect(auditLogRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'google',
          success: true,
          ipAddress: '172.16.0.1',
          userAgent: 'GoogleBot',
        }),
      );
    });

    it('should log success=true with method="refresh" on successful token refresh', async () => {
      const userId = '11111111-2222-3333-4444-555555555555';
      const familyId = '66666666-7777-8888-9999-000000000000';
      const randomHex = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
      const rawToken = `${userId}.${familyId}.${randomHex}`;

      const mockUser = {
        id: userId,
        username: 'refreshuser',
        email: 'refresh@example.com',
        status: UserStatus.ACTIVE,
      };
      userRepository.findOne.mockResolvedValue(mockUser);
      sessionService.validateAndRotateSession.mockResolvedValue(true);

      await authService.refreshTokens(rawToken, '192.168.1.1', 'Mozilla/5.0');

      expect(auditLogRepository.create).toHaveBeenCalledWith({
        userId,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        method: 'refresh',
        success: true,
        failureReason: undefined,
      });
      expect(auditLogRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, method: 'refresh' }),
      );
    });

    it('should log success=false with method="refresh" on failed token refresh due to malformed token', async () => {
      const rawToken = 'invalid-token-format';
      await expect(
        authService.refreshTokens(rawToken, '192.168.1.1', 'Mozilla/5.0'),
      ).rejects.toThrow(InvalidCredentialsException);

      expect(auditLogRepository.create).toHaveBeenCalledWith({
        userId: undefined,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        method: 'refresh',
        success: false,
        failureReason: 'malformed_token',
      });
    });
  });

  describe('TotpController audit logging', () => {
    const mockReq = {
      headers: { 'user-agent': 'TestBrowser/1.0' },
    } as any;

    it('should log success=true with method="totp" on valid TOTP code', async () => {
      const mockUser = {
        id: 'u-1',
        username: 'totpuser',
        email: 'totp@example.com',
        role: UserRole.USER,
        totpEnabled: true,
        totpSecretEnc: 'enc-secret',
        totpBackupCodesHash: null,
      };
      userRepository.findOne.mockResolvedValue(mockUser);
      totpService.verifyCode.mockResolvedValue(true);

      await totpController.authenticate(
        { tempToken: 'valid-temp', token: '123456', keepMeLoggedIn: false },
        mockReq,
        '10.0.0.5',
      );

      expect(auditLogRepository.create).toHaveBeenCalledWith({
        userId: 'u-1',
        ipAddress: '10.0.0.5',
        userAgent: 'TestBrowser/1.0',
        method: 'totp',
        success: true,
        failureReason: undefined,
      });
      expect(auditLogRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'totp', success: true }),
      );
    });

    it('should log success=false with method="totp" and failureReason on invalid code', async () => {
      const mockUser = {
        id: 'u-1',
        username: 'totpuser',
        email: 'totp@example.com',
        role: UserRole.USER,
        totpEnabled: true,
        totpSecretEnc: 'enc-secret',
        totpBackupCodesHash: null,
      };
      userRepository.findOne.mockResolvedValue(mockUser);
      totpService.verifyCode.mockResolvedValue(false);

      await expect(
        totpController.authenticate(
          { tempToken: 'valid-temp', token: '000000', keepMeLoggedIn: false },
          mockReq,
          '10.0.0.5',
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(auditLogRepository.create).toHaveBeenCalledWith({
        userId: 'u-1',
        ipAddress: '10.0.0.5',
        userAgent: 'TestBrowser/1.0',
        method: 'totp',
        success: false,
        failureReason: 'invalid_code',
      });
      expect(auditLogRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'totp', success: false, failureReason: 'invalid_code' }),
      );
    });

    it('should log method="backup_code" with success=false on invalid 8-char code', async () => {
      const mockUser = {
        id: 'u-1',
        username: 'totpuser',
        email: 'totp@example.com',
        role: UserRole.USER,
        totpEnabled: true,
        totpSecretEnc: 'enc-secret',
        totpBackupCodesHash: ['$2b$10$hashA'],
      };
      userRepository.findOne.mockResolvedValue(mockUser);
      totpService.verifyCode.mockResolvedValue(false);

      // bcrypt.compare will return false for a non-matching code
      await expect(
        totpController.authenticate(
          { tempToken: 'valid-temp', token: 'abcd1234', keepMeLoggedIn: false },
          mockReq,
          '10.0.0.5',
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(auditLogRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'backup_code', success: false, failureReason: 'invalid_code' }),
      );
    });

    it('should populate all audit log fields correctly', async () => {
      const mockUser = {
        id: 'u-42',
        username: 'fieldcheck',
        email: 'fields@example.com',
        role: UserRole.MEMBER,
        totpEnabled: true,
        totpSecretEnc: 'enc-secret',
        totpBackupCodesHash: null,
      };
      userRepository.findOne.mockResolvedValue(mockUser);
      totpService.verifyCode.mockResolvedValue(true);

      const customReq = {
        headers: { 'user-agent': 'Custom-Agent/2.0' },
      } as any;

      await totpController.authenticate(
        { tempToken: 'valid-temp', token: '654321', keepMeLoggedIn: true },
        customReq,
        '::ffff:192.168.0.1',
      );

      expect(auditLogRepository.create).toHaveBeenCalledWith({
        userId: 'u-42',
        ipAddress: '::ffff:192.168.0.1',
        userAgent: 'Custom-Agent/2.0',
        method: 'totp',
        success: true,
        failureReason: undefined,
      });
    });
  });
});
