import { IsArray, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AnnouncementType } from '../enums/announcement-type.enum';

export class UpdateAnnouncementDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsEnum(AnnouncementType)
  type?: AnnouncementType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
