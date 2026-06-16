import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenService } from '../src/services/token.service';
import { UserRole } from '../src/constants/roles.constant';
import { UserCredential } from '../src/entities/user-credential.entity';

describe('TokenService', () => {
  let service: TokenService;
  let jwtService: JwtService;

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string) => {
      switch (key) {
        case 'auth.jwt.accessSecret':
          return 'test-access-secret-key-at-least-32-bytes-long';
        case 'auth.jwt.accessExpiry':
          return '15m';
        case 'auth.jwt.issuer':
          return 'bgsc-auth-service';
        default:
          return null;
      }
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        JwtService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('JWT Access Token Operations', () => {
    it('should sign and verify access tokens correctly', () => {
      const user = new UserCredential();
      user.id = 'user-uuid-123';
      user.username = 'testuser';
      user.email = 'test@example.com';
      user.role = UserRole.USER;

      const token = service.signAccessToken(user);
      expect(token).toBeDefined();

      const payload = service.verifyAccessToken(token);
      expect(payload).toBeDefined();
      expect(payload.sub).toBe(user.id);
      expect(payload.username).toBe(user.username);
      expect(payload.email).toBe(user.email);
      expect(payload.role).toBe(user.role);
      expect(payload.jti).toBeDefined();
    });
  });

  describe('Temp Token Operations', () => {
    it('should sign and verify temp tokens with specific purpose', () => {
      const userId = 'user-uuid-123';
      const purpose = 'totp_verification';

      const token = service.signTempToken(userId, purpose);
      expect(token).toBeDefined();

      const decodedId = service.verifyTempToken(token, purpose);
      expect(decodedId).toBe(userId);
    });

    it('should reject temp tokens with wrong purpose', () => {
      const userId = 'user-uuid-123';
      const token = service.signTempToken(userId, 'some_other_purpose');

      expect(() => {
        service.verifyTempToken(token, 'totp_verification');
      }).toThrow('Invalid token purpose');
    });
  });

  describe('Refresh Token Operations', () => {
    it('should generate valid refresh tokens', () => {
      const userId = 'user-uuid-123';
      const result = service.generateRefreshToken(userId);

      expect(result.raw).toBeDefined();
      expect(result.hash).toBeDefined();
      expect(result.familyId).toBeDefined();

      const parts = result.raw.split('.');
      expect(parts.length).toBe(3);
      expect(parts[0]).toBe(userId);
      expect(parts[1]).toBe(result.familyId);

      const computedHash = service.hashToken(result.raw);
      expect(computedHash).toBe(result.hash);
    });

    it('should respect existing familyId when generating rotated refresh tokens', () => {
      const userId = 'user-uuid-123';
      const familyId = 'existing-family-uuid';
      const result = service.generateRefreshToken(userId, familyId);

      expect(result.familyId).toBe(familyId);
      const parts = result.raw.split('.');
      expect(parts[1]).toBe(familyId);
    });
  });
});
