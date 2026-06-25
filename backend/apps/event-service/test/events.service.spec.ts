import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CreateEventDto } from '../src/events/dto/create-event.dto';
import { SubmitScoresDto } from '../src/events/dto/submit-scores.dto';
import { CompleteEventDto } from '../src/events/dto/complete-event.dto';
import { Event } from '../src/events/entities/event.entity';
import { EventScore } from '../src/events/entities/event-score.entity';
import { Registration } from '../src/events/entities/registration.entity';
import { EventBusService } from '../src/events/event-bus.service';
import { EventsService } from '../src/events/events.service';
import { EventStatus } from '../src/events/enums/event-status.enum';
import { EventType } from '../src/events/enums/event-type.enum';
import { RegistrationStatus } from '../src/events/enums/registration-status.enum';

type EventsRepositoryMock = Pick<
  jest.Mocked<Repository<Event>>,
  'create' | 'find' | 'findOneBy' | 'save'
>;

type RegistrationsRepositoryMock = Pick<
  jest.Mocked<Repository<Registration>>,
  'count' | 'create' | 'find' | 'findOne' | 'save'
>;

type ScoresRepositoryMock = Pick<
  jest.Mocked<Repository<EventScore>>,
  'create' | 'delete' | 'find' | 'save'
>;

type EventBusMock = Pick<jest.Mocked<EventBusService>, 'emit'>;

describe('EventsService', () => {
  let eventsRepository: EventsRepositoryMock;
  let registrationsRepository: RegistrationsRepositoryMock;
  let scoresRepository: ScoresRepositoryMock;
  let eventBus: EventBusMock;
  let dataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;
  let service: EventsService;

  beforeEach(() => {
    eventsRepository = {
      create: jest.fn(),
      find: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn(),
    };
    registrationsRepository = {
      count: jest.fn(),
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    scoresRepository = {
      create: jest.fn(),
      delete: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
    };
    eventBus = { emit: jest.fn() };
    // Simulate transaction: run the callback with a minimal manager mock
    dataSource = {
      transaction: jest.fn().mockImplementation(async (cb: (em: Partial<EntityManager>) => Promise<void>) => {
        const manager: Partial<EntityManager> = {
          delete: jest.fn().mockResolvedValue({ affected: 0, raw: [] }),
          create: jest.fn((_entity, data) => data),
          save: jest.fn().mockImplementation(async (_entity, items) => items),
        };
        await cb(manager);
      }),
    };

    service = new EventsService(
      eventsRepository as unknown as Repository<Event>,
      registrationsRepository as unknown as Repository<Registration>,
      scoresRepository as unknown as Repository<EventScore>,
      eventBus as unknown as EventBusService,
      dataSource as unknown as DataSource,
    );
  });

  describe('create', () => {
    it('creates an event with provided fields', async () => {
      const dto: CreateEventDto = {
        title: 'Airball 5v5',
        type: EventType.LE,
        startDate: '2026-09-01T10:00:00.000Z',
        endDate: '2026-09-01T18:00:00.000Z',
        registrationDeadline: '2026-08-25T23:59:59.000Z',
      };
      const event = makeEvent(dto);
      eventsRepository.create.mockReturnValue(event);
      eventsRepository.save.mockResolvedValue(event);

      await expect(service.create(dto, 'admin-uuid')).resolves.toMatchObject({
        title: dto.title,
        type: EventType.LE,
        status: EventStatus.UPCOMING,
      });
      expect(eventsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: dto.title, createdBy: 'admin-uuid' }),
      );
    });

    it('defaults needsLeaderboard to false and tags to []', async () => {
      const dto: CreateEventDto = {
        title: 'Deuce Open',
        type: EventType.DE,
        startDate: '2026-10-01T10:00:00.000Z',
        endDate: '2026-10-01T18:00:00.000Z',
        registrationDeadline: '2026-09-28T23:59:59.000Z',
      };
      const event = makeEvent({ ...dto, needsLeaderboard: false, tags: [] });
      eventsRepository.create.mockReturnValue(event);
      eventsRepository.save.mockResolvedValue(event);

      await expect(service.create(dto, 'admin-uuid')).resolves.toMatchObject({
        needsLeaderboard: false,
        tags: [],
      });
    });
  });

  describe('findAll', () => {
    it('returns all events when no filter provided', async () => {
      const events = [makeEvent(), makeEvent({ id: 'other-uuid' })];
      eventsRepository.find.mockResolvedValue(events);

      await expect(service.findAll()).resolves.toHaveLength(2);
      expect(eventsRepository.find).toHaveBeenCalledWith({
        where: {},
        order: { startDate: 'ASC' },
      });
    });

    it('filters events by status', async () => {
      eventsRepository.find.mockResolvedValue([]);

      await service.findAll({ status: EventStatus.PAST });

      expect(eventsRepository.find).toHaveBeenCalledWith({
        where: { status: EventStatus.PAST },
        order: { startDate: 'ASC' },
      });
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException for missing event', async () => {
      eventsRepository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne('missing-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns the event response dto', async () => {
      const event = makeEvent();
      eventsRepository.findOneBy.mockResolvedValue(event);

      await expect(service.findOne(event.id)).resolves.toMatchObject({
        id: event.id,
        title: event.title,
      });
    });
  });

  describe('register', () => {
    const eventId = 'event-uuid';
    const userId = 'user-uuid';

    it('registers a user and emits RegistrationCreated', async () => {
      const event = makeEvent({ maxParticipants: null });
      eventsRepository.findOneBy.mockResolvedValue(event);
      registrationsRepository.count.mockResolvedValue(0);
      registrationsRepository.findOne.mockResolvedValue(null);
      const registration = makeRegistration({ eventId, userId });
      registrationsRepository.create.mockReturnValue(registration);
      registrationsRepository.save.mockResolvedValue(registration);

      await expect(service.register(eventId, userId)).resolves.toMatchObject({
        eventId,
        userId,
        status: RegistrationStatus.CONFIRMED,
      });
      expect(eventBus.emit).toHaveBeenCalledWith(
        'RegistrationCreated',
        expect.objectContaining({ eventId, userId }),
      );
    });

    it('rejects registration past the deadline', async () => {
      const event = makeEvent({
        registrationDeadline: new Date('2020-01-01'),
      });
      eventsRepository.findOneBy.mockResolvedValue(event);

      await expect(service.register(eventId, userId)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects when event is full', async () => {
      const event = makeEvent({ maxParticipants: 2 });
      eventsRepository.findOneBy.mockResolvedValue(event);
      registrationsRepository.count.mockResolvedValue(2);

      await expect(service.register(eventId, userId)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects duplicate registration', async () => {
      const event = makeEvent({ maxParticipants: null });
      eventsRepository.findOneBy.mockResolvedValue(event);
      registrationsRepository.count.mockResolvedValue(0);
      registrationsRepository.findOne.mockResolvedValue(
        makeRegistration({ eventId, userId }),
      );

      await expect(service.register(eventId, userId)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rejects registration for a past event', async () => {
      const event = makeEvent({ status: EventStatus.PAST });
      eventsRepository.findOneBy.mockResolvedValue(event);

      await expect(service.register(eventId, userId)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('submitScores', () => {
    const eventId = 'event-uuid';
    const adminId = 'admin-uuid';
    const dto: SubmitScoresDto = {
      scores: [
        { userId: 'user-a', score: 100 },
        { userId: 'user-b', score: 80 },
      ],
    };

    it('replaces scores and returns leaderboard ranked highest first', async () => {
      const event = makeEvent({ type: EventType.LE });
      eventsRepository.findOneBy.mockResolvedValue(event);
      // Both score users are registered
      registrationsRepository.find.mockResolvedValue([
        makeRegistration({ eventId, userId: 'user-a' }),
        makeRegistration({ eventId, userId: 'user-b' }),
      ]);
      const scoreA = makeScore({ eventId, userId: 'user-a', score: 100 });
      const scoreB = makeScore({ eventId, userId: 'user-b', score: 80 });
      scoresRepository.find.mockResolvedValue([scoreA, scoreB]);

      const result = await service.submitScores(eventId, dto, adminId);

      expect(result[0].rank).toBe(1);
      expect(result[0].score).toBe(100);
      expect(result[1].rank).toBe(2);
      expect(result[1].score).toBe(80);
      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('rejects score submission for non-LE events', async () => {
      const event = makeEvent({ type: EventType.DE });
      eventsRepository.findOneBy.mockResolvedValue(event);

      await expect(
        service.submitScores(eventId, dto, adminId),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects scores for unregistered users', async () => {
      const event = makeEvent({ type: EventType.LE });
      eventsRepository.findOneBy.mockResolvedValue(event);
      // Only user-a is registered; user-b is not
      registrationsRepository.find.mockResolvedValue([
        makeRegistration({ eventId, userId: 'user-a' }),
      ]);

      await expect(
        service.submitScores(eventId, dto, adminId),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getLeaderboard', () => {
    it('returns ranked scores for an existing event', async () => {
      const event = makeEvent();
      eventsRepository.findOneBy.mockResolvedValue(event);
      const scores = [
        makeScore({ userId: 'user-a', score: 90 }),
        makeScore({ userId: 'user-b', score: 70 }),
      ];
      scoresRepository.find.mockResolvedValue(scores);

      const result = await service.getLeaderboard(event.id);

      expect(result).toHaveLength(2);
      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(2);
    });

    it('throws NotFoundException for missing event', async () => {
      eventsRepository.findOneBy.mockResolvedValue(null);

      await expect(service.getLeaderboard('missing-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('complete', () => {
    const dto: CompleteEventDto = {
      winners: [{ userId: 'user-a', sponsorId: 'sponsor-a', fanAmount: 10 }],
    };

    it('marks event as past and emits EventCompleted', async () => {
      const event = makeEvent({ status: EventStatus.ONGOING });
      eventsRepository.findOneBy.mockResolvedValue(event);
      eventsRepository.save.mockResolvedValue({ ...event, status: EventStatus.PAST });

      await expect(service.complete(event.id, dto, 'admin-uuid')).resolves.toMatchObject({
        status: EventStatus.PAST,
      });
      expect(eventBus.emit).toHaveBeenCalledWith(
        'EventCompleted',
        expect.objectContaining({
          eventId: event.id,
          winners: dto.winners,
        }),
      );
    });

    it('rejects completing an already past event', async () => {
      const event = makeEvent({ status: EventStatus.PAST });
      eventsRepository.findOneBy.mockResolvedValue(event);

      await expect(
        service.complete(event.id, dto, 'admin-uuid'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});

function makeEvent(partial: Partial<Event> = {}): Event {
  return Object.assign(new Event(), {
    id: 'event-uuid',
    title: 'Test Event',
    description: null,
    type: EventType.LE,
    status: EventStatus.UPCOMING,
    startDate: new Date('2099-09-01T10:00:00.000Z'),
    endDate: new Date('2099-09-01T18:00:00.000Z'),
    registrationDeadline: new Date('2099-08-25T23:59:59.000Z'),
    venue: null,
    rulesPdfUrl: null,
    maxParticipants: 50,
    needsLeaderboard: false,
    tags: [],
    createdBy: 'admin-uuid',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...partial,
  });
}

function makeRegistration(partial: Partial<Registration> = {}): Registration {
  return Object.assign(new Registration(), {
    id: 'registration-uuid',
    eventId: 'event-uuid',
    userId: 'user-uuid',
    status: RegistrationStatus.CONFIRMED,
    registeredAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...partial,
  });
}

function makeScore(partial: Partial<EventScore> = {}): EventScore {
  return Object.assign(new EventScore(), {
    id: 'score-uuid',
    eventId: 'event-uuid',
    userId: 'user-uuid',
    score: 100,
    submittedBy: 'admin-uuid',
    submittedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...partial,
  });
}
