import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import {
  sponsorConfig,
  sponsorConfigValidationSchema,
} from './config/sponsor.config';
import { CreateSponsorsAndAffiliations1762000000000 } from './migrations/1762000000000-CreateSponsorsAndAffiliations';
import { SponsorsModule } from './sponsors/sponsors.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [sponsorConfig],
      validationSchema: sponsorConfigValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('sponsor.db.url'),
        autoLoadEntities: true,
        synchronize: false,
        migrations: [CreateSponsorsAndAffiliations1762000000000],
        migrationsRun: true,
      }),
    }),
    AuthModule,
    SponsorsModule,
  ],
})
export class AppModule {}
