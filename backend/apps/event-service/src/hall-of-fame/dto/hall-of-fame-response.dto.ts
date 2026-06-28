export class EventWinnerDto {
  eventId!: string;
  eventTitle!: string;
  eventDate!: Date;
  userId!: string;
  score!: number;
}

export class SponsorChampionDto {
  rank!: number;
  sponsorId!: string;
  name!: string;
  logoUrl?: string | null;
  totalFans!: number;
  eventsWonCount!: number;
  affiliatedUserCount!: number;
}
