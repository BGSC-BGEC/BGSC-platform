import { IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Password reset token (64-char hex string from email)', example: 'a'.repeat(64) })
  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/, { message: 'Invalid reset token' })
  token!: string;

  @ApiProperty({ description: 'New password (min 8 chars, 1 uppercase, 1 number, 1 special)', example: 'N3wP@ss!' })
  @IsString()
  @MinLength(8)
  @Matches(/[A-Z]/, { message: 'Password must contain at least 1 uppercase letter' })
  @Matches(/[0-9]/, { message: 'Password must contain at least 1 number' })
  @Matches(/[^A-Za-z0-9]/, { message: 'Password must contain at least 1 special character' })
  newPassword!: string;
}
