import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { SubmissionStatus } from '../enums/challenge.enum';
import { ChallengeDifficulty, ChallengeStatus } from '../enums/challenge.enum';

export class SubmitChallengeDto {
  @IsOptional()
  @IsUrl()
  proofUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  proofText?: string;
}

export class ReviewSubmissionDto {
  status!: SubmissionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNotes?: string;
}

export class ChallengeResponseDto {
  id!: string;
  title!: string;
  description!: string;
  domain!: string;
  teamLimit!: number;
  timeLimit?: number | null;
  resourceLinks!: string[];
  awardPoints!: number;
  difficulty!: ChallengeDifficulty;
  status!: ChallengeStatus;
  createdBy!: string;
  createdAt!: Date;
  updatedAt!: Date;
}

export class SubmissionResponseDto {
  id!: string;
  challengeId!: string;
  userId!: string;
  proofUrl?: string | null;
  proofText?: string | null;
  status!: SubmissionStatus;
  reviewerId?: string | null;
  reviewNotes?: string | null;
  submittedAt!: Date;
  reviewedAt!: Date;
}
