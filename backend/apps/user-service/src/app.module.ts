import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { userConfig, userConfigValidationSchema } from './config/user.config';
import { UsersModule } from './users/users.module';
import { StravaModule } from './strava/strava.module';
import { AddUserProfileColumns1750000000000 } from './migrations/1750000000000-AddUserProfileColumns';
import { AddLastSponsorChange1762000001000 } from './migrations/1762000001000-AddLastSponsorChange';
import { AddBioColumn1769000000000 } from './migrations/1769000000000-AddBioColumn';
import { AddDisplayNameCustomTagsLogoUrl1770000000000 } from './migrations/1770000000000-AddDisplayNameCustomTagsLogoUrl';
import { AddStravaCredentials1780000000001 } from './migrations/1780000000001-AddStravaCredentials';
import { AddStravaActivities1780000000002 } from './migrations/1780000000002-AddStravaActivities';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [userConfig],
      validationSchema: userConfigValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('user.db.url'),
        autoLoadEntities: true,
        synchronize: false,
        migrations: [
          AddUserProfileColumns1750000000000,
          AddLastSponsorChange1762000001000,
          AddBioColumn1769000000000,
          AddDisplayNameCustomTagsLogoUrl1770000000000,
          AddStravaCredentials1780000000001,
          AddStravaActivities1780000000002,
        ],
        migrationsRun: true,
      }),
    }),
    AuthModule,
    UsersModule,
    StravaModule,
  ],
})
export class AppModule {}
