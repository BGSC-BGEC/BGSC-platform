import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EventWinnerDto, SponsorChampionDto } from './dto/hall-of-fame-response.dto';
import { HallOfFameService } from './hall-of-fame.service';

@ApiTags('hall-of-fame')
@Controller('hall-of-fame')
export class HallOfFameController {
  constructor(private readonly hallOfFameService: HallOfFameService) {}

  @Get('event-winners')
  getEventWinners(): Promise<EventWinnerDto[]> {
    return this.hallOfFameService.getEventWinners();
  }

  @Get('sponsor-champions')
  getSponsorChampions(): Promise<SponsorChampionDto[]> {
    return this.hallOfFameService.getSponsorChampions();
  }
}
