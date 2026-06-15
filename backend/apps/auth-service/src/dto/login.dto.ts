import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ description: 'Username or email address', example: 'john_doe' })
  @IsString()
  @IsNotEmpty()
  usernameOrEmail!: string;

  @ApiProperty({ description: 'Password', example: 'P@ssw0rd!' })
  @IsString()
  @IsNotEmpty()
  password!: string;

  @ApiPropertyOptional({ description: 'Keep session alive for 7 days', example: true })
  @IsOptional()
  @IsBoolean()
  keepMeLoggedIn?: boolean;
}
