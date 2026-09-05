import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { UserRole } from '../rbac/user-role.enum';
import { CreateChallengeDto, UpdateChallengeDto } from './dto/challenge.dto';
import { ChallengeResponseDto, SubmissionResponseDto } from './dto/submission.dto';
import { ReviewSubmissionDto, SubmitChallengeDto } from './dto/submission.dto';
import { ChallengesService } from './challenges.service';

type AuthRequest = Request & { user: { id: string; role: UserRole } };

@ApiTags('challenges')
@Controller('challenges')
export class ChallengesController {
  constructor(private readonly challengesService: ChallengesService) {}

  @Get()
  @ApiOperation({ summary: 'Browse challenges (public)' })
  @ApiQuery({ name: 'domain', required: false })
  @ApiQuery({ name: 'difficulty', required: false, enum: ['easy', 'medium', 'hard', 'legend'] })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'completed', 'archived'] })
  findAll(
    @Query('domain') domain?: string,
    @Query('difficulty') difficulty?: string,
    @Query('status') status?: string,
  ): Promise<ChallengeResponseDto[]> {
    return this.challengesService.findAll(domain, difficulty, status);
  }

  @Get('me/accepted')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get authenticated user's accepted challenges" })
  getMyAccepted(@Req() req: AuthRequest): Promise<{ challengeId: string; acceptedAt: Date }[]> {
    return this.challengesService.getMyAccepted(req.user.id);
  }

  @Get('me/submissions')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get authenticated user's submissions" })
  getMySubmissions(@Req() req: AuthRequest): Promise<SubmissionResponseDto[]> {
    return this.challengesService.getMySubmissions(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a challenge by ID' })
  findOne(@Param('id') id: string): Promise<ChallengeResponseDto> {
    return this.challengesService.findOne(id);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORE, UserRole.COORDINATOR, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Create a challenge (core+)' })
  create(@Body() dto: CreateChallengeDto, @Req() req: AuthRequest): Promise<ChallengeResponseDto> {
    return this.challengesService.create(dto, req.user.id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORE, UserRole.COORDINATOR, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Update a challenge (core+)' })
  update(@Param('id') id: string, @Body() dto: UpdateChallengeDto): Promise<ChallengeResponseDto> {
    return this.challengesService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COORDINATOR, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Delete a challenge (coordinator+)' })
  remove(@Param('id') id: string): Promise<ChallengeResponseDto> {
    return this.challengesService.remove(id);
  }

  @Post(':id/accept')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Accept a challenge' })
  accept(
    @Param('id') id: string,
    @Req() req: AuthRequest,
  ): Promise<{ accepted: boolean; acceptanceId: string }> {
    return this.challengesService.accept(id, req.user.id);
  }

  @Post(':id/submit')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Submit proof for a challenge' })
  submit(
    @Param('id') id: string,
    @Req() req: AuthRequest,
    @Body() dto: SubmitChallengeDto,
  ): Promise<SubmissionResponseDto> {
    return this.challengesService.submit(id, req.user.id, dto);
  }

  @Get(':id/submissions')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORE, UserRole.COORDINATOR, UserRole.FOUNDER)
  @ApiOperation({ summary: 'List all submissions for a challenge (core+)' })
  getSubmissions(@Param('id') id: string): Promise<SubmissionResponseDto[]> {
    return this.challengesService.getSubmissionsForChallenge(id);
  }

  @Patch(':challengeId/submissions/:submissionId/review')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CORE, UserRole.COORDINATOR, UserRole.FOUNDER)
  @ApiOperation({ summary: 'Review a submission (approve/reject). Approving awards points.' })
  reviewSubmission(
    @Param('submissionId') submissionId: string,
    @Req() req: AuthRequest,
    @Body() dto: ReviewSubmissionDto,
  ): Promise<SubmissionResponseDto> {
    return this.challengesService.reviewSubmission(submissionId, req.user.id, dto);
  }
}
