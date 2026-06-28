import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { AnnouncementResponseDto } from './dto/announcement-response.dto';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { ListAnnouncementsQueryDto } from './dto/list-announcements-query.dto';
import { Announcement } from './entities/announcement.entity';

@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectRepository(Announcement)
    private readonly repo: Repository<Announcement>,
  ) {}

  async create(dto: CreateAnnouncementDto, createdBy: string): Promise<AnnouncementResponseDto> {
    // 120 days ≈ 4 months; avoids setMonth day-overflow edge cases (e.g. Jan 31 → Jul 1)
    const expiresAt = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000);

    const announcement = this.repo.create({
      ...dto,
      tags: dto.tags ?? [],
      createdBy,
      expiresAt,
    });
    return this.repo.save(announcement);
  }

  async findAll(query: ListAnnouncementsQueryDto): Promise<AnnouncementResponseDto[]> {
    const page = Math.max(1, parseInt(query.page ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10)));

    return this.repo.find({
      where: {
        ...(query.type ? { type: query.type } : {}),
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async remove(id: string): Promise<AnnouncementResponseDto> {
    const announcement = await this.repo.findOne({ where: { id } });
    if (!announcement) {
      throw new NotFoundException(`Announcement ${id} not found`);
    }
    await this.repo.delete(id);
    return announcement;
  }
}
