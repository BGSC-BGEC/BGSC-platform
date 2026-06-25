import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CompleteEventDto } from './dto/complete-event.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { EventResponseDto } from './dto/event-response.dto';
import { LeaderboardEntryDto } from './dto/leaderboard-entry.dto';
import { ListEventsQueryDto } from './dto/list-events-query.dto';
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
  constructor(
    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,
    @InjectRepository(Registration)
    private readonly registrationsRepository: Repository<Registration>,
    @InjectRepository(EventScore)
    private readonly scoresRepository: Repository<EventScore>,
    private readonly eventBus: EventBusService,
    private readonly dataSource: DataSource,
  ) {}

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
    const event = await this.findEntity(eventId);

    if (new Date() > event.registrationDeadline) {
      throw new BadRequestException('Registration deadline has passed');
    }

    if (event.status !== EventStatus.UPCOMING && event.status !== EventStatus.ONGOING) {
      throw new BadRequestException('Event is not open for registration');
    }

    if (event.maxParticipants !== null && event.maxParticipants !== undefined) {
      const count = await this.registrationsRepository.count({
        where: { eventId, status: RegistrationStatus.CONFIRMED },
      });
      if (count >= event.maxParticipants) {
        throw new BadRequestException('Event is at full capacity');
      }
    }

    const existing = await this.registrationsRepository.findOne({
      where: { eventId, userId, status: RegistrationStatus.CONFIRMED },
    });
    if (existing) {
      throw new ConflictException('Already registered for this event');
    }

    const registration = this.registrationsRepository.create({
      eventId,
      userId,
      status: RegistrationStatus.CONFIRMED,
    });
    const saved = await this.registrationsRepository.save(registration);

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
          await this.registrationsRepository.find({
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

    event.status = EventStatus.PAST;
    await this.eventsRepository.save(event);

    const domainEvent: EventCompletedEvent = {
      eventId,
      winners: dto.winners,
      timestamp: new Date().toISOString(),
    };
    this.eventBus.emit('EventCompleted', domainEvent);

    return this.toResponse(event);
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
