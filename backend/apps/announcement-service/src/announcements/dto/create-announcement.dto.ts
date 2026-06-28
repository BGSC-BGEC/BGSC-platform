import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { AnnouncementType } from '../enums/announcement-type.enum';

export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsEnum(AnnouncementType)
  type!: AnnouncementType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
