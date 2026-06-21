import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AwardFansDto } from '../src/sponsors/dto/award-fans.dto';
import { CreateSponsorDto } from '../src/sponsors/dto/create-sponsor.dto';
import { LeaderboardSortBy } from '../src/sponsors/dto/leaderboard-query.dto';
import { Sponsor } from '../src/sponsors/entities/sponsor.entity';
import { UserSponsorAffiliation } from '../src/sponsors/entities/user-sponsor-affiliation.entity';
import { SponsorStatus } from '../src/sponsors/enums/sponsor-status.enum';
import { EventBusService } from '../src/sponsors/event-bus.service';
import { SponsorsService } from '../src/sponsors/sponsors.service';

type SponsorsRepositoryMock = Pick<
  jest.Mocked<Repository<Sponsor>>,
  'create' | 'createQueryBuilder' | 'count' | 'find' | 'findOneBy' | 'save'
>;

type AffiliationsRepositoryMock = Pick<
  jest.Mocked<Repository<UserSponsorAffiliation>>,
  'count' | 'createQueryBuilder' | 'findOneBy' | 'save'
>;

type EventBusMock = Pick<jest.Mocked<EventBusService>, 'emit'>;
type DataSourceMock = Pick<jest.Mocked<DataSource>, 'transaction'>;

describe('SponsorsService', () => {
  let sponsorsRepository: SponsorsRepositoryMock;
  let affiliationsRepository: AffiliationsRepositoryMock;
  let eventBus: EventBusMock;
  let dataSource: DataSourceMock;
  let service: SponsorsService;

  beforeEach(() => {
    sponsorsRepository = {
      create: jest.fn(),
      createQueryBuilder: jest.fn(),
      count: jest.fn(),
      find: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn(),
    };

    affiliationsRepository = {
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn(),
    };

    eventBus = {
      emit: jest.fn(),
    };

    dataSource = {
      transaction: jest.fn(),
    };

    service = new SponsorsService(
      sponsorsRepository as unknown as Repository<Sponsor>,
      affiliationsRepository as unknown as Repository<UserSponsorAffiliation>,
      eventBus as unknown as EventBusService,
      dataSource as unknown as DataSource,
    );
  });

  it('creates a sponsor with active status by default', async () => {
    const dto: CreateSponsorDto = {
      name: 'Red Bull Campus',
      tenureStart: '2026-01-01',
    };
    const sponsor = makeSponsor(dto);

    sponsorsRepository.create.mockReturnValue(sponsor);
    sponsorsRepository.save.mockResolvedValue(sponsor);

    await expect(service.create(dto)).resolves.toMatchObject({
      name: dto.name,
      status: SponsorStatus.ACTIVE,
      tenureStart: dto.tenureStart,
    });
    expect(sponsorsRepository.create).toHaveBeenCalledWith({
      ...dto,
      status: SponsorStatus.ACTIVE,
    });
  });

  it('returns sponsors filtered by status', async () => {
    const sponsor = makeSponsor({ status: SponsorStatus.INACTIVE });
    sponsorsRepository.find.mockResolvedValue([sponsor]);

    await expect(
      service.findAll({ status: SponsorStatus.INACTIVE }),
    ).resolves.toHaveLength(1);
    expect(sponsorsRepository.find).toHaveBeenCalledWith({
      where: { status: SponsorStatus.INACTIVE },
      order: { tenureStart: 'DESC', createdAt: 'DESC' },
    });
  });

  it('returns active sponsors based on tenure and status', async () => {
    const sponsor = makeSponsor();
    const builder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([sponsor]),
    };

    sponsorsRepository.createQueryBuilder.mockReturnValue(builder as never);

    await expect(service.findActive()).resolves.toHaveLength(1);
    expect(sponsorsRepository.createQueryBuilder).toHaveBeenCalledWith(
      'sponsor',
    );
  });

  it('throws not found for a missing sponsor', async () => {
    sponsorsRepository.findOneBy.mockResolvedValue(null);

    await expect(service.findOne('missing-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('soft deletes a sponsor by marking it inactive', async () => {
    const sponsor = makeSponsor({ tenureEnd: null });
    const inactiveSponsor = makeSponsor({
      status: SponsorStatus.INACTIVE,
      tenureEnd: '2026-06-21',
    });

    sponsorsRepository.findOneBy
      .mockResolvedValueOnce(sponsor)
      .mockResolvedValueOnce(inactiveSponsor);
    sponsorsRepository.save.mockResolvedValue(inactiveSponsor);

    await expect(service.remove(sponsor.id)).resolves.toMatchObject({
      status: SponsorStatus.INACTIVE,
    });
    expect(sponsor.status).toBe(SponsorStatus.INACTIVE);
  });

  it('maps Postgres unique constraint errors to conflict errors', async () => {
    const dto: CreateSponsorDto = {
      name: 'Campus Cola',
      tenureStart: '2026-01-01',
    };

    sponsorsRepository.create.mockReturnValue(makeSponsor(dto));
    sponsorsRepository.save.mockRejectedValue({ code: '23505' });

    await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
  });

  describe('addFans', () => {
    const sponsorId = 'sponsor-uuid';
    const userId = 'user-uuid';
    const eventId = 'event-uuid';
    const dto: AwardFansDto = {
      userId,
      eventId,
      amount: 5,
      reason: 'event_win',
    };

    function mockTransaction(options: {
      sponsor?: Sponsor | null;
      affiliation?: UserSponsorAffiliation | null;
      sum?: string;
    }) {
      const sponsor =
        options.sponsor === undefined
          ? makeSponsor({ id: sponsorId })
          : options.sponsor;
      const affiliation =
        options.affiliation === undefined
          ? makeAffiliation({ userId, sponsorId, fanCount: 3 })
          : options.affiliation;
      const sponsorRepo = {
        findOne: jest.fn().mockResolvedValue(sponsor),
        save: jest.fn().mockResolvedValue(sponsor),
      };
      const sumBuilder = makeSumBuilder(options.sum ?? '8');
      const affiliationRepo = {
        findOne: jest.fn().mockResolvedValue(affiliation),
        save: jest.fn().mockResolvedValue(affiliation),
        createQueryBuilder: jest.fn().mockReturnValue(sumBuilder),
      };
      const manager = {
        getRepository: jest.fn((entity) => {
          if (entity === Sponsor) {
            return sponsorRepo;
          }
          return affiliationRepo;
        }),
      } as unknown as EntityManager;

      dataSource.transaction.mockImplementationOnce(
        async (
          callbackOrIsolation:
            | ((entityManager: EntityManager) => Promise<unknown>)
            | string,
          maybeCallback?: (entityManager: EntityManager) => Promise<unknown>,
        ) => {
          const callback =
            typeof callbackOrIsolation === 'function'
              ? callbackOrIsolation
              : maybeCallback;

          if (!callback) {
            throw new Error('Missing transaction callback');
          }

          return callback(manager);
        },
      );

      return { sponsorRepo, affiliationRepo, sponsor, affiliation };
    }

    it('awards fans to an affiliated user and emits FanEarned event', async () => {
      const tx = mockTransaction({});

      await expect(service.addFans(sponsorId, dto)).resolves.toMatchObject({
        id: sponsorId,
        totalFans: 8,
      });

      const affiliation = tx.affiliation;
      expect(affiliation).not.toBeNull();
      expect(affiliation?.fanCount).toBe(8);
      expect(affiliation?.eventsWon).toContain(eventId);
      expect(eventBus.emit).toHaveBeenCalledWith('FanEarned', {
        userId,
        sponsorId,
        eventId,
        amount: 5,
        reason: 'event_win',
      });
    });

    it('throws BadRequestException for sponsor outside active tenure', async () => {
      mockTransaction({
        sponsor: makeSponsor({
          id: sponsorId,
          status: SponsorStatus.INACTIVE,
        }),
      });

      await expect(service.addFans(sponsorId, dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws BadRequestException when user is not affiliated', async () => {
      mockTransaction({
        affiliation: null,
      });

      await expect(service.addFans(sponsorId, dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('does not duplicate eventId in eventsWon array', async () => {
      const tx = mockTransaction({
        affiliation: makeAffiliation({
          userId,
          sponsorId,
          fanCount: 0,
          eventsWon: [eventId],
        }),
        sum: '5',
      });

      await service.addFans(sponsorId, dto);

      const affiliation = tx.affiliation;
      expect(affiliation).not.toBeNull();
      expect(affiliation?.eventsWon).toEqual([eventId]);
    });
  });

  describe('getLeaderboard', () => {
    function mockLeaderboardSponsors(sponsors: Sponsor[]) {
      const builder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(sponsors),
      };
      sponsorsRepository.createQueryBuilder.mockReturnValue(builder as never);
      return builder;
    }

    it('returns tenure-active sponsors ranked by fan count (default)', async () => {
      const sponsorA = makeSponsor({ id: 'a', name: 'Alpha', totalFans: 100 });
      const sponsorB = makeSponsor({ id: 'b', name: 'Beta', totalFans: 50 });
      mockLeaderboardSponsors([sponsorA, sponsorB]);

      affiliationsRepository.createQueryBuilder
        .mockReturnValueOnce(makeCountBuilder('2') as never)
        .mockReturnValueOnce(makeCountBuilder('3') as never)
        .mockReturnValueOnce(makeCountBuilder('1') as never)
        .mockReturnValueOnce(makeCountBuilder('2') as never);

      const result = await service.getLeaderboard();

      expect(result).toHaveLength(2);
      expect(result[0].rank).toBe(1);
      expect(result[0].name).toBe('Alpha');
      expect(result[1].rank).toBe(2);
      expect(result[1].name).toBe('Beta');
    });

    it('sorts by events won when sort=events', async () => {
      const sponsorA = makeSponsor({ id: 'a', name: 'Alpha', totalFans: 10 });
      const sponsorB = makeSponsor({ id: 'b', name: 'Beta', totalFans: 100 });
      mockLeaderboardSponsors([sponsorA, sponsorB]);

      affiliationsRepository.createQueryBuilder
        .mockReturnValueOnce(makeCountBuilder('5') as never)
        .mockReturnValueOnce(makeCountBuilder('2') as never)
        .mockReturnValueOnce(makeCountBuilder('1') as never)
        .mockReturnValueOnce(makeCountBuilder('1') as never);

      const result = await service.getLeaderboard({
        sort: LeaderboardSortBy.EVENTS,
      });

      expect(result[0].name).toBe('Alpha');
      expect(result[0].eventsWonCount).toBe(5);
      expect(result[1].name).toBe('Beta');
      expect(result[1].eventsWonCount).toBe(2);
    });

    it('sorts by distinct affiliated users when sort=users', async () => {
      const sponsorA = makeSponsor({ id: 'a', name: 'Alpha' });
      const sponsorB = makeSponsor({ id: 'b', name: 'Beta' });
      mockLeaderboardSponsors([sponsorA, sponsorB]);

      affiliationsRepository.createQueryBuilder
        .mockReturnValueOnce(makeCountBuilder('0') as never)
        .mockReturnValueOnce(makeCountBuilder('0') as never)
        .mockReturnValueOnce(makeCountBuilder('10') as never)
        .mockReturnValueOnce(makeCountBuilder('3') as never);

      const result = await service.getLeaderboard({
        sort: LeaderboardSortBy.USERS,
      });

      expect(result[0].name).toBe('Alpha');
      expect(result[0].affiliatedUserCount).toBe(10);
      expect(result[1].name).toBe('Beta');
      expect(result[1].affiliatedUserCount).toBe(3);
    });

    it('returns empty array when no tenure-active sponsors', async () => {
      mockLeaderboardSponsors([]);

      const result = await service.getLeaderboard();

      expect(result).toEqual([]);
    });
  });
});

function makeSponsor(partial: Partial<Sponsor> = {}): Sponsor {
  return Object.assign(new Sponsor(), {
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    description: null,
    id: '56897824-0e66-46ef-9a9c-a5a327dd1d77',
    logoUrl: null,
    name: 'Blue Hawks',
    status: SponsorStatus.ACTIVE,
    tenureEnd: '2099-06-30',
    tenureStart: '2026-01-01',
    totalFans: 0,
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    websiteUrl: null,
    ...partial,
  });
}

function makeAffiliation(
  partial: Partial<UserSponsorAffiliation> = {},
): UserSponsorAffiliation {
  return Object.assign(new UserSponsorAffiliation(), {
    affiliatedAt: new Date('2026-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    eventsWon: [],
    fanCount: 0,
    id: 'affiliation-uuid',
    sponsorId: 'sponsor-uuid',
    totalPointsContributed: 0,
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    userId: 'user-uuid',
    ...partial,
  });
}

function makeSumBuilder(sum: string) {
  return {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ sum }),
  };
}

function makeCountBuilder(count: string) {
  return {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ count }),
  };
}
