import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { CreateChallengeDto, UpdateChallengeDto } from './dto/challenge.dto';
import { ReviewSubmissionDto, SubmitChallengeDto } from './dto/submission.dto';
import { ChallengeResponseDto, SubmissionResponseDto } from './dto/submission.dto';
import { ChallengeAcceptance } from './entities/challenge-acceptance.entity';
import { ChallengeSubmission } from './entities/challenge-submission.entity';
import { Challenge } from './entities/challenge.entity';
import { ChallengeStatus, SubmissionStatus } from './enums/challenge.enum';

@Injectable()
export class ChallengesService {
  private readonly logger = new Logger(ChallengesService.name);
  private readonly pointsServiceUrl: string;

  constructor(
    @InjectRepository(Challenge)
    private readonly challengeRepo: Repository<Challenge>,
    @InjectRepository(ChallengeAcceptance)
    private readonly acceptanceRepo: Repository<ChallengeAcceptance>,
    @InjectRepository(ChallengeSubmission)
    private readonly submissionRepo: Repository<ChallengeSubmission>,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.pointsServiceUrl =
      this.configService.get<string>('challenge.pointsServiceUrl') ?? 'http://localhost:3005';
  }

  async create(dto: CreateChallengeDto, createdBy: string): Promise<ChallengeResponseDto> {
    const challenge = this.challengeRepo.create({
      ...dto,
      teamLimit: dto.teamLimit ?? 1,
      resourceLinks: dto.resourceLinks ?? [],
      createdBy,
      status: ChallengeStatus.ACTIVE,
    });
    const saved = await this.challengeRepo.save(challenge);
    return this.toResponse(saved);
  }

  async findAll(domain?: string, difficulty?: string, status?: string): Promise<ChallengeResponseDto[]> {
    const where: Record<string, string> = { status: status ?? ChallengeStatus.ACTIVE };
    if (domain) where['domain'] = domain;
    if (difficulty) where['difficulty'] = difficulty;

    const rows = await this.challengeRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
    return rows.map((c) => this.toResponse(c));
  }

  async findOne(id: string): Promise<ChallengeResponseDto> {
    const challenge = await this.challengeRepo.findOne({ where: { id } });
    if (!challenge) throw new NotFoundException(`Challenge ${id} not found`);
    return this.toResponse(challenge);
  }

  async update(id: string, dto: UpdateChallengeDto): Promise<ChallengeResponseDto> {
    const challenge = await this.challengeRepo.findOne({ where: { id } });
    if (!challenge) throw new NotFoundException(`Challenge ${id} not found`);
    Object.assign(challenge, dto);
    const saved = await this.challengeRepo.save(challenge);
    return this.toResponse(saved);
  }

  async remove(id: string): Promise<ChallengeResponseDto> {
    const challenge = await this.challengeRepo.findOne({ where: { id } });
    if (!challenge) throw new NotFoundException(`Challenge ${id} not found`);
    await this.challengeRepo.delete(id);
    return this.toResponse(challenge);
  }

  async accept(challengeId: string, userId: string): Promise<{ accepted: boolean; acceptanceId: string }> {
    const challenge = await this.challengeRepo.findOne({ where: { id: challengeId } });
    if (!challenge) throw new NotFoundException(`Challenge ${challengeId} not found`);
    if (challenge.status !== ChallengeStatus.ACTIVE) {
      throw new BadRequestException('Challenge is not active');
    }

    const existing = await this.acceptanceRepo.findOne({ where: { challengeId, userId } });
    if (existing) throw new ConflictException('Already accepted this challenge');

    const acceptance = this.acceptanceRepo.create({ challengeId, userId });
    const saved = await this.acceptanceRepo.save(acceptance);
    return { accepted: true, acceptanceId: saved.id };
  }

  async submit(challengeId: string, userId: string, dto: SubmitChallengeDto): Promise<SubmissionResponseDto> {
    const challenge = await this.challengeRepo.findOne({ where: { id: challengeId } });
    if (!challenge) throw new NotFoundException(`Challenge ${challengeId} not found`);

    const acceptance = await this.acceptanceRepo.findOne({ where: { challengeId, userId } });
    if (!acceptance) throw new ForbiddenException('Must accept the challenge before submitting');

    const existing = await this.submissionRepo.findOne({
      where: { challengeId, userId, status: SubmissionStatus.PENDING },
    });
    if (existing) throw new ConflictException('Pending submission already exists');

    const submission = this.submissionRepo.create({
      challengeId,
      userId,
      proofUrl: dto.proofUrl ?? null,
      proofText: dto.proofText ?? null,
      status: SubmissionStatus.PENDING,
    });
    const saved = await this.submissionRepo.save(submission);
    return this.toSubmissionResponse(saved);
  }

  async reviewSubmission(
    submissionId: string,
    reviewerId: string,
    dto: ReviewSubmissionDto,
  ): Promise<SubmissionResponseDto> {
    const submission = await this.submissionRepo.findOne({ where: { id: submissionId } });
    if (!submission) throw new NotFoundException(`Submission ${submissionId} not found`);
    if (submission.status !== SubmissionStatus.PENDING) {
      throw new BadRequestException('Submission already reviewed');
    }

    submission.status = dto.status;
    submission.reviewerId = reviewerId;
    submission.reviewNotes = dto.reviewNotes ?? null;
    const saved = await this.submissionRepo.save(submission);

    if (dto.status === SubmissionStatus.APPROVED) {
      const challenge = await this.challengeRepo.findOne({ where: { id: submission.challengeId } });
      if (challenge) {
        void this.awardPoints(submission.userId, challenge.id, challenge.awardPoints);
      }
    }

    return this.toSubmissionResponse(saved);
  }

  async getSubmissionsForChallenge(challengeId: string): Promise<SubmissionResponseDto[]> {
    const rows = await this.submissionRepo.find({
      where: { challengeId },
      order: { submittedAt: 'DESC' },
    });
    return rows.map((s) => this.toSubmissionResponse(s));
  }

  async getMyAccepted(userId: string): Promise<{ challengeId: string; acceptedAt: Date }[]> {
    const rows = await this.acceptanceRepo.find({
      where: { userId },
      order: { acceptedAt: 'DESC' },
    });
    return rows.map((a) => ({ challengeId: a.challengeId, acceptedAt: a.acceptedAt }));
  }

  async getMySubmissions(userId: string): Promise<SubmissionResponseDto[]> {
    const rows = await this.submissionRepo.find({
      where: { userId },
      order: { submittedAt: 'DESC' },
    });
    return rows.map((s) => this.toSubmissionResponse(s));
  }

  private async awardPoints(userId: string, challengeId: string, amount: number): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.post(`${this.pointsServiceUrl}/points/award`, {
          userId,
          amount,
          source: 'challenge',
          referenceId: challengeId,
        }),
      );
    } catch (err) {
      this.logger.error(
        `Points award failed for user ${userId} challenge ${challengeId}: ${(err as Error).message}`,
      );
    }
  }

  private toResponse(c: Challenge): ChallengeResponseDto {
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      domain: c.domain,
      teamLimit: c.teamLimit,
      timeLimit: c.timeLimit,
      resourceLinks: c.resourceLinks,
      awardPoints: c.awardPoints,
      difficulty: c.difficulty,
      status: c.status,
      createdBy: c.createdBy,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  private toSubmissionResponse(s: ChallengeSubmission): SubmissionResponseDto {
    return {
      id: s.id,
      challengeId: s.challengeId,
      userId: s.userId,
      proofUrl: s.proofUrl,
      proofText: s.proofText,
      status: s.status,
      reviewerId: s.reviewerId,
      reviewNotes: s.reviewNotes,
      submittedAt: s.submittedAt,
      reviewedAt: s.reviewedAt,
    };
  }
}
