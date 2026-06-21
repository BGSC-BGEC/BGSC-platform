import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../rbac/roles.guard';
import { EventBusService } from './event-bus.service';
import { Sponsor } from './entities/sponsor.entity';
import { UserSponsorAffiliation } from './entities/user-sponsor-affiliation.entity';
import { SponsorsController } from './sponsors.controller';
import { SponsorsService } from './sponsors.service';

@Module({
  imports: [TypeOrmModule.forFeature([Sponsor, UserSponsorAffiliation])],
  controllers: [SponsorsController],
  providers: [SponsorsService, RolesGuard, EventBusService],
})
export class SponsorsModule {}
