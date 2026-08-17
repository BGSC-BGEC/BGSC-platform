import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { challengeConfig, challengeConfigValidationSchema } from './config/challenge.config';
import { CreateChallenges1781000000000 } from './migrations/1781000000000-CreateChallenges';
import { ChallengesModule } from './challenges/challenges.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [challengeConfig],
      validationSchema: challengeConfigValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('challenge.db.url'),
        autoLoadEntities: true,
        synchronize: false,
        migrations: [CreateChallenges1781000000000],
        migrationsRun: true,
      }),
    }),
    AuthModule,
    ChallengesModule,
    HealthModule,
  ],
})
export class AppModule {}
