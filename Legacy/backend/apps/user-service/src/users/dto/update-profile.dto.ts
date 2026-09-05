import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

const VALID_PLATFORMS = ['discord', 'instagram', 'linkedin', 'x', 'twitch', 'youtube'] as const;

export class SocialLinkInputDto {
  @IsString()
  @IsIn(VALID_PLATFORMS)
  platform!: string;

  @IsString()
  url!: string;

  @IsOptional()
  @IsString()
  handle?: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  bio?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  contact?: string;

  /** Array of interest IDs from GET /interests catalog. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  customTags?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocialLinkInputDto)
  socialLinks?: SocialLinkInputDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  newsletterSubscriptions?: string[];
}
