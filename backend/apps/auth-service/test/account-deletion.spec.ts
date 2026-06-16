import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AccountDeletionJob } from '../src/services/account-deletion.job';
import { AccountService } from '../src/services/account.service';
import { UserCredential } from '../src/entities/user-credential.entity';
import { UserStatus } from '../src/constants/roles.constant';
import { SessionService } from '../src/services/session.service';
import { EventBusService } from '../src/services/event-bus.service';

interface MockUserRepository {
  find: jest.Mock;
  delete: jest.Mock;
}
interface MockSessionService {
  revokeAllSessions: jest.Mock;
}
interface MockEventBusService {
  emit: jest.Mock;
}

describe('Account Deletion Job and Service Purge', () => {
  let deletionJob: AccountDeletionJob;
  let accountService: AccountService;
  let userRepository: MockUserRepository;
  let sessionService: MockSessionService;
  let eventBusService: MockEventBusService;

  beforeEach(async () => {
    userRepository = {
      find: jest.fn(),
      delete: jest.fn(),
    };

    sessionService = {
      revokeAllSessions: jest.fn().mockResolvedValue(undefined),
    };

    eventBusService = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountDeletionJob,
        AccountService,
        {
          provide: getRepositoryToken(UserCredential),
          useValue: userRepository,
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

    deletionJob = module.get<AccountDeletionJob>(AccountDeletionJob);
    accountService = module.get<AccountService>(AccountService);
  });

  it('should be defined', () => {
    expect(deletionJob).toBeDefined();
    expect(accountService).toBeDefined();
  });

  describe('AccountDeletionJob', () => {
    it('should invoke accountService.purgeScheduledDeletions and return the count', async () => {
      const purgeSpy = jest
        .spyOn(accountService, 'purgeScheduledDeletions')
        .mockResolvedValue(5);
      const now = new Date();
      const count = await deletionJob.run(now);

      expect(count).toBe(5);
      expect(purgeSpy).toHaveBeenCalledWith(now);
    });

    it('should catch errors in run() and return 0', async () => {
      jest
        .spyOn(accountService, 'purgeScheduledDeletions')
        .mockRejectedValue(new Error('DB connection lost'));
      const count = await deletionJob.run();

      expect(count).toBe(0);
    });

    it('should start and stop timer on lifecycle hooks', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      deletionJob.onModuleInit();
      expect(setIntervalSpy).toHaveBeenCalled();

      deletionJob.onModuleDestroy();
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('AccountService.purgeScheduledDeletions', () => {
    it('should fetch pending deletion users scheduled before or equal to now, delete them, revoke sessions, and emit events', async () => {
      const now = new Date();
      const mockUsers = [
        {
          id: 'user-id-1',
          status: UserStatus.PENDING_DELETION,
          deletionScheduled: now,
        },
        {
          id: 'user-id-2',
          status: UserStatus.PENDING_DELETION,
          deletionScheduled: new Date(now.getTime() - 1000),
        },
      ];

      userRepository.find.mockResolvedValue(mockUsers);
      userRepository.delete.mockResolvedValue(undefined);

      const count = await accountService.purgeScheduledDeletions(now);

      expect(count).toBe(2);
      expect(userRepository.find).toHaveBeenCalledWith({
        where: {
          status: UserStatus.PENDING_DELETION,
          deletionScheduled: expect.any(Object),
        },
      });
      expect(sessionService.revokeAllSessions).toHaveBeenCalledWith(
        'user-id-1',
      );
      expect(sessionService.revokeAllSessions).toHaveBeenCalledWith(
        'user-id-2',
      );
      expect(userRepository.delete).toHaveBeenCalledWith('user-id-1');
      expect(userRepository.delete).toHaveBeenCalledWith('user-id-2');
      expect(eventBusService.emit).toHaveBeenCalledWith('UserDeleted', {
        userId: 'user-id-1',
        timestamp: expect.any(String),
      });
      expect(eventBusService.emit).toHaveBeenCalledWith('UserDeleted', {
        userId: 'user-id-2',
        timestamp: expect.any(String),
      });
    });

    it('should return 0 if there are no scheduled deletions', async () => {
      userRepository.find.mockResolvedValue([]);
      const count = await accountService.purgeScheduledDeletions(new Date());

      expect(count).toBe(0);
      expect(userRepository.delete).not.toHaveBeenCalled();
      expect(sessionService.revokeAllSessions).not.toHaveBeenCalled();
      expect(eventBusService.emit).not.toHaveBeenCalled();
    });
  });
});
