import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateSponsorDto } from './dto/create-sponsor.dto';
import { ListSponsorsQueryDto } from './dto/list-sponsors-query.dto';
import { SponsorResponseDto } from './dto/sponsor-response.dto';
import { UpdateSponsorDto } from './dto/update-sponsor.dto';
import { Sponsor } from './entities/sponsor.entity';
import { UserSponsorAffiliation } from './entities/user-sponsor-affiliation.entity';
import { SponsorStatus } from './enums/sponsor-status.enum';

@Injectable()
export class SponsorsService {
  constructor(
    @InjectRepository(Sponsor)
    private readonly sponsorsRepository: Repository<Sponsor>,
    @InjectRepository(UserSponsorAffiliation)
    private readonly affiliationsRepository: Repository<UserSponsorAffiliation>,
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
