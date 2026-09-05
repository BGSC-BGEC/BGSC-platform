import { IsEnum, IsOptional } from 'class-validator';
import { SponsorStatus } from '../enums/sponsor-status.enum';

export class ListSponsorsQueryDto {
  @IsOptional()
  @IsEnum(SponsorStatus)
  status?: SponsorStatus;
}
