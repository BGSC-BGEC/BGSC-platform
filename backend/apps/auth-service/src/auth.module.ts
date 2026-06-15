import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import Redis from 'ioredis';

import { authConfig, authConfigValidationSchema } from './config/auth.config';
import { UserCredential } from './entities/user-credential.entity';
import { LoginAuditLog } from './entities/login-audit-log.entity';

import { AuthController } from './controllers/auth.controller';

import { AuthService } from './services/auth.service';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import { SessionService } from './services/session.service';
import { EventBusService } from './services/event-bus.service';

import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [authConfig],
      validationSchema: authConfigValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('auth.db.host'),
        port: configService.get<number>('auth.db.port'),
        username: configService.get<string>('auth.db.user'),
        password: configService.get<string>('auth.db.password'),
        database: configService.get<string>('auth.db.name'),
        entities: [UserCredential, LoginAuditLog],
        synchronize: configService.get<string>('auth.env') !== 'production',
      }),
    }),
    TypeOrmModule.forFeature([UserCredential, LoginAuditLog]),
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    SessionService,
    EventBusService,
    LocalStrategy,
    JwtStrategy,
    {
      provide: 'REDIS_CLIENT',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>('auth.redis.host')!;
        const port = configService.get<number>('auth.redis.port')!;
        const password = configService.get<string>('auth.redis.password');
        return new Redis({
          host,
          port,
          password: password || undefined,
        });
      },
    },
  ],
})
export class AuthModule {}
