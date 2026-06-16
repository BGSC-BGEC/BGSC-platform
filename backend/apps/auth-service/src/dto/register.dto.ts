import {
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsEmail,
  IsOptional,
  IsBoolean,
  Equals,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    description: 'Unique username',
    example: 'john_doe',
    minLength: 3,
    maxLength: 50,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username may only contain letters, numbers, and underscores',
  })
  username!: string;

  @ApiProperty({ description: 'Email address', example: 'john@example.com' })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({
    description: 'Password (min 8 chars, 1 uppercase, 1 number, 1 special)',
    example: 'P@ssw0rd!',
  })
  @IsString()
  @MinLength(8)
  @Matches(/[A-Z]/, {
    message: 'Password must contain at least 1 uppercase letter',
  })
  @Matches(/[0-9]/, { message: 'Password must contain at least 1 number' })
  @Matches(/[^A-Za-z0-9]/, {
    message: 'Password must contain at least 1 special character',
  })
  password!: string;

  @ApiPropertyOptional({
    description: 'Contact number',
    example: '+91-9876543210',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  contact?: string;

  @ApiProperty({ description: 'Must accept Terms of Service', example: true })
  @IsBoolean()
  @Equals(true, { message: 'You must accept the Terms of Service' })
  acceptedTos!: boolean;
}
