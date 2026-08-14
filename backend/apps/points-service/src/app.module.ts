import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { pointsConfig, pointsConfigValidationSchema } from './config/points.config';
import { CreatePointTransactions1765000000000 } from './migrations/1765000000000-CreatePointTransactions';
import { PointsModule } from './points/points.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [pointsConfig],
      validationSchema: pointsConfigValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('points.db.url'),
        autoLoadEntities: true,
        synchronize: false,
        migrations: [CreatePointTransactions1765000000000],
        migrationsRun: true,
      }),
    }),
    AuthModule,
    PointsModule,
  ],
})
export class AppModule {}
