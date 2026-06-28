import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnnouncementsModule } from './announcements/announcements.module';
import { AuthModule } from './auth/auth.module';
import {
  announcementConfig,
  announcementConfigValidationSchema,
} from './config/announcement.config';
import { CreateAnnouncements1772000000000 } from './migrations/1772000000000-CreateAnnouncements';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [announcementConfig],
      validationSchema: announcementConfigValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('announcement.db.url'),
        autoLoadEntities: true,
        synchronize: false,
        migrations: [CreateAnnouncements1772000000000],
        migrationsRun: true,
      }),
    }),
    AuthModule,
    AnnouncementsModule,
  ],
})
export class AppModule {}
