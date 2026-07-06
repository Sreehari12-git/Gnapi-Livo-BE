import { Injectable } from '@nestjs/common';
import { AccessToken, DataPacket_Kind, RoomServiceClient } from 'livekit-server-sdk';
import { GenerateTokenDto } from './dto/generate-token.dto';
import { SetLiveSelectionDto } from './dto/set-live-selection.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LiveKitService {
  private readonly apiKey = process.env.LIVEKIT_API_KEY;
  private readonly apiSecret = process.env.LIVEKIT_API_SECRET;
  private readonly livekitUrl = process.env.LIVEKIT_URL;
  private readonly roomService = new RoomServiceClient(
    (process.env.LIVEKIT_URL ?? '').replace(/^ws/, 'http'),
    this.apiKey,
    this.apiSecret,
  );
  constructor(private readonly prisma: PrismaService) {}

  async generateToken(dto: GenerateTokenDto): Promise<{ token: string; url: string }> {
    const { identity, room, role } = dto;

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
          canPublishData: true, // needs data channel to send LIVE_UPDATE messages
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

    return {
      token,
      url: this.livekitUrl ?? '',
    };
  }

  async getLiveSelection(room: string) {
    const selection = await this.prisma.liveSelection.upsert({
      where: { room },
      update: {},
      create: { room },
    });

    return selection;
  }

  async setLiveSelection(dto: SetLiveSelectionDto) {
    const { room, liveCapturerIdentity, liveCommentatorIdentity } = dto;

    const selection = await this.prisma.liveSelection.upsert({
      where: { room },
      update: { liveCapturerIdentity, liveCommentatorIdentity },
      create: { room, liveCapturerIdentity, liveCommentatorIdentity },
    });

    await this.sendRoomData(room, {
      type: 'LIVE_UPDATE',
      liveCapturerIdentity: selection.liveCapturerIdentity,
      liveCommentatorIdentity: selection.liveCommentatorIdentity,
    });

    return selection;
  }

  async sendRoomData(room: string, payload: object) {
    const encoded = new TextEncoder().encode(JSON.stringify(payload));

    try {
      await this.roomService.sendData(room, encoded, DataPacket_Kind.RELIABLE);
    } catch (err) {
      if (err?.status !== 404) throw err;
      // Room doesn't exist yet (nobody has joined) — nothing to notify.
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
