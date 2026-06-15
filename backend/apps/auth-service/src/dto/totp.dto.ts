import { IsString, IsNotEmpty, IsBoolean, IsOptional, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VerifyTotpSetupDto {
  @ApiProperty({ description: '6-digit TOTP code from authenticator app', example: '123456' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  token!: string;
}

export class AuthenticateTotpDto {
  @ApiProperty({ description: 'Temporary token received from login response' })
  @IsString()
  @IsNotEmpty()
  tempToken!: string;

  @ApiProperty({ description: '6-digit TOTP code or 8-character backup code', example: '123456' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 8) // Allows 6-digit TOTP or 8-character backup code
  token!: string;

  @ApiPropertyOptional({ description: 'Keep session alive for 7 days', example: true })
  @IsBoolean()
  @IsOptional()
  keepMeLoggedIn?: boolean;
}

export class DisableTotpDto {
  @ApiProperty({ description: '6-digit TOTP code to confirm disabling', example: '123456' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  token!: string;
}
