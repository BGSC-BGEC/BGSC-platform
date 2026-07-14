import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class WinnerEntryDto {
  @IsUUID('4')
  userId!: string;

  @IsOptional()
  @IsUUID('4')
  sponsorId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  fanAmount?: number;
}

export class CompleteEventDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WinnerEntryDto)
  winners!: WinnerEntryDto[];
}
