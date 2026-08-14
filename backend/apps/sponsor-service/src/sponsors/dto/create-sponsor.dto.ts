import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { SponsorStatus } from '../enums/sponsor-status.enum';

export class CreateSponsorDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  logoUrl?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  websiteUrl?: string;

  @IsDateString()
  tenureStart!: string;

  @IsOptional()
  @IsDateString()
  tenureEnd?: string;

  @IsOptional()
  @IsEnum(SponsorStatus)
  status?: SponsorStatus;
}
