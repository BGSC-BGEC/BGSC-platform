import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { AwardFansDto } from './dto/award-fans.dto';
import { CreateSponsorDto } from './dto/create-sponsor.dto';
import { LeaderboardEntryDto } from './dto/leaderboard-entry.dto';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';
import { ListSponsorsQueryDto } from './dto/list-sponsors-query.dto';
import { SponsorResponseDto } from './dto/sponsor-response.dto';
import { UpdateSponsorDto } from './dto/update-sponsor.dto';
import { SponsorsService } from './sponsors.service';
import { UserRole } from './enums/user-role.enum';

@ApiTags('sponsors')
@Controller('sponsors')
export class SponsorsController {
  constructor(private readonly sponsorsService: SponsorsService) {}

  @Get()
  findAll(@Query() query: ListSponsorsQueryDto): Promise<SponsorResponseDto[]> {
    return this.sponsorsService.findAll(query);
  }

  @Get('active')
  findActive(): Promise<SponsorResponseDto[]> {
    return this.sponsorsService.findActive();
  }

  @Get('leaderboard')
  getLeaderboard(
    @Query() query: LeaderboardQueryDto,
  ): Promise<LeaderboardEntryDto[]> {
    return this.sponsorsService.getLeaderboard(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<SponsorResponseDto> {
    return this.sponsorsService.findOne(id);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COORDINATOR, UserRole.FOUNDER)
  create(
    @Body() createSponsorDto: CreateSponsorDto,
  ): Promise<SponsorResponseDto> {
    return this.sponsorsService.create(createSponsorDto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COORDINATOR, UserRole.FOUNDER)
  update(
    @Param('id') id: string,
    @Body() updateSponsorDto: UpdateSponsorDto,
  ): Promise<SponsorResponseDto> {
    return this.sponsorsService.update(id, updateSponsorDto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COORDINATOR, UserRole.FOUNDER)
  remove(@Param('id') id: string): Promise<SponsorResponseDto> {
    return this.sponsorsService.remove(id);
  }

  @Patch(':id/tenure-end')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COORDINATOR, UserRole.FOUNDER)
  endTenure(
    @Param('id') id: string,
    @Body('endDate') endDate?: string,
  ): Promise<SponsorResponseDto> {
    return this.sponsorsService.endTenure(id, endDate);
  }

  @Post(':id/fans')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COORDINATOR, UserRole.FOUNDER)
  awardFans(
    @Param('id') id: string,
    @Body() awardFansDto: AwardFansDto,
  ): Promise<SponsorResponseDto> {
    return this.sponsorsService.addFans(id, awardFansDto);
  }
}
