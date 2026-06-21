export class LeaderboardEntryDto {
  rank!: number;
  sponsorId!: string;
  name!: string;
  logoUrl?: string | null;
  totalFans!: number;
  eventsWonCount!: number;
  affiliatedUserCount!: number;
}
