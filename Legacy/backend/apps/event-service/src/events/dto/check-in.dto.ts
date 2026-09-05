import { IsUUID } from 'class-validator';

export class CheckInDto {
  @IsUUID('4')
  userId!: string;
}
