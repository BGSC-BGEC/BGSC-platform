import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class SendFriendRequestDto {
  @IsUUID()
  @IsNotEmpty()
  recipientId!: string;
}

export class BlockUserDto {
  @IsUUID()
  @IsNotEmpty()
  targetUserId!: string;
}
