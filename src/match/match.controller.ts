import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { MatchService } from './match.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { SetMatchLiveSelectionDto } from './dto/set-match-live-selection.dto';

@Controller('matches')
export class MatchController {
  constructor(private readonly matchService: MatchService) {}

  @Post()
  async createMatch(@Body() dto: CreateMatchDto) {
    return this.matchService.createMatch(dto);
  }

  @Get('event/:eventId')
  async listForViewer(@Param('eventId') eventId: string) {
    return this.matchService.listMatchesForEvent(eventId, true);
  }

  @Get('event/:eventId/all')
  async listAll(@Param('eventId') eventId: string) {
    return this.matchService.listMatchesForEvent(eventId, false);
  }

  @Get(':id')
  async getMatch(@Param('id') id: string) {
    return this.matchService.getMatch(id);
  }

  @Patch(':id')
  async updateMatch(@Param('id') id: string, @Body() dto: UpdateMatchDto) {
    return this.matchService.updateMatch(id, dto);
  }

  @Delete(':id')
  async deleteMatch(@Param('id') id: string) {
    return this.matchService.deleteMatch(id);
  }

  @Post(':id/live-selection')
  async setLiveSelection(
    @Param('id') id: string,
    @Body() dto: SetMatchLiveSelectionDto,
  ) {
    return this.matchService.setLiveSelection(id, dto);
  }

  @Post(':id/youtube/stop')
  async stopYoutube(@Param('id') id: string) {
    return this.matchService.stopYoutubeStream(id);
  }
}
