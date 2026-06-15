import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PasswordService } from '../src/services/password.service';

describe('PasswordService', () => {
  let service: PasswordService;

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'auth.bcrypt.saltRounds') {
        return 12;
      }
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<PasswordService>(PasswordService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('hashPassword and verifyPassword', () => {
    it('should correctly hash and verify a password', async () => {
      const password = 'StrongP@ssw0rd123';
      const hash = await service.hashPassword(password);
      expect(hash).toBeDefined();
      expect(hash).not.toEqual(password);

      const isValid = await service.verifyPassword(password, hash);
      expect(isValid).toBe(true);

      const isInvalid = await service.verifyPassword('WrongPassword', hash);
      expect(isInvalid).toBe(false);
    });
  });

  describe('generateResetToken', () => {
    it('should generate a raw token and its SHA-256 hash', () => {
      const result = service.generateResetToken();
      expect(result.raw).toBeDefined();
      expect(result.hash).toBeDefined();
      expect(result.raw.length).toBe(64); // 32 bytes hex
      expect(result.hash.length).toBe(64); // SHA-256 hash length is 64 hex characters
    });
  });
});
