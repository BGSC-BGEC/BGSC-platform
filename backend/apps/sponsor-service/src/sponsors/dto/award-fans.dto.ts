import { IsInt, IsNotEmpty, IsString, IsUUID, Min } from 'class-validator';

export class AwardFansDto {
  @IsUUID('4')
  userId!: string;

  @IsNotEmpty()
  @IsString()
  eventId!: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsNotEmpty()
  @IsString()
  reason!: string;
}
