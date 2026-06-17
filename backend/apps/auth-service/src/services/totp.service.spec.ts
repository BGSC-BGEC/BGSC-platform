import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TotpService } from './totp.service';
import * as crypto from 'crypto';

// Polyfill for @noble/hashes which requires crypto.getRandomValues (Node 18 test env)
if (!globalThis.crypto?.getRandomValues) {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      getRandomValues: (arr: Uint8Array) => crypto.randomFillSync(arr),
    },
  });
}

describe('TotpService', () => {
  let service: TotpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TotpService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'auth.totp.encryptionKey') {
                return crypto.randomBytes(32).toString('hex'); // 64 chars
              }
              if (key === 'auth.totp.issuer') {
                return 'Test Issuer';
              }
              if (key === 'auth.bcrypt.saltRounds') {
                return 1; // fast for testing
              }
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<TotpService>(TotpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should encrypt and decrypt a secret correctly', () => {
    const originalSecret = service.generateSecret();
    const encrypted = service.encryptSecret(originalSecret);
    const decrypted = service.decryptSecret(encrypted);

    expect(decrypted).toBe(originalSecret);
  });

  it('should generate backup codes', async () => {
    const { plainTextCodes, hashedCodes } = await service.generateBackupCodes();
    expect(plainTextCodes).toHaveLength(10);
    expect(hashedCodes).toHaveLength(10);
  });
});
