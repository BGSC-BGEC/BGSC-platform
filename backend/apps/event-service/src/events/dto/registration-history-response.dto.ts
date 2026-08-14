export class RegistrationHistoryItemDto {
  id!: string;
  eventId!: string;
  eventTitle!: string;
  eventCoverUrl?: string | null;
  date!: string;
  /** Phase 1 is solo-only. Team roles added in Phase 3. */
  role!: 'solo';
  result?: string;
  pointsEarned?: number;
  fansEarned?: number;
  sponsorName?: string;
}

export class UserEventStatsDto {
  totalRegistrations!: number;
  totalWins!: number;
}
