import { IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { PointsSource } from '../enums/points-source.enum';

export class AwardPointsDto {
  @IsUUID('4')
  userId!: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsEnum(PointsSource)
  source!: PointsSource;

  @IsOptional()
  @IsUUID('4')
  referenceId?: string;
}

export class AwardParticipationDto {
  @IsUUID('4')
  userId!: string;

  @IsUUID('4')
  eventId!: string;
}
