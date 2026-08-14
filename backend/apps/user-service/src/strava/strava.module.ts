import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StravaCredential } from './entities/strava-credential.entity';
import { StravaActivity } from './entities/strava-activity.entity';
import { User } from '../users/entities/user.entity';
import { StravaService } from './strava.service';
import { StravaController } from './strava.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([StravaCredential, StravaActivity, User]),
    HttpModule,
    ConfigModule,
  ],
  controllers: [StravaController],
  providers: [StravaService],
  exports: [StravaService],
})
export class StravaModule {}
