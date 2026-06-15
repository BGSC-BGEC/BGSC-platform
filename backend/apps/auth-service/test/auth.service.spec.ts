import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { AuthService } from '../src/services/auth.service';
import { UserCredential } from '../src/entities/user-credential.entity';
import { LoginAuditLog } from '../src/entities/login-audit-log.entity';
import { PasswordService } from '../src/services/password.service';
import { TokenService } from '../src/services/token.service';
import { SessionService } from '../src/services/session.service';
import { EventBusService } from '../src/services/event-bus.service';
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
      blacklistJti: jest.fn().mockResolvedValue(undefined),
    };

    eventBusService = {
      emit: jest.fn(),
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
});
