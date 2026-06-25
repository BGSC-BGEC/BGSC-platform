import { EventStatus } from '../enums/event-status.enum';
import { EventType } from '../enums/event-type.enum';

export class EventResponseDto {
  id!: string;
  title!: string;
  description?: string | null;
  type!: EventType;
  status!: EventStatus;
  startDate!: Date;
  endDate!: Date;
  registrationDeadline!: Date;
  venue?: string | null;
  rulesPdfUrl?: string | null;
  maxParticipants?: number | null;
  needsLeaderboard!: boolean;
  tags!: string[];
  createdBy!: string;
  createdAt!: Date;
  updatedAt!: Date;
}
