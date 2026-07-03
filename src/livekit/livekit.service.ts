import { Injectable } from '@nestjs/common';
import { AccessToken } from 'livekit-server-sdk';
import { GenerateTokenDto } from './dto/generate-token.dto';

@Injectable()
export class LiveKitService {
  private readonly apiKey = process.env.LIVEKIT_API_KEY;
  private readonly apiSecret = process.env.LIVEKIT_API_SECRET;
  private readonly livekitUrl = process.env.LIVEKIT_URL;

  async generateToken(dto: GenerateTokenDto): Promise<{ token: string; url: string }> {
    const { identity, room, role } = dto;

    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity,
      ttl: '6h',
    });

    // Set permissions based on role
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
}
