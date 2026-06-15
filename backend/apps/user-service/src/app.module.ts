import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url:
        process.env.DATABASE_URL ??
        'postgresql://bgsc:bgsc_pass@localhost:5432/bgsc_dev',
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production',
    }),
    UsersModule,
  ],
})
export class AppModule {}
