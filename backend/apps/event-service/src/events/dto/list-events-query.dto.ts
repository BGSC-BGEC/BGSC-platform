import { IsEnum, IsOptional } from 'class-validator';
import { EventStatus } from '../enums/event-status.enum';

export class ListEventsQueryDto {
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;
}
