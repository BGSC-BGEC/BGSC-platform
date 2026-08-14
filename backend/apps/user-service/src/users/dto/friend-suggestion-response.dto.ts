export class FriendSuggestionResponseDto {
  userId!: string;
  username!: string;
  displayName?: string;
  avatarUrl?: string | null;
  mutualCount!: number;
}
