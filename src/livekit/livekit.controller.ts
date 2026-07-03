import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { LiveKitService } from './livekit.service';
import { GenerateTokenDto } from './dto/generate-token.dto';
import { SetLiveSelectionDto } from './dto/set-live-selection.dto';

@Controller('livekit')
export class LiveKitController {
  constructor(private readonly livekitService: LiveKitService) {}

  @Post('token')
  async generateToken(@Body() generateTokenDto: GenerateTokenDto) {
    return this.livekitService.generateToken(generateTokenDto);
  }

  @Get('live-selection/:room')
  async getLiveSelection(@Param('room') room: string) {
    return this.livekitService.getLiveSelection(room);
  }

  @Post('live-selection')
  async setLiveSelection(@Body() setLiveSelectionDto: SetLiveSelectionDto) {
    return this.livekitService.setLiveSelection(setLiveSelectionDto);
  }

  @Get('participants/:room')
  async listParticipants(@Param('room') room: string) {
    return this.livekitService.listParticipants(room);
  }
}
