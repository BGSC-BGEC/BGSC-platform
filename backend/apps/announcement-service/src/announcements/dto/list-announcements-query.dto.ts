import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AnnouncementType } from '../enums/announcement-type.enum';

export class ListAnnouncementsQueryDto {
  @IsOptional()
  @IsEnum(AnnouncementType)
  type?: AnnouncementType;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
