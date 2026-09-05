import { IsUUID } from 'class-validator';

export class SelectSponsorDto {
  @IsUUID('4')
  sponsorId!: string;
}
