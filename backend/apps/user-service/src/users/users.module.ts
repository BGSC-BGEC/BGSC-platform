import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sponsor } from './entities/sponsor.entity';
import { User } from './entities/user.entity';
import { UserSponsorAffiliation } from './entities/user-sponsor-affiliation.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Sponsor, UserSponsorAffiliation]),
    HttpModule,
    ConfigModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
