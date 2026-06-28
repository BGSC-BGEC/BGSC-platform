export class PlayerCardResponseDto {
  id!: string;
  username!: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  role!: string;
  activeSponsorId?: string | null;
  sponsorName?: string | null;
  sponsorLogoUrl?: string | null;
  interests!: string[];
  customTags!: string[];
  totalEvents!: number;
  totalWins!: number;
  totalFans!: number;
  rating?: number | null;
}
