import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

@Injectable()
export class EventBusService {
  private readonly logger = new Logger('PointsEventBus');

  emit<T>(eventType: string, payload: T): void {
    const event = {
      eventId: randomUUID(),
      eventType,
      timestamp: new Date().toISOString(),
      producer: 'points-service' as const,
      payload,
    };
    this.logger.log(`Domain Event Emitted: ${JSON.stringify(event)}`);
  }
}
