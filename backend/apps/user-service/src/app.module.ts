import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AddUserProfileColumns1750000000000 } from './migrations/1750000000000-AddUserProfileColumns';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url:
        process.env.DATABASE_URL ??
        'postgresql://bgsc:bgsc_pass@localhost:5432/bgsc_dev',
      autoLoadEntities: true,
      synchronize: false,
      migrations: [AddUserProfileColumns1750000000000],
      migrationsRun: true,
    }),
    AuthModule,
    UsersModule,
  ],
})
export class AppModule {}
