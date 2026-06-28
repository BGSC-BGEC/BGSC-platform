export class SponsorStatsResponseDto {
  sponsorId!: string;
  sponsorName!: string;
  sponsorLogoUrl?: string | null;
  /** User's rank among all affiliates of this sponsor (by fan count). */
  rank!: number;
  /** Total number of users affiliated with this sponsor. */
  totalAffiliates!: number;
  /** Total fans this user has contributed to this sponsor. */
  fansContributed!: number;
  /** Number of events won while affiliated with this sponsor. */
  eventsWon!: number;
}
