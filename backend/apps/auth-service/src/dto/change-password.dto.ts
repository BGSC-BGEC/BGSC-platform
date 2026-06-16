import { IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiPropertyOptional({ description: 'Current password (required for local accounts, optional for Google-only)', example: 'OldP@ss1' })
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @ApiProperty({ description: 'New password (min 8 chars, 1 uppercase, 1 number, 1 special)', example: 'N3wP@ss!' })
  @IsString()
  @MinLength(8)
  @Matches(/[A-Z]/, { message: 'Password must contain at least 1 uppercase letter' })
  @Matches(/[0-9]/, { message: 'Password must contain at least 1 number' })
  @Matches(/[^A-Za-z0-9]/, { message: 'Password must contain at least 1 special character' })
  newPassword!: string;
}
