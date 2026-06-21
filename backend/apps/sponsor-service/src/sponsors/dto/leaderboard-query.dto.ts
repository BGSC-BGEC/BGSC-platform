import { IsEnum, IsOptional } from 'class-validator';

export enum LeaderboardSortBy {
  FANS = 'fans',
  EVENTS = 'events',
  USERS = 'users',
}

export class LeaderboardQueryDto {
  @IsOptional()
  @IsEnum(LeaderboardSortBy)
  sort?: LeaderboardSortBy;
}
