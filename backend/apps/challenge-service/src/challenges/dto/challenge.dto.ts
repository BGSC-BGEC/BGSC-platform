import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ChallengeDifficulty, ChallengeStatus } from '../enums/challenge.enum';

export class CreateChallengeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  domain!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  teamLimit?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  timeLimit?: number;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  resourceLinks?: string[];

  @IsInt()
  @IsPositive()
  awardPoints!: number;

  @IsEnum(ChallengeDifficulty)
  difficulty!: ChallengeDifficulty;
}

export class UpdateChallengeDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  domain?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  teamLimit?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  timeLimit?: number;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  resourceLinks?: string[];

  @IsOptional()
  @IsInt()
  @IsPositive()
  awardPoints?: number;

  @IsOptional()
  @IsEnum(ChallengeDifficulty)
  difficulty?: ChallengeDifficulty;

  @IsOptional()
  @IsEnum(ChallengeStatus)
  status?: ChallengeStatus;
}
