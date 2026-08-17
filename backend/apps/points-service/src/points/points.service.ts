import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
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
    if (!Number.isInteger(dto.amount) || dto.amount <= 0) {
      throw new BadRequestException('Amount must be a positive integer');
    }

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

  async awardAttendance(
    registrationId: string,
    userId: string,
    eventId: string,
  ): Promise<TransactionResponseDto> {
    const existing = await this.transactionsRepository.findOne({
      where: { idempotencyKey: registrationId },
    });
    if (existing) return this.toResponse(existing);

    try {
      const transaction = this.transactionsRepository.create({
        userId,
        amount: PARTICIPATION_POINTS,
        type: TransactionType.EARN,
        source: PointsSource.EVENT,
        referenceId: eventId,
        idempotencyKey: registrationId,
      });
      const saved = await this.transactionsRepository.save(transaction);

      this.eventBus.emit('PointsEarned', {
        transactionId: saved.id,
        userId: saved.userId,
        amount: saved.amount,
        source: saved.source,
        referenceId: saved.referenceId,
        timestamp: new Date().toISOString(),
      } satisfies PointsEarnedEvent);
      return this.toResponse(saved);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      ) {
        const raced = await this.transactionsRepository.findOne({
          where: { idempotencyKey: registrationId },
        });
        if (raced) return this.toResponse(raced);
      }
      throw error;
    }
  }

  async getBalance(userId: string): Promise<PointsBalanceResponseDto> {
    const result = await this.transactionsRepository
      .createQueryBuilder('t')
      .select(
        `COALESCE(SUM(CASE WHEN t.type IN (:...creditTypes) THEN t.amount ELSE -t.amount END), 0)`,
        'balance',
      )
      .where('t.userId = :userId', { userId })
      .setParameter('creditTypes', [
        TransactionType.EARN,
        TransactionType.REFUND,
      ])
      .getRawOne<{ balance: string }>();

    return { userId, balance: Number(result?.balance ?? 0) };
  }

  async getMyTransactions(
    userId: string,
    page: number,
    limit: number,
    source?: string,
    type?: string,
  ): Promise<TransactionResponseDto[]> {
    const transactions = await this.transactionsRepository.find({
      where: {
        userId,
        ...(source ? { source: source as PointsSource } : {}),
        ...(type ? { type: type as TransactionType } : {}),
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return transactions.map((t) => this.toResponse(t));
  }

  async getTransactionsForUser(
    userId: string,
    page: number,
    limit: number,
    source?: string,
    type?: string,
  ): Promise<TransactionResponseDto[]> {
    return this.getMyTransactions(userId, page, limit, source, type);
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
