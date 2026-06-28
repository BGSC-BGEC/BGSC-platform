import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import {
  notificationConfig,
  notificationConfigValidationSchema,
} from './config/notification.config';
import { CreateNotifications1771000000000 } from './migrations/1771000000000-CreateNotifications';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [notificationConfig],
      validationSchema: notificationConfigValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('notification.db.url'),
        autoLoadEntities: true,
        synchronize: false,
        migrations: [CreateNotifications1771000000000],
        migrationsRun: true,
      }),
    }),
    AuthModule,
    NotificationsModule,
  ],
})
export class AppModule {}
