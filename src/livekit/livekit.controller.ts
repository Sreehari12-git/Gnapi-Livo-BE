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
    console.log('[WEBHOOK] hit — authHeader:', !!authHeader);
    // express.raw() stores the buffer in req.body; fall back to req.rawBody
    const raw: Buffer | string | undefined = Buffer.isBuffer(req.body) ? req.body : req.rawBody;
    const body = raw?.toString() ?? '';
    console.log('[WEBHOOK] body length:', body.length);
    let event: Awaited<ReturnType<typeof this.livekitService.receiveWebhook>>;
    try {
      event = await this.livekitService.receiveWebhook(body, authHeader);
    } catch (err: any) {
      console.error('[WEBHOOK] verification failed:', err?.message);
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
      console.log("Joined");
      // If this event's admin is already over-limit, kick the new joiner immediately
      const eventInfo = await this.livekitService['prisma'].eventInfo.findUnique({ where: { id: room } });
      if (eventInfo) {
        const remaining = await this.usageService.getRemainingMinutes(eventInfo.createdBy);
        if (remaining <= 0) {
          await this.livekitService.enforceUsageLimitForRoom(room);
        }
      }
    } else if (event.event === 'participant_left') {
      await this.usageService.onParticipantLeft(room, identity);
      console.log("Left");
      // After recording the departed session, check if remaining just crossed 0
      const eventInfo = await this.livekitService['prisma'].eventInfo.findUnique({ where: { id: room } });
      if (eventInfo) {
        const remaining = await this.usageService.getRemainingMinutes(eventInfo.createdBy);
        if (remaining <= 0) {
          await this.livekitService.enforceUsageLimitForRoom(room);
        }
      }
    }

    return { ok: true };
  }

  @Get('usage')
  async getUsage(@Query('adminId') adminId: string) {
    return this.usageService.getUsageStats(Number(adminId));
  }
}
