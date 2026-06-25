import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../rbac/roles.guard';
import { Event } from './entities/event.entity';
import { EventScore } from './entities/event-score.entity';
import { Registration } from './entities/registration.entity';
import { EventBusService } from './event-bus.service';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [TypeOrmModule.forFeature([Event, Registration, EventScore])],
  controllers: [EventsController],
  providers: [EventsService, RolesGuard, EventBusService],
})
export class EventsModule {}
