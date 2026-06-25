import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RegisterEventDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  gameName?: string;
}
