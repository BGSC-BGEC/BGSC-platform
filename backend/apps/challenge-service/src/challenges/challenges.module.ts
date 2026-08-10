import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../rbac/roles.guard';
import { ChallengeAcceptance } from './entities/challenge-acceptance.entity';
import { ChallengeSubmission } from './entities/challenge-submission.entity';
import { Challenge } from './entities/challenge.entity';
import { ChallengesController } from './challenges.controller';
import { ChallengesService } from './challenges.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Challenge, ChallengeAcceptance, ChallengeSubmission]),
    HttpModule,
  ],
  controllers: [ChallengesController],
  providers: [ChallengesService, RolesGuard],
})
export class ChallengesModule {}
