import { Test, TestingModule } from '@nestjs/testing';
import { SessionService } from '../src/services/session.service';
import { InvalidCredentialsException } from '../src/exceptions/invalid-credentials.exception';
import { TokenReuseDetectedException } from '../src/exceptions/token-reuse-detected.exception';

describe('SessionService', () => {
  let service: SessionService;
  let mockRedis: any;

  beforeEach(async () => {
    mockRedis = {
      pipeline: jest.fn().mockReturnValue({
        hset: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        sadd: jest.fn().mockReturnThis(),
        del: jest.fn().mockReturnThis(),
        srem: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }),
      smembers: jest.fn().mockResolvedValue([]),
      hgetall: jest.fn().mockResolvedValue({}),
      hget: jest.fn().mockResolvedValue(null),
      srem: jest.fn().mockResolvedValue(1),
      del: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: 'REDIS_CLIENT',
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSession', () => {
    it('should create a session and call redis pipeline methods', async () => {
      const userId = 'user-123';
      const tokenHash = 'hash-abc';
      const familyId = 'family-xyz';
      const ip = '127.0.0.1';
      const ua = 'test-ua';

      await service.createSession(userId, tokenHash, familyId, ip, ua, true);

      expect(mockRedis.pipeline).toHaveBeenCalled();
      expect(mockRedis.smembers).toHaveBeenCalledWith(`auth:session_index:${userId}`);
    });

    it('should evict the oldest session when concurrent session limit (5) is exceeded', async () => {
      const userId = 'user-123';
      const tokenHash = 'hash-new';
      const familyId = 'family-new';
      const ip = '127.0.0.1';
      const ua = 'test-ua';

      // Mock 6 sessions inside the index
      mockRedis.smembers.mockResolvedValue([
        'f1', 'f2', 'f3', 'f4', 'f5', 'family-new'
      ]);

      // Mock lastUsedAt timestamps where f1 is the oldest
      mockRedis.hget.mockImplementation((key: string, field: string) => {
        if (field === 'lastUsedAt') {
          if (key.includes('f1')) return '1000';
          if (key.includes('f2')) return '2000';
          if (key.includes('f3')) return '3000';
          if (key.includes('f4')) return '4000';
          if (key.includes('f5')) return '5000';
          if (key.includes('family-new')) return '6000';
        }
        return null;
      });

      await service.createSession(userId, tokenHash, familyId, ip, ua, true);

      // Verify that the oldest session (f1) was deleted/revoked
      expect(mockRedis.pipeline).toHaveBeenCalled();
      // Revoking oldest will delete f1 key and remove f1 from set index
      expect(mockRedis.pipeline().del).toHaveBeenCalledWith('auth:session:user-123:f1');
      expect(mockRedis.pipeline().srem).toHaveBeenCalledWith('auth:session_index:user-123', 'f1');
    });
  });

  describe('validateAndRotateSession', () => {
    it('should successfully rotate session when old token hash matches', async () => {
      const userId = 'user-123';
      const familyId = 'family-xyz';
      const oldTokenHash = 'hash-old';
      const newTokenHash = 'hash-new';
      const ip = '127.0.0.1';
      const ua = 'test-ua';

      mockRedis.hgetall.mockResolvedValue({
        tokenHash: oldTokenHash,
        keepMeLoggedIn: 'true',
      });

      const keepMeLoggedIn = await service.validateAndRotateSession(
        userId, familyId, oldTokenHash, newTokenHash, ip, ua
      );

      expect(keepMeLoggedIn).toBe(true);
      expect(mockRedis.pipeline).toHaveBeenCalled();
      expect(mockRedis.pipeline().hset).toHaveBeenCalledWith(
        'auth:session:user-123:family-xyz',
        expect.objectContaining({ tokenHash: newTokenHash })
      );
    });

    it('should throw InvalidCredentialsException when session does not exist', async () => {
      mockRedis.hgetall.mockResolvedValue({});

      await expect(
        service.validateAndRotateSession('u', 'f', 'old', 'new', 'ip', 'ua')
      ).rejects.toThrow(InvalidCredentialsException);
    });

    it('should detect breach, revoke all sessions, and throw TokenReuseDetectedException when hash mismatches', async () => {
      const userId = 'user-123';
      mockRedis.hgetall.mockResolvedValue({
        tokenHash: 'hash-stale-already-rotated',
        keepMeLoggedIn: 'true',
      });

      mockRedis.smembers.mockResolvedValue(['f1', 'f2']);

      await expect(
        service.validateAndRotateSession(userId, 'family-xyz', 'hash-replayed', 'hash-new', 'ip', 'ua')
      ).rejects.toThrow(TokenReuseDetectedException);

      // Verify all sessions were deleted
      expect(mockRedis.pipeline().del).toHaveBeenCalledWith('auth:session:user-123:f1');
      expect(mockRedis.pipeline().del).toHaveBeenCalledWith('auth:session:user-123:f2');
      expect(mockRedis.pipeline().del).toHaveBeenCalledWith('auth:session_index:user-123');
    });
  });

  describe('revokeSession', () => {
    it('should delete session key and remove familyId from set', async () => {
      await service.revokeSession('user-123', 'family-xyz');
      expect(mockRedis.pipeline().del).toHaveBeenCalledWith('auth:session:user-123:family-xyz');
      expect(mockRedis.pipeline().srem).toHaveBeenCalledWith('auth:session_index:user-123', 'family-xyz');
    });
  });

  describe('revokeAllSessions', () => {
    it('should delete all session keys for active familyIds and index key', async () => {
      mockRedis.smembers.mockResolvedValue(['f1', 'f2']);
      await service.revokeAllSessions('user-123');
      expect(mockRedis.pipeline().del).toHaveBeenCalledWith('auth:session:user-123:f1');
      expect(mockRedis.pipeline().del).toHaveBeenCalledWith('auth:session:user-123:f2');
      expect(mockRedis.pipeline().del).toHaveBeenCalledWith('auth:session_index:user-123');
    });
  });

  describe('revokeAllSessionsExcept', () => {
    it('should delete every session except the current familyId', async () => {
      mockRedis.smembers.mockResolvedValue(['f1', 'current', 'f2']);

      await service.revokeAllSessionsExcept('user-123', 'current');

      expect(mockRedis.pipeline().del).toHaveBeenCalledWith('auth:session:user-123:f1');
      expect(mockRedis.pipeline().del).toHaveBeenCalledWith('auth:session:user-123:f2');
      expect(mockRedis.pipeline().del).not.toHaveBeenCalledWith('auth:session:user-123:current');
      expect(mockRedis.pipeline().srem).toHaveBeenCalledWith('auth:session_index:user-123', 'f1');
      expect(mockRedis.pipeline().srem).toHaveBeenCalledWith('auth:session_index:user-123', 'f2');
    });
  });
});
