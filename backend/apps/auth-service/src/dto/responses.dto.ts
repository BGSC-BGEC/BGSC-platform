import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../constants/roles.constant';

export class SuccessMessageDto {
  @ApiProperty({
    description: 'Result message describing the outcome of the operation',
    example: 'Operation completed successfully',
  })
  message!: string;
}

export class UserResponseDto {
  @ApiProperty({
    description: 'Unique user ID',
    example: '11111111-1111-4111-8111-111111111111',
  })
  id!: string;

  @ApiProperty({ description: 'Unique username', example: 'john_doe' })
  username!: string;

  @ApiProperty({
    description: 'Registered email address',
    example: 'john@example.com',
  })
  email!: string;

  @ApiProperty({
    description: 'User role',
    enum: UserRole,
    example: UserRole.USER,
  })
  role!: UserRole;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'User details' })
  user!: UserResponseDto;

  @ApiProperty({
    description:
      'JWT access token for accessing protected routes (valid for 15m)',
    example: 'eyJhbGciOiJIUzI1NiIsIn...',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'Flag indicating if the user was just registered',
    example: true,
  })
  isNewUser!: boolean;
}

export class LoginTotpRequiredResponseDto {
  @ApiProperty({
    description:
      'Flag indicating that TOTP 2FA verification is required to finish login',
    example: true,
  })
  requiresTOTP!: boolean;

  @ApiProperty({
    description:
      'Temporary token to authenticate with TOTP code (valid for 5m)',
    example: 'eyJhbGciOiJIUzI1NiIsIn...',
  })
  tempToken!: string;
}

export class RefreshResponseDto {
  @ApiProperty({
    description: 'New JWT access token (valid for 15m)',
    example: 'eyJhbGciOiJIUzI1NiIsIn...',
  })
  accessToken!: string;
}

export class TotpSetupResponseDto {
  @ApiProperty({
    description: 'TOTP secret key encoded as Base32 (use for manual entry)',
    example: 'JBSWY3DPEHPK3PXP',
  })
  secret!: string;

  @ApiProperty({
    description: 'Data URL for scanning the QR code image',
    example: 'data:image/png;base64,iVBORw0KGgoAAA...',
  })
  qrCodeUrl!: string;

  @ApiProperty({
    description: '10 bcrypt-hashed backup recovery codes (keep them safe!)',
    example: ['a1b2c3d4', 'e5f6g7h8'],
  })
  backupCodes!: string[];
}

export class TotpVerifySetupResponseDto {
  @ApiProperty({
    description: 'Indicates if TOTP is successfully enabled',
    example: true,
  })
  enabled!: boolean;
}

export class SessionResponseDto {
  @ApiProperty({
    description: 'Unique family ID of the session',
    example: '22222222-2222-4222-8222-222222222222',
  })
  familyId!: string;

  @ApiProperty({
    description: 'IP address of the client device',
    example: '127.0.0.1',
  })
  deviceIp!: string;

  @ApiProperty({
    description: 'User agent of the client device',
    example: 'Mozilla/5.0...',
  })
  deviceUserAgent!: string;

  @ApiProperty({
    description: 'Timestamp when the session was created',
    example: '2026-06-16T00:09:17.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Timestamp when the session was last used',
    example: '2026-06-16T00:09:17.000Z',
  })
  lastUsedAt!: Date;

  @ApiProperty({
    description: 'Indicates if this is the current active session',
    example: true,
  })
  isCurrent!: boolean;
}

export class LoginPendingDeletionResponseDto {
  @ApiProperty({ description: 'HTTP status code', example: 403 })
  statusCode!: number;

  @ApiProperty({
    description:
      'Error message indicating the account is scheduled for deletion',
    example: 'Account is scheduled for deletion. Log in to cancel.',
  })
  message!: string;

  @ApiProperty({
    description:
      'JWT access token used exclusively to call /account/cancel-deletion',
    example: 'eyJhbGciOiJIUzI1NiIsIn...',
  })
  accessToken!: string;
}
