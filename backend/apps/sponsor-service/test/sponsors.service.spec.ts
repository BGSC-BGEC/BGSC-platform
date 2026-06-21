import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CreateSponsorDto } from '../src/sponsors/dto/create-sponsor.dto';
import { Sponsor } from '../src/sponsors/entities/sponsor.entity';
import { UserSponsorAffiliation } from '../src/sponsors/entities/user-sponsor-affiliation.entity';
import { SponsorStatus } from '../src/sponsors/enums/sponsor-status.enum';
import { SponsorsService } from '../src/sponsors/sponsors.service';

type SponsorsRepositoryMock = Pick<
  jest.Mocked<Repository<Sponsor>>,
  'create' | 'createQueryBuilder' | 'count' | 'find' | 'findOneBy' | 'save'
>;

type AffiliationsRepositoryMock = Pick<
  jest.Mocked<Repository<UserSponsorAffiliation>>,
  'count'
>;

describe('SponsorsService', () => {
  let sponsorsRepository: SponsorsRepositoryMock;
  let affiliationsRepository: AffiliationsRepositoryMock;
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
    };

    service = new SponsorsService(
      sponsorsRepository as unknown as Repository<Sponsor>,
      affiliationsRepository as unknown as Repository<UserSponsorAffiliation>,
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
    expect(sponsorsRepository.createQueryBuilder).toHaveBeenCalledWith('sponsor');
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
});

function makeSponsor(partial: Partial<Sponsor> = {}): Sponsor {
  return Object.assign(new Sponsor(), {
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    description: null,
    id: '56897824-0e66-46ef-9a9c-a5a327dd1d77',
    logoUrl: null,
    name: 'Blue Hawks',
    status: SponsorStatus.ACTIVE,
    tenureEnd: '2026-06-30',
    tenureStart: '2026-01-01',
    totalFans: 0,
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    websiteUrl: null,
    ...partial,
  });
}
