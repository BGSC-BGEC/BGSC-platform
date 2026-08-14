import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '../events/entities/event.entity';
import { EventScore } from '../events/entities/event-score.entity';
import { HallOfFameController } from './hall-of-fame.controller';
import { HallOfFameService } from './hall-of-fame.service';

@Module({
  imports: [TypeOrmModule.forFeature([Event, EventScore]), HttpModule],
  controllers: [HallOfFameController],
  providers: [HallOfFameService],
})
export class HallOfFameModule {}
