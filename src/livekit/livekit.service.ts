import { ForbiddenException, Injectable, OnModuleInit } from '@nestjs/common';
import {
  AccessToken,
  DataPacket_Kind,
  EgressClient,
  StreamOutput,
  StreamProtocol,
  EncodedFileOutput,
  RoomServiceClient,
  WebhookReceiver,
} from 'livekit-server-sdk';
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
  private readonly egressClient = new EgressClient(
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

  async generateToken(
    dto: GenerateTokenDto,
  ): Promise<{ token: string; url: string }> {
    const { identity, room, role } = dto;

    const event = await this.prisma.eventInfo.findUnique({
      where: { id: room },
    });
    if (event) {
      const remaining = await this.usageService.getRemainingMinutes(
        event.createdBy,
      );
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

  async startParticipantRecording(
    room: string,
    identity: string,
    matchId: string,
  ): Promise<{ egressId: string; recordingUrl: string }> {
    const filename = `${matchId}-${identity}-${Date.now()}.mp4`;
    const output = new EncodedFileOutput({
      filepath: filename,
      output: {
        case: 's3',
        value: {
          accessKey: process.env.SUPABASE_S3_ACCESS_KEY ?? '',
          secret: process.env.SUPABASE_S3_SECRET_KEY ?? '',
          region: process.env.SUPABASE_S3_REGION ?? '',
          bucket: process.env.SUPABASE_S3_BUCKET ?? '',
          endpoint: process.env.SUPABASE_S3_ENDPOINT ?? '',
          forcePathStyle: true,
        },
      },
    });

    const info = await this.egressClient.startParticipantEgress(
      room,
      identity,
      { file: output },
    );
    const recordingUrl = `${process.env.SUPABASE_S3_ENDPOINT}/${process.env.SUPABASE_S3_BUCKET}/${filename}`;
    return { egressId: info.egressId, recordingUrl };
  }

  async stopRecording(egressId: string): Promise<void> {
    try {
      await this.egressClient.stopEgress(egressId);
    } catch {}
  }

  async startYoutubeEgress(
    room: string,
    rtmpUrl: string,
    capturerIdentity?: string,
    commentatorIdentity?: string,
  ): Promise<string> {
    let videoTrackId: string | undefined;
    let audioTrackId: string | undefined;

    console.log(`[YT EGRESS] Starting for room: ${room}, rtmp: ${rtmpUrl}, cap: ${capturerIdentity}, com: ${commentatorIdentity}`);

    try {
      const participants = await this.listParticipants(room);

      if (capturerIdentity) {
        const capturer = participants.find((p) => p.identity === capturerIdentity);
        if (capturer) {
          console.log(`[YT EGRESS] Found capturer: ${capturer.identity} with ${capturer.tracks?.length} tracks`);
          const videoTrack = capturer.tracks?.find((t) => t.type === 1 || t.type === 'VIDEO' as any);
          if (videoTrack) videoTrackId = videoTrack.sid;
          const audioTrack = capturer.tracks?.find((t) => t.type === 0 || t.type === 'AUDIO' as any);
          if (audioTrack) audioTrackId = audioTrack.sid;
        } else {
          console.log(`[YT EGRESS] Capturer ${capturerIdentity} NOT found in room`);
        }
      }

      if (commentatorIdentity) {
        const commentator = participants.find((p) => p.identity === commentatorIdentity);
        if (commentator) {
          console.log(`[YT EGRESS] Found commentator: ${commentator.identity} with ${commentator.tracks?.length} tracks`);
          const audioTrack = commentator.tracks?.find((t) => t.type === 0 || t.type === 'AUDIO' as any);
          if (audioTrack) audioTrackId = audioTrack.sid;
        }
      }

      console.log(`[YT EGRESS] videoTrackId: ${videoTrackId}, audioTrackId: ${audioTrackId}`);

      if (!videoTrackId && !audioTrackId) {
        console.log(`[YT EGRESS] Both tracks undefined, skipping egress start`);
        return '';
      }

      const output = new StreamOutput({
        protocol: StreamProtocol.RTMP,
        urls: [rtmpUrl],
      });

      let info;

      if (commentatorIdentity && commentatorIdentity !== capturerIdentity) {
        // We have a separate commentator, must use TrackCompositeEgress
        info = await this.egressClient.startTrackCompositeEgress(
          room,
          { stream: output },
          { audioTrackId, videoTrackId }
        );
      } else if (capturerIdentity) {
        // Just the capturer, use ParticipantEgress which is more resilient to track renegotiations
        console.log(`[YT EGRESS] Using ParticipantEgress for ${capturerIdentity}`);
        info = await this.egressClient.startParticipantEgress(
          room,
          capturerIdentity,
          { stream: output }
        );
      } else {
        console.log(`[YT EGRESS] No capturer or commentator, skipping egress`);
        return '';
      }
      
      console.log(`[YT EGRESS] Started egress: ${info.egressId}`);
      return info.egressId;
    } catch (err) {
      console.error('[YT EGRESS] Failed to start:', err);
      throw err;
    }
  }

  async stopYoutubeEgress(egressId: string): Promise<void> {
    try {
      await this.egressClient.stopEgress(egressId);
    } catch (err) {
      console.error('Failed to stop YT egress:', err);
    }
  }
}

