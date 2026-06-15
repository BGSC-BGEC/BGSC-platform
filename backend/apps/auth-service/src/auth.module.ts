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
import { EmailService } from './services/email.service';

import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { GoogleAuthGuard } from './guards/google-auth.guard';

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
        url: configService.get<string>('auth.db.url'),
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
    EmailService,
    LocalStrategy,
    JwtStrategy,
    GoogleStrategy,
    GoogleAuthGuard,
    {
      provide: 'REDIS_CLIENT',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const url = configService.get<string>('auth.redis.url')!;
        return new Redis(url);
      },
    },
  ],
})
export class AuthModule {}
