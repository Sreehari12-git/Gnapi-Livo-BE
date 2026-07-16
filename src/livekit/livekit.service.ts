import { ForbiddenException, Injectable, OnModuleInit } from '@nestjs/common';
import { AccessToken, DataPacket_Kind, RoomServiceClient, WebhookReceiver } from 'livekit-server-sdk';
import { GenerateTokenDto } from './dto/generate-token.dto';
import { PrismaService } from '../prisma/prisma.service';
import { UsageService } from '../usage/usage.service';

@Injectable()
export class LiveKitService implements OnModuleInit {
  private readonly apiKey = process.env.LIVEKIT_API_KEY;
  private readonly apiSecret = process.env.LIVEKIT_API_SECRET;
  private readonly livekitUrl = process.env.LIVEKIT_URL;
  private readonly roomService = new RoomServiceClient(
    (process.env.LIVEKIT_URL ?? '').replace(/^ws/, 'http'),
    this.apiKey,
    this.apiSecret,
  );
  private readonly webhookReceiver = new WebhookReceiver(
    process.env.LIVEKIT_API_KEY ?? '',
    process.env.LIVEKIT_API_SECRET ?? '',
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly usageService: UsageService,
  ) {}

  onModuleInit() {
    // Check every 60 seconds whether any active room has exceeded its usage limit
    setInterval(() => this.enforceUsageLimitsForAllRooms(), 60_000);
  }

  private async enforceUsageLimitsForAllRooms() {
    // Find one active session per admin (gives us which admins have live rooms)
    const activeSessions = await this.prisma.usageSession.findMany({
      where: { endedAt: null },
      select: { adminId: true, room: true },
      distinct: ['adminId'],
    });

    for (const { adminId, room } of activeSessions) {
      const remaining = await this.usageService.getRemainingMinutes(adminId);
      if (remaining <= 0) {
        await this.enforceUsageLimitForRoom(room);
      }
    }
  }

  async enforceUsageLimitForRoom(room: string) {
    // Broadcast to all clients so they can show the error and disconnect
    await this.sendRoomData(room, { type: 'USAGE_EXCEEDED' });

    // Kick all non-broadcaster participants (capturers, commentators, viewers)
    const participants = await this.listParticipants(room);
    for (const p of participants) {
      try {
        const role = JSON.parse(p.metadata ?? '{}').role;
        if (role !== 'broadcaster') {
          await this.roomService.removeParticipant(room, p.identity);
        }
      } catch {}
    }
  }

  async receiveWebhook(rawBody: string, authHeader: string) {
    return this.webhookReceiver.receive(rawBody, authHeader);
  }

  async generateToken(dto: GenerateTokenDto): Promise<{ token: string; url: string }> {
    const { identity, room, role } = dto;

    const event = await this.prisma.eventInfo.findUnique({ where: { id: room } });
    if (event) {
      const remaining = await this.usageService.getRemainingMinutes(event.createdBy);
      if (remaining <= 0) {
        throw new ForbiddenException({
          code: 'USAGE_LIMIT_EXCEEDED',
          message: 'Usage limit exceeded. Please upgrade your plan.',
        });
      }
    }

    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity,
      ttl: '6h',
      metadata: JSON.stringify({ role }),
    });

    switch (role) {
      case 'capturer':
        at.addGrant({
          roomJoin: true,
          room,
          canPublish: true,
          canSubscribe: false,
          canPublishData: false,
        });
        break;

      case 'commentator':
        at.addGrant({
          roomJoin: true,
          room,
          canPublish: true,
          canSubscribe: false,
          canPublishData: false,
        });
        break;

      case 'broadcaster':
        at.addGrant({
          roomJoin: true,
          room,
          canPublish: false,
          canSubscribe: true,
          canPublishData: true,
        });
        break;

      case 'viewer':
        at.addGrant({
          roomJoin: true,
          room,
          canPublish: false,
          canSubscribe: true,
          canPublishData: false,
        });
        break;
    }

    const token = await at.toJwt();
    return { token, url: this.livekitUrl ?? '' };
  }

  async sendRoomData(room: string, payload: object) {
    const encoded = new TextEncoder().encode(JSON.stringify(payload));

    try {
      await this.roomService.sendData(room, encoded, DataPacket_Kind.RELIABLE);
    } catch (err) {
      if (err?.status !== 404) throw err;
    }
  }

  async listParticipants(room: string) {
    try {
      return await this.roomService.listParticipants(room);
    } catch (err) {
      if (err?.status === 404) return [];
      throw err;
    }
  }
}
