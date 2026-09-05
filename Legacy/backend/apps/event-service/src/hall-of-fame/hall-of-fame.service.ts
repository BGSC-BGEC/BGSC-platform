import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import { Event } from '../events/entities/event.entity';
import { EventScore } from '../events/entities/event-score.entity';
import { EventStatus } from '../events/enums/event-status.enum';
import { EventWinnerDto, SponsorChampionDto } from './dto/hall-of-fame-response.dto';

@Injectable()
export class HallOfFameService {
  private readonly logger = new Logger(HallOfFameService.name);
  private readonly sponsorServiceUrl: string;

  constructor(
    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,
    @InjectRepository(EventScore)
    private readonly scoresRepository: Repository<EventScore>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.sponsorServiceUrl =
      this.configService.get<string>('event.sponsorServiceUrl') ?? 'http://localhost:3003';
  }

  async getEventWinners(): Promise<EventWinnerDto[]> {
    const events = await this.eventsRepository.find({
      where: { status: EventStatus.PAST, needsLeaderboard: true },
      order: { startDate: 'DESC' },
    });

    const winners: EventWinnerDto[] = [];
    for (const event of events) {
      const top = await this.scoresRepository.findOne({
        where: { eventId: event.id },
        order: { score: 'DESC' },
      });
      if (!top) continue;
      winners.push({
        eventId: event.id,
        eventTitle: event.title,
        eventDate: event.startDate,
        userId: top.userId,
        score: top.score,
      });
    }
    return winners;
  }

  async getSponsorChampions(): Promise<SponsorChampionDto[]> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<SponsorChampionDto[]>(
          `${this.sponsorServiceUrl}/sponsors/leaderboard`,
          { params: { sort: 'fans', limit: 10 } },
        ),
      );
      return data;
    } catch (err) {
      this.logger.warn(`sponsor-service leaderboard unavailable: ${(err as Error).message}`);
      return [];
    }
  }
}
