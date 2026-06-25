import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AwardPointsDto } from './dto/award-points.dto';
import { PointsBalanceResponseDto } from './dto/points-balance-response.dto';
import { TransactionResponseDto } from './dto/transaction-response.dto';
import { PointsEarnedEvent } from './domain-events/points-earned.event';
import { PointTransaction } from './entities/point-transaction.entity';
import { PointsSource } from './enums/points-source.enum';
import { TransactionType } from './enums/transaction-type.enum';
import { EventBusService } from './event-bus.service';

const PARTICIPATION_POINTS = 10;

@Injectable()
export class PointsService {
  constructor(
    @InjectRepository(PointTransaction)
    private readonly transactionsRepository: Repository<PointTransaction>,
    private readonly eventBus: EventBusService,
  ) {}

  async award(dto: AwardPointsDto): Promise<TransactionResponseDto> {
    const transaction = this.transactionsRepository.create({
      userId: dto.userId,
      amount: dto.amount,
      type: TransactionType.EARN,
      source: dto.source,
      referenceId: dto.referenceId ?? null,
    });
    const saved = await this.transactionsRepository.save(transaction);

    const domainEvent: PointsEarnedEvent = {
      transactionId: saved.id,
      userId: saved.userId,
      amount: saved.amount,
      source: saved.source,
      referenceId: saved.referenceId,
      timestamp: new Date().toISOString(),
    };
    this.eventBus.emit('PointsEarned', domainEvent);

    return this.toResponse(saved);
  }

  // ponytail: called from event-service via HTTP when RegistrationCreated fires.
  // Replace with Kafka consumer when message bus is wired.
  async awardParticipation(
    userId: string,
    eventId: string,
  ): Promise<TransactionResponseDto> {
    return this.award({
      userId,
      amount: PARTICIPATION_POINTS,
      source: PointsSource.EVENT,
      referenceId: eventId,
    });
  }

  async getBalance(userId: string): Promise<PointsBalanceResponseDto> {
    const result = await this.transactionsRepository
      .createQueryBuilder('t')
      .select(
        `COALESCE(SUM(CASE WHEN t.type IN (:...creditTypes) THEN t.amount ELSE -t.amount END), 0)`,
        'balance',
      )
      .where('t.userId = :userId', { userId })
      .setParameter('creditTypes', [TransactionType.EARN, TransactionType.REFUND])
      .getRawOne<{ balance: string }>();

    return { userId, balance: Number(result?.balance ?? 0) };
  }

  private toResponse(t: PointTransaction): TransactionResponseDto {
    return {
      id: t.id,
      userId: t.userId,
      amount: t.amount,
      type: t.type,
      source: t.source,
      referenceId: t.referenceId,
      createdAt: t.createdAt,
    };
  }
}
