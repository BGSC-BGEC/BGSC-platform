import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../rbac/roles.guard';
import { PointTransaction } from './entities/point-transaction.entity';
import { EventBusService } from './event-bus.service';
import { PointsController } from './points.controller';
import { PointsService } from './points.service';

@Module({
  imports: [TypeOrmModule.forFeature([PointTransaction])],
  controllers: [PointsController],
  providers: [PointsService, RolesGuard, EventBusService],
})
export class PointsModule {}
