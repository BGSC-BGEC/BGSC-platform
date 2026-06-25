import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class WinnerEntryDto {
  @IsUUID('4')
  userId!: string;

  @IsUUID('4')
  sponsorId!: string;

  @IsInt()
  @Min(1)
  fanAmount!: number;
}

export class CompleteEventDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WinnerEntryDto)
  winners!: WinnerEntryDto[];
}
