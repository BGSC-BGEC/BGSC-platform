import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { userConfig, userConfigValidationSchema } from './config/user.config';
import { UsersModule } from './users/users.module';
import { AddUserProfileColumns1750000000000 } from './migrations/1750000000000-AddUserProfileColumns';
import { AddLastSponsorChange1762000001000 } from './migrations/1762000001000-AddLastSponsorChange';
import { AddBioColumn1769000000000 } from './migrations/1769000000000-AddBioColumn';

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
        ],
        migrationsRun: true,
      }),
    }),
    AuthModule,
    UsersModule,
  ],
})
export class AppModule {}
