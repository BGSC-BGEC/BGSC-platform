export class EventHistoryItemDto {
  id!: string;
  eventId!: string;
  eventTitle!: string;
  eventCoverUrl?: string | null;
  date!: string;
  /** Phase 1 is solo-only, so always 'solo'. Team roles added in Phase 3. */
  role!: 'captain' | 'member' | 'solo';
  teamName?: string;
  result?: string;
  pointsEarned?: number;
  fansEarned?: number;
  sponsorName?: string;
}
