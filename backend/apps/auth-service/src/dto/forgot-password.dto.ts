import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Registered email address',
    example: 'john@example.com',
  })
  @IsEmail()
  email!: string;
}
