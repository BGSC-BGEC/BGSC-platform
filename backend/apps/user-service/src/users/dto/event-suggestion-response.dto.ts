export class EventSuggestionResponseDto {
  id!: string;
  title!: string;
  coverImageUrl?: string | null;
  startDate!: string;
  status!: string;
  registrationStatus!: string;
  category!: string;
  isTeamed!: boolean;
  userTeam?: {
    teamId: string;
    teamName: string;
    openSlots: number;
    inviteCode: string;
  } | null;
}
