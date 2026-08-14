import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { socialConfig, socialConfigValidationSchema } from './config/social.config';
import { CreateSocialEntities1780000000000 } from './migrations/1780000000000-CreateSocialEntities';
import { SocialModule } from './social/social.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [socialConfig],
      validationSchema: socialConfigValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('social.db.url'),
        autoLoadEntities: true,
        synchronize: false,
        migrations: [CreateSocialEntities1780000000000],
        migrationsRun: true,
      }),
    }),
    AuthModule,
    SocialModule,
  ],
})
export class AppModule {}
