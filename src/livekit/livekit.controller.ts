import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { LiveKitService } from './livekit.service';
import { UsageService } from '../usage/usage.service';
import { GenerateTokenDto } from './dto/generate-token.dto';
import { SetLiveSelectionDto } from './dto/set-live-selection.dto';

@Controller('livekit')
export class LiveKitController {
  constructor(
    private readonly livekitService: LiveKitService,
    private readonly usageService: UsageService,
  ) {}

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

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Req() req: any,
    @Headers('Authorization') authHeader: string,
  ) {
    const body = req.rawBody?.toString() ?? '';
    let event: Awaited<ReturnType<typeof this.livekitService.receiveWebhook>>;
    try {
      event = await this.livekitService.receiveWebhook(body, authHeader);
    } catch {
      return { ok: false };
    }

    const room = event.room?.name ?? '';
    const identity = event.participant?.identity ?? '';
    const role = (() => {
      try {
        return JSON.parse(event.participant?.metadata ?? '{}').role ?? 'viewer';
      } catch {
        return 'viewer';
      }
    })();

    if (event.event === 'participant_joined') {
      await this.usageService.onParticipantJoined(room, identity, role);
    } else if (event.event === 'participant_left') {
      await this.usageService.onParticipantLeft(room, identity);
    }

    return { ok: true };
  }

  @Get('usage')
  async getUsage(@Query('adminId') adminId: string) {
    return this.usageService.getUsageStats(Number(adminId));
  }
}
