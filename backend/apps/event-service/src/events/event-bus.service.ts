import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

@Injectable()
export class EventBusService {
  private readonly logger = new Logger('EventEventBus');

  emit<T>(eventType: string, payload: T): void {
    const event = {
      eventId: randomUUID(),
      eventType,
      timestamp: new Date().toISOString(),
      producer: 'event-service' as const,
      payload,
    };
    this.logger.log(`Domain Event Emitted: ${JSON.stringify(event)}`);
  }
}
