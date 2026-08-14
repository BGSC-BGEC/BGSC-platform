import { Repository } from 'typeorm';
import { AwardPointsDto } from '../src/points/dto/award-points.dto';
import { PointTransaction } from '../src/points/entities/point-transaction.entity';
import { EventBusService } from '../src/points/event-bus.service';
import { PointsService } from '../src/points/points.service';
import { PointsSource } from '../src/points/enums/points-source.enum';
import { TransactionType } from '../src/points/enums/transaction-type.enum';

type TransactionsRepositoryMock = Pick<
  jest.Mocked<Repository<PointTransaction>>,
  'create' | 'createQueryBuilder' | 'save'
>;

type EventBusMock = Pick<jest.Mocked<EventBusService>, 'emit'>;

describe('PointsService', () => {
  let transactionsRepository: TransactionsRepositoryMock;
  let eventBus: EventBusMock;
  let service: PointsService;

  beforeEach(() => {
    transactionsRepository = {
      create: jest.fn(),
      createQueryBuilder: jest.fn(),
      save: jest.fn(),
    };
    eventBus = { emit: jest.fn() };

    service = new PointsService(
      transactionsRepository as unknown as Repository<PointTransaction>,
      eventBus as unknown as EventBusService,
    );
  });

  describe('award', () => {
    it('creates an earn transaction and emits PointsEarned', async () => {
      const dto: AwardPointsDto = {
        userId: 'user-uuid',
        amount: 50,
        source: PointsSource.EVENT,
        referenceId: 'event-uuid',
      };
      const tx = makeTransaction(dto);
      transactionsRepository.create.mockReturnValue(tx);
      transactionsRepository.save.mockResolvedValue(tx);

      await expect(service.award(dto)).resolves.toMatchObject({
        userId: dto.userId,
        amount: 50,
        type: TransactionType.EARN,
        source: PointsSource.EVENT,
      });
      expect(eventBus.emit).toHaveBeenCalledWith(
        'PointsEarned',
        expect.objectContaining({
          userId: dto.userId,
          amount: 50,
          source: PointsSource.EVENT,
          referenceId: 'event-uuid',
        }),
      );
    });

    it('sets referenceId to null when not provided', async () => {
      const dto: AwardPointsDto = {
        userId: 'user-uuid',
        amount: 10,
        source: PointsSource.EVENT,
      };
      const tx = makeTransaction({ ...dto, referenceId: null });
      transactionsRepository.create.mockReturnValue(tx);
      transactionsRepository.save.mockResolvedValue(tx);

      await expect(service.award(dto)).resolves.toMatchObject({
        referenceId: null,
      });
      expect(transactionsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ referenceId: null }),
      );
    });
  });

  describe('awardParticipation', () => {
    it('awards 10 participation points for an event registration', async () => {
      const tx = makeTransaction({
        userId: 'user-uuid',
        amount: 10,
        source: PointsSource.EVENT,
        referenceId: 'event-uuid',
      });
      transactionsRepository.create.mockReturnValue(tx);
      transactionsRepository.save.mockResolvedValue(tx);

      await expect(
        service.awardParticipation('user-uuid', 'event-uuid'),
      ).resolves.toMatchObject({
        amount: 10,
        source: PointsSource.EVENT,
        referenceId: 'event-uuid',
      });
    });
  });

  describe('getBalance', () => {
    it('returns computed balance for a user', async () => {
      const builder = makeBalanceBuilder('150');
      transactionsRepository.createQueryBuilder.mockReturnValue(
        builder as never,
      );

      await expect(service.getBalance('user-uuid')).resolves.toEqual({
        userId: 'user-uuid',
        balance: 150,
      });
    });

    it('returns 0 balance when no transactions exist', async () => {
      const builder = makeBalanceBuilder(null);
      transactionsRepository.createQueryBuilder.mockReturnValue(
        builder as never,
      );

      await expect(service.getBalance('user-uuid')).resolves.toEqual({
        userId: 'user-uuid',
        balance: 0,
      });
    });
  });
});

function makeTransaction(partial: Partial<PointTransaction> = {}): PointTransaction {
  return Object.assign(new PointTransaction(), {
    id: 'tx-uuid',
    userId: 'user-uuid',
    amount: 10,
    type: TransactionType.EARN,
    source: PointsSource.EVENT,
    referenceId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...partial,
  });
}

function makeBalanceBuilder(balance: string | null) {
  return {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue(balance !== null ? { balance } : null),
  };
}
