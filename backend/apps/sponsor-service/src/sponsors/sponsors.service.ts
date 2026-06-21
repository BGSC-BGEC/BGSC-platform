import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AwardFansDto } from './dto/award-fans.dto';
import { CreateSponsorDto } from './dto/create-sponsor.dto';
import { LeaderboardEntryDto } from './dto/leaderboard-entry.dto';
import {
  LeaderboardQueryDto,
  LeaderboardSortBy,
} from './dto/leaderboard-query.dto';
import { ListSponsorsQueryDto } from './dto/list-sponsors-query.dto';
import { SponsorResponseDto } from './dto/sponsor-response.dto';
import { UpdateSponsorDto } from './dto/update-sponsor.dto';
import { Sponsor } from './entities/sponsor.entity';
import { UserSponsorAffiliation } from './entities/user-sponsor-affiliation.entity';
import { SponsorStatus } from './enums/sponsor-status.enum';
import { EventBusService } from './event-bus.service';
import { FanEarnedEvent } from './events/fan-earned.event';

@Injectable()
export class SponsorsService {
  constructor(
    @InjectRepository(Sponsor)
    private readonly sponsorsRepository: Repository<Sponsor>,
    @InjectRepository(UserSponsorAffiliation)
    private readonly affiliationsRepository: Repository<UserSponsorAffiliation>,
    private readonly eventBus: EventBusService,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    createSponsorDto: CreateSponsorDto,
  ): Promise<SponsorResponseDto> {
    const sponsor = this.sponsorsRepository.create({
      ...createSponsorDto,
      status: createSponsorDto.status ?? SponsorStatus.ACTIVE,
    });

    try {
      return this.toResponse(await this.sponsorsRepository.save(sponsor));
    } catch (error) {
      this.throwConflictForUniqueViolation(error);
      throw error;
    }
  }

  async findAll(
    filters: ListSponsorsQueryDto = {},
  ): Promise<SponsorResponseDto[]> {
    const sponsors = await this.sponsorsRepository.find({
      where: filters.status ? { status: filters.status } : {},
      order: { tenureStart: 'DESC', createdAt: 'DESC' },
    });

    return sponsors.map((sponsor) => this.toResponse(sponsor));
  }

  async findActive(): Promise<SponsorResponseDto[]> {
    const today = new Date().toISOString().slice(0, 10);
    const sponsors = await this.sponsorsRepository
      .createQueryBuilder('sponsor')
      .where('sponsor.status = :status', { status: SponsorStatus.ACTIVE })
      .andWhere('sponsor.tenureStart <= :today', { today })
      .andWhere('(sponsor.tenureEnd IS NULL OR sponsor.tenureEnd >= :today)', {
        today,
      })
      .orderBy('sponsor.tenureStart', 'DESC')
      .addOrderBy('sponsor.createdAt', 'DESC')
      .getMany();

    return sponsors.map((sponsor) => this.toResponse(sponsor));
  }

  async findOne(id: string): Promise<SponsorResponseDto> {
    return this.toResponse(await this.findEntity(id));
  }

  async update(
    id: string,
    updateSponsorDto: UpdateSponsorDto,
  ): Promise<SponsorResponseDto> {
    const sponsor = await this.findEntity(id);
    Object.assign(sponsor, updateSponsorDto);

    try {
      await this.sponsorsRepository.save(sponsor);
      return this.findOne(id);
    } catch (error) {
      this.throwConflictForUniqueViolation(error);
      throw error;
    }
  }

  async remove(id: string): Promise<SponsorResponseDto> {
    const sponsor = await this.findEntity(id);
    sponsor.status = SponsorStatus.INACTIVE;
    sponsor.tenureEnd ??= new Date().toISOString().slice(0, 10);
    await this.sponsorsRepository.save(sponsor);
    return this.findOne(id);
  }

  async addFans(
    sponsorId: string,
    dto: AwardFansDto,
  ): Promise<SponsorResponseDto> {
    const sponsor = await this.dataSource.transaction(async (manager) => {
      const sponsorRepository = manager.getRepository(Sponsor);
      const affiliationRepository =
        manager.getRepository(UserSponsorAffiliation);

      const sponsor = await sponsorRepository.findOne({
        where: { id: sponsorId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!sponsor) {
        throw new NotFoundException('Sponsor not found');
      }
      if (!this.isSponsorActiveToday(sponsor)) {
        throw new BadRequestException(
          'Cannot award fans to a sponsor outside the active tenure',
        );
      }

      const affiliation = await affiliationRepository.findOne({
        where: {
          userId: dto.userId,
          sponsorId,
        },
        order: { affiliatedAt: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!affiliation) {
        throw new BadRequestException('User is not affiliated with this sponsor');
      }

      affiliation.fanCount += dto.amount;
      if (!affiliation.eventsWon.includes(dto.eventId)) {
        affiliation.eventsWon = [...affiliation.eventsWon, dto.eventId];
      }
      await affiliationRepository.save(affiliation);

      sponsor.totalFans = await affiliationRepository
        .createQueryBuilder('affiliation')
        .select('COALESCE(SUM(affiliation.fanCount), 0)', 'sum')
        .where('affiliation.sponsorId = :sponsorId', { sponsorId })
        .getRawOne<{ sum: string }>()
        .then((row) => Number(row?.sum ?? 0));

      await sponsorRepository.save(sponsor);
      return sponsor;
    });

    const event: FanEarnedEvent = {
      userId: dto.userId,
      sponsorId,
      eventId: dto.eventId,
      amount: dto.amount,
      reason: dto.reason,
    };
    this.eventBus.emit('FanEarned', event);

    return this.toResponse(sponsor);
  }

  async getLeaderboard(
    query: LeaderboardQueryDto = {},
  ): Promise<LeaderboardEntryDto[]> {
    const sortBy = query.sort ?? LeaderboardSortBy.FANS;
    const today = this.getToday();
    const sponsors = await this.sponsorsRepository
      .createQueryBuilder('sponsor')
      .where('sponsor.status = :status', { status: SponsorStatus.ACTIVE })
      .andWhere('sponsor.tenureStart <= :today', { today })
      .andWhere('(sponsor.tenureEnd IS NULL OR sponsor.tenureEnd >= :today)', {
        today,
      })
      .getMany();

    const entries = await Promise.all(
      sponsors.map(async (sponsor) => {
        const eventsWonCount = await this.affiliationsRepository
          .createQueryBuilder('affiliation')
          .select(
            'COALESCE(SUM(array_length(affiliation.eventsWon, 1)), 0)',
            'count',
          )
          .where('affiliation.sponsorId = :sponsorId', {
            sponsorId: sponsor.id,
          })
          .getRawOne<{ count: string }>()
          .then((row) => Number(row?.count ?? 0));

        const affiliatedUserCount = await this.affiliationsRepository
          .createQueryBuilder('affiliation')
          .select('COUNT(DISTINCT affiliation.userId)', 'count')
          .where('affiliation.sponsorId = :sponsorId', {
            sponsorId: sponsor.id,
          })
          .getRawOne<{ count: string }>()
          .then((row) => Number(row?.count ?? 0));

        return {
          rank: 0,
          sponsorId: sponsor.id,
          name: sponsor.name,
          logoUrl: sponsor.logoUrl,
          totalFans: sponsor.totalFans,
          eventsWonCount,
          affiliatedUserCount,
        };
      }),
    );

    switch (sortBy) {
      case LeaderboardSortBy.FANS:
        entries.sort((a, b) => b.totalFans - a.totalFans);
        break;
      case LeaderboardSortBy.EVENTS:
        entries.sort((a, b) => b.eventsWonCount - a.eventsWonCount);
        break;
      case LeaderboardSortBy.USERS:
        entries.sort((a, b) => b.affiliatedUserCount - a.affiliatedUserCount);
        break;
    }

    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return entries;
  }

  async countAffiliationsForSponsor(sponsorId: string): Promise<number> {
    return this.affiliationsRepository.count({ where: { sponsorId } });
  }

  private async findEntity(id: string): Promise<Sponsor> {
    const sponsor = await this.sponsorsRepository.findOneBy({ id });

    if (!sponsor) {
      throw new NotFoundException('Sponsor not found');
    }

    return sponsor;
  }

  private getToday(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private isSponsorActiveToday(sponsor: Sponsor): boolean {
    const today = this.getToday();
    return (
      sponsor.status === SponsorStatus.ACTIVE &&
      sponsor.tenureStart <= today &&
      (!sponsor.tenureEnd || sponsor.tenureEnd >= today)
    );
  }

  private toResponse(sponsor: Sponsor): SponsorResponseDto {
    return {
      createdAt: sponsor.createdAt,
      description: sponsor.description,
      id: sponsor.id,
      logoUrl: sponsor.logoUrl,
      name: sponsor.name,
      status: sponsor.status,
      tenureEnd: sponsor.tenureEnd,
      tenureStart: sponsor.tenureStart,
      totalFans: sponsor.totalFans,
      updatedAt: sponsor.updatedAt,
      websiteUrl: sponsor.websiteUrl,
    };
  }

  private throwConflictForUniqueViolation(error: unknown): void {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    ) {
      throw new ConflictException('Sponsor name already exists');
    }
  }
}
