import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class ResendRegistrationCodeDto {
  @ApiProperty({ description: 'Opaque token returned by registration' })
  @IsString()
  @Length(64, 64)
  @Matches(/^[a-f0-9]+$/)
  verificationToken!: string;
}

export class VerifyRegistrationDto extends ResendRegistrationCodeDto {
  @ApiProperty({ description: '6-digit code sent to the registration email' })
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}
