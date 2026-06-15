import { IsString, MinLength, MaxLength, Matches, IsEmail, IsOptional, IsBoolean, Equals } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Username may only contain letters, numbers, and underscores' })
  username!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8)
  @Matches(/[A-Z]/, { message: 'Password must contain at least 1 uppercase letter' })
  @Matches(/[0-9]/, { message: 'Password must contain at least 1 number' })
  @Matches(/[^A-Za-z0-9]/, { message: 'Password must contain at least 1 special character' })
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  contact?: string;

  @IsBoolean()
  @Equals(true, { message: 'You must accept the Terms of Service' })
  acceptedTos!: boolean;
}
