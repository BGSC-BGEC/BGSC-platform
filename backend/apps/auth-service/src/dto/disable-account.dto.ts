import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DisableAccountDto {
  @ApiPropertyOptional({
    description: 'Target user ID. If provided, requires coordinator/founder role.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;
}
