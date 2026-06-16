import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import Redis from 'ioredis';

import { authConfig, authConfigValidationSchema } from './config/auth.config';
import { UserCredential } from './entities/user-credential.entity';
import { LoginAuditLog } from './entities/login-audit-log.entity';

import { AuthController } from './controllers/auth.controller';
import { AccountController } from './controllers/account.controller';
import { SessionController } from './controllers/session.controller';

import { AuthService } from './services/auth.service';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import { SessionService } from './services/session.service';
import { EventBusService } from './services/event-bus.service';
import { EmailService } from './services/email.service';
import { AccountService } from './services/account.service';
import { AccountDeletionJob } from './services/account-deletion.job';
import { TotpService } from './services/totp.service';

import { TotpController } from './controllers/totp.controller';

import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { RolesGuard } from './guards/roles.guard';

import { AddTotpAndAccountLifecycleAndAuditLog1718520000000 } from './migrations/1718520000000-AddTotpAndAccountLifecycleAndAuditLog';

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
        synchronize: false,
        migrations: [AddTotpAndAccountLifecycleAndAuditLog1718520000000],
        migrationsRun: true,
      }),
    }),
    TypeOrmModule.forFeature([UserCredential, LoginAuditLog]),
    JwtModule.register({}),
  ],
  controllers: [
    AuthController,
    TotpController,
    AccountController,
    SessionController,
  ],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    SessionService,
    EventBusService,
    EmailService,
    TotpService,
    LocalStrategy,
    JwtStrategy,
    GoogleStrategy,
    GoogleAuthGuard,
    AccountService,
    AccountDeletionJob,
    RolesGuard,
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
