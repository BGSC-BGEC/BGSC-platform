export class PublicProfileDto {
  id!: string;
  username!: string;
  avatarUrl?: string | null;
  bio?: string | null;
  interests!: string[];
  socials!: Record<string, string>;
}
