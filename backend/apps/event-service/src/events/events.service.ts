import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { DataSource, In, Repository } from 'typeorm';
import { CompleteEventDto } from './dto/complete-event.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { EventResponseDto } from './dto/event-response.dto';
import { LeaderboardEntryDto } from './dto/leaderboard-entry.dto';
import { ListEventsQueryDto } from './dto/list-events-query.dto';
import {
  RegistrationHistoryItemDto,
  UserEventStatsDto,
} from './dto/registration-history-response.dto';
import { RegistrationResponseDto } from './dto/registration-response.dto';
import { SubmitScoresDto } from './dto/submit-scores.dto';
import { EventCompletedEvent } from './domain-events/event-completed.event';
import { RegistrationCreatedEvent } from './domain-events/registration-created.event';
import { Event } from './entities/event.entity';
import { EventScore } from './entities/event-score.entity';
import { Registration } from './entities/registration.entity';
import { EventStatus } from './enums/event-status.enum';
import { EventType } from './enums/event-type.enum';
import { RegistrationStatus } from './enums/registration-status.enum';
import { EventBusService } from './event-bus.service';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private readonly sponsorServiceUrl: string;

  constructor(
    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,
    @InjectRepository(Registration)
    private readonly registrationsRepository: Repository<Registration>,
    @InjectRepository(EventScore)
    private readonly scoresRepository: Repository<EventScore>,
    private readonly eventBus: EventBusService,
    private readonly dataSource: DataSource,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.sponsorServiceUrl =
      this.configService.get<string>('event.sponsorServiceUrl') ?? 'http://localhost:3003';
  }

  async create(dto: CreateEventDto, createdBy: string): Promise<EventResponseDto> {
    const event = this.eventsRepository.create({
      ...dto,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      registrationDeadline: new Date(dto.registrationDeadline),
      needsLeaderboard: dto.needsLeaderboard ?? false,
      tags: dto.tags ?? [],
      createdBy,
    });
    return this.toResponse(await this.eventsRepository.save(event));
  }

  async findAll(query: ListEventsQueryDto = {}): Promise<EventResponseDto[]> {
    const where = query.status ? { status: query.status } : {};
    const events = await this.eventsRepository.find({
      where,
      order: { startDate: 'ASC' },
    });
    return events.map((e) => this.toResponse(e));
  }

  async findOne(id: string): Promise<EventResponseDto> {
    return this.toResponse(await this.findEntity(id));
  }

  async register(
    eventId: string,
    userId: string,
  ): Promise<RegistrationResponseDto> {
    const saved = await this.dataSource.transaction(async (manager) => {
      const eventsRepo = manager.getRepository(Event);
      const regsRepo = manager.getRepository(Registration);

      const event = await eventsRepo.findOne({
        where: { id: eventId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!event) throw new NotFoundException('Event not found');

      if (new Date() > event.registrationDeadline) {
        throw new BadRequestException('Registration deadline has passed');
      }

      if (event.status !== EventStatus.UPCOMING && event.status !== EventStatus.ONGOING) {
        throw new BadRequestException('Event is not open for registration');
      }

      if (event.maxParticipants !== null && event.maxParticipants !== undefined) {
        const count = await regsRepo.count({
          where: { eventId, status: RegistrationStatus.CONFIRMED },
        });
        if (count >= event.maxParticipants) {
          throw new BadRequestException('Event is at full capacity');
        }
      }

      const existing = await regsRepo.findOne({
        where: { eventId, userId, status: RegistrationStatus.CONFIRMED },
      });
      if (existing) {
        throw new ConflictException('Already registered for this event');
      }

      const registration = regsRepo.create({
        eventId,
        userId,
        status: RegistrationStatus.CONFIRMED,
      });
      return regsRepo.save(registration);
    });

    const domainEvent: RegistrationCreatedEvent = {
      registrationId: saved.id,
      eventId,
      userId,
      timestamp: new Date().toISOString(),
    };
    this.eventBus.emit('RegistrationCreated', domainEvent);

    return this.toRegistrationResponse(saved);
  }

  async submitScores(
    eventId: string,
    dto: SubmitScoresDto,
    submittedBy: string,
  ): Promise<LeaderboardEntryDto[]> {
    const event = await this.findEntity(eventId);

    if (event.type !== EventType.LE) {
      throw new BadRequestException('Score submission only available for LE events');
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(EventScore, { eventId });

      const registeredUserIds = new Set(
        (
          await manager.getRepository(Registration).find({
            where: { eventId, status: RegistrationStatus.CONFIRMED },
            select: ['userId'],
          })
        ).map((r) => r.userId),
      );

      const unregistered = dto.scores
        .map((e) => e.userId)
        .filter((id) => !registeredUserIds.has(id));
      if (unregistered.length > 0) {
        throw new BadRequestException(
          `Users not registered for this event: ${unregistered.join(', ')}`,
        );
      }

      const scores = dto.scores.map((entry) =>
        manager.create(EventScore, {
          eventId,
          userId: entry.userId,
          score: entry.score,
          submittedBy,
        }),
      );
      await manager.save(EventScore, scores);
    });

    return this.buildLeaderboard(eventId);
  }

  async getLeaderboard(eventId: string): Promise<LeaderboardEntryDto[]> {
    await this.findEntity(eventId);
    return this.buildLeaderboard(eventId);
  }

  async complete(
    eventId: string,
    dto: CompleteEventDto,
    _adminId: string,
  ): Promise<EventResponseDto> {
    const event = await this.findEntity(eventId);

    if (event.status === EventStatus.PAST) {
      throw new ConflictException('Event already completed');
    }
    if (event.status === EventStatus.UPCOMING) {
      throw new BadRequestException('Event has not started yet');
    }

    event.status = EventStatus.PAST;
    await this.eventsRepository.save(event);

    const domainEvent: EventCompletedEvent = {
      eventId,
      winners: dto.winners,
      timestamp: new Date().toISOString(),
    };
    this.eventBus.emit('EventCompleted', domainEvent);

    // Award fans to winners' sponsors (fire-and-forget; failures logged, not thrown)
    void this.awardFansToWinners(eventId, dto.winners);

    return this.toResponse(event);
  }

  // ─── M1.3: User history & stats (internal service endpoints) ────────────────

  async getMyRegistrations(
    userId: string,
    page: number,
    limit: number,
  ): Promise<RegistrationHistoryItemDto[]> {
    const offset = (page - 1) * limit;
    const registrations = await this.registrationsRepository.find({
      where: { userId, status: RegistrationStatus.CONFIRMED },
      order: { registeredAt: 'DESC' },
      skip: offset,
      take: limit,
    });

    if (registrations.length === 0) return [];

    const eventIds = registrations.map((r) => r.eventId);

    // Batch fetch events and top scores — no N+1
    const events = await this.eventsRepository.findBy({ id: In(eventIds) });
    const eventMap = new Map(events.map((e) => [e.id, e]));

    // One query: top scorer per event for this user's registered events
    const topScores = await this.scoresRepository
      .createQueryBuilder('s')
      .select('s.event_id', 'eventId')
      .addSelect('s.user_id', 'userId')
      .addSelect('s.score', 'score')
      .where('s.event_id IN (:...eventIds)', { eventIds })
      .andWhere(
        's.score = (SELECT MAX(s2.score) FROM event_scores s2 WHERE s2.event_id = s.event_id)',
      )
      .getRawMany<{ eventId: string; userId: string; score: number }>();
    const topScoreMap = topScores.reduce((map, s) => {
      if (!map.has(s.eventId)) map.set(s.eventId, new Set<string>());
      map.get(s.eventId)!.add(s.userId);
      return map;
    }, new Map<string, Set<string>>());

    return registrations.flatMap((reg) => {
      const event = eventMap.get(reg.eventId);
      if (!event) return [];
      const result =
        event.needsLeaderboard && topScoreMap.get(reg.eventId)?.has(userId)
          ? '1st Place'
          : undefined;
      return [{
        id: reg.id,
        eventId: reg.eventId,
        eventTitle: event.title,
        eventCoverUrl: null,
        date: reg.registeredAt.toISOString(),
        role: 'solo',
        result,
      }];
    });
  }

  async getMyEventStats(userId: string): Promise<UserEventStatsDto> {
    const totalRegistrations = await this.registrationsRepository.count({
      where: { userId, status: RegistrationStatus.CONFIRMED },
    });

    if (totalRegistrations === 0) return { totalRegistrations, totalWins: 0 };

    const registeredEventIds = (
      await this.registrationsRepository.find({
        where: { userId, status: RegistrationStatus.CONFIRMED },
        select: ['eventId'],
      })
    ).map((r) => r.eventId);

    // One query: events where this user has the top score
    const wins = await this.scoresRepository
      .createQueryBuilder('s')
      .where('s.event_id IN (:...eventIds)', { eventIds: registeredEventIds })
      .andWhere('s.user_id = :userId', { userId })
      .andWhere(
        's.score = (SELECT MAX(s2.score) FROM event_scores s2 WHERE s2.event_id = s.event_id)',
      )
      .getCount();

    return { totalRegistrations, totalWins: wins };
  }

  async getMyRegistrationForEvent(
    eventId: string,
    userId: string,
  ): Promise<RegistrationResponseDto | null> {
    const reg = await this.registrationsRepository.findOne({
      where: { eventId, userId, status: RegistrationStatus.CONFIRMED },
    });
    return reg ? this.toRegistrationResponse(reg) : null;
  }

  async withdrawRegistration(
    eventId: string,
    registrationId: string,
    userId: string,
  ): Promise<void> {
    const reg = await this.registrationsRepository.findOne({
      where: { id: registrationId, eventId, userId },
    });
    if (!reg) throw new NotFoundException('Registration not found');
    const event = await this.findEntity(eventId);
    if (event.status === EventStatus.PAST) {
      throw new BadRequestException('Cannot withdraw from a completed event');
    }
    reg.status = RegistrationStatus.CANCELLED;
    await this.registrationsRepository.save(reg);
  }

  // ponytail: no DB table yet, returns pending immediately if user is registered
  async applyCaptain(eventId: string, userId: string): Promise<{ status: 'pending' }> {
    const reg = await this.registrationsRepository.findOne({
      where: { eventId, userId, status: RegistrationStatus.CONFIRMED },
    });
    if (!reg) throw new BadRequestException('Must be registered to apply for captain');
    return { status: 'pending' };
  }

  private async awardFansToWinners(
    eventId: string,
    winners: Array<{ userId: string; sponsorId?: string; fanAmount?: number }>,
  ): Promise<void> {
    for (const winner of winners) {
      if (!winner.sponsorId || !winner.fanAmount) continue;
      try {
        await firstValueFrom(
          this.httpService.post(
            `${this.sponsorServiceUrl}/sponsors/${winner.sponsorId}/fans`,
            { userId: winner.userId, eventId, amount: winner.fanAmount, reason: 'event_win' },
          ),
        );
      } catch (err) {
        this.logger.error(
          `Fan award failed for user ${winner.userId} sponsor ${winner.sponsorId}: ${(err as Error).message}`,
        );
      }
    }
  }

  private async buildLeaderboard(eventId: string): Promise<LeaderboardEntryDto[]> {
    const scores = await this.scoresRepository.find({
      where: { eventId },
      order: { score: 'DESC' },
    });

    return scores.map((s, index) => ({
      rank: index + 1,
      userId: s.userId,
      score: s.score,
      submittedAt: s.submittedAt,
    }));
  }

  private async findEntity(id: string): Promise<Event> {
    const event = await this.eventsRepository.findOneBy({ id });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  private toResponse(event: Event): EventResponseDto {
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      type: event.type,
      status: event.status,
      startDate: event.startDate,
      endDate: event.endDate,
      registrationDeadline: event.registrationDeadline,
      venue: event.venue,
      rulesPdfUrl: event.rulesPdfUrl,
      maxParticipants: event.maxParticipants,
      needsLeaderboard: event.needsLeaderboard,
      tags: event.tags,
      createdBy: event.createdBy,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }

  private toRegistrationResponse(r: Registration): RegistrationResponseDto {
    return {
      id: r.id,
      eventId: r.eventId,
      userId: r.userId,
      status: r.status,
      registeredAt: r.registeredAt,
    };
  }
}
