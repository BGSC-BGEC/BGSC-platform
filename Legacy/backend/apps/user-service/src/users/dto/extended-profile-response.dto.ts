export class ProfileInterestDto {
  id!: string;
  label!: string;
  domain!: string;
}

export class SocialLinkDto {
  platform!: string;
  url!: string;
  handle?: string;
}

export class ExtendedProfileResponseDto {
  id!: string;
  username!: string;
  email!: string;
  displayName?: string | null;
  contact?: string | null;
  role!: string;
  avatarUrl?: string | null;
  bio?: string | null;
  interests!: ProfileInterestDto[];
  customTags!: string[];
  /** Tags applied by friends — Phase 2, always [] for now. */
  friendTags!: string[];
  socialLinks!: SocialLinkDto[];
  newsletterSubscriptions!: string[];
  activeSponsorId?: string | null;
  pointsBalance!: number;
  /** Computed from event-service registrations. */
  totalEvents!: number;
  /** Computed from event-service scores. */
  totalWins!: number;
  /** Sum of fan_count from active sponsor affiliation. */
  totalFans!: number;
  /** Server-computed aggregate — null until rating system is built. */
  rating?: number | null;
  createdAt!: Date;
}
