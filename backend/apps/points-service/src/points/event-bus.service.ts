import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class EventBusService {
  private readonly logger = new Logger('PointsEventBus');
  private readonly userServiceUrl: string;
  private readonly internalServiceKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.userServiceUrl =
      this.configService.get<string>('points.userServiceUrl') ??
      'http://localhost:3002';
    this.internalServiceKey =
      this.configService.get<string>('points.internalServiceKey') ?? '';
  }

  emit<T>(eventType: string, payload: T): void {
    const event = {
      eventId: randomUUID(),
      eventType,
      timestamp: new Date().toISOString(),
      producer: 'points-service' as const,
      payload,
    };
    this.logger.log(`Domain Event Emitted: ${JSON.stringify(event)}`);

    if (eventType === 'PointsEarned') {
      void this.syncUserBalance(payload as { userId: string; amount: number });
    }
  }

  private async syncUserBalance(payload: { userId: string; amount: number }): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.userServiceUrl}/users/${payload.userId}/sync-points`,
          { amount: payload.amount },
          {
            headers: { 'x-internal-key': this.internalServiceKey },
            timeout: 3000,
          },
        ),
      );
    } catch (error) {
      this.logger.error(`Failed to sync balance for user ${payload.userId}: ${error}`);
    }
  }
}
