import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import {
  eventConfig,
  eventConfigValidationSchema,
} from './config/event.config';
import { CreateEvents1764000000000 } from './migrations/1764000000000-CreateEvents';
import { HardenEventIntegrity1764000001000 } from './migrations/1764000001000-HardenEventIntegrity';
import { AddAttendancePointDelivery1764000002000 } from './migrations/1764000002000-AddAttendancePointDelivery';
import { EventsModule } from './events/events.module';
import { HallOfFameModule } from './hall-of-fame/hall-of-fame.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [eventConfig],
      validationSchema: eventConfigValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('event.db.url'),
        autoLoadEntities: true,
        synchronize: false,
        migrations: [
          CreateEvents1764000000000,
          HardenEventIntegrity1764000001000,
          AddAttendancePointDelivery1764000002000,
        ],
        migrationsRun: true,
      }),
    }),
    AuthModule,
    EventsModule,
    HallOfFameModule,
    HealthModule,
  ],
})
export class AppModule {}
