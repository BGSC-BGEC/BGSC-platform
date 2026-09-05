import { FriendshipStatus } from '../enums/friendship-status.enum';

export class FriendshipResponseDto {
  id!: string;
  requesterId!: string;
  recipientId!: string;
  status!: FriendshipStatus;
  createdAt!: Date;
  updatedAt!: Date;
}

export class FriendsListResponseDto {
  friends!: FriendshipResponseDto[];
  total!: number;
}
