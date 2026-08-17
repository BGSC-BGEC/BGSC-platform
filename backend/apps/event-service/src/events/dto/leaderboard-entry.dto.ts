export class LeaderboardEntryDto {
  rank!: number;
  userId!: string;
  displayName?: string;
  avatarUrl?: string;
  score!: number;
  submittedAt!: Date;
}
