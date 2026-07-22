import { Injectable, InternalServerErrorException } from '@nestjs/common';

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

interface BroadcastResult {
  broadcastId: string;
  ytLiveUrl: string;
}

interface StreamResult {
  streamId: string;
  streamKey: string;
}

@Injectable()
export class YoutubeService {
  private readonly clientId = process.env.GOOGLE_CLIENT_ID ?? '';
  private readonly clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? '';
  private readonly redirectUri = process.env.YOUTUBE_REDIRECT_URI ?? '';

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/youtube',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<TokenResponse> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new InternalServerErrorException(`Token exchange failed: ${err}`);
    }
    return res.json() as Promise<TokenResponse>;
  }

  async createBroadcast(
    accessToken: string,
    title: string,
  ): Promise<BroadcastResult> {
    const scheduledStartTime = new Date(Date.now() + 30_000).toISOString();
    const res = await fetch(
      'https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          snippet: {
            title,
            scheduledStartTime,
            description: 'Live sports stream via Livo',
          },
          status: { privacyStatus: 'public' },
          contentDetails: {
            enableAutoStart: true,
            enableAutoStop: true,
            latencyPreference: 'ultraLow',
          },
        }),
      },
    );
    if (!res.ok) {
      const err = await res.text();
      throw new InternalServerErrorException(`Create broadcast failed: ${err}`);
    }
    const data: any = await res.json();
    return {
      broadcastId: data.id as string,
      ytLiveUrl: `https://www.youtube.com/watch?v=${data.id as string}`,
    };
  }

  async createStream(
    accessToken: string,
    title: string,
  ): Promise<StreamResult> {
    const res = await fetch(
      'https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          snippet: { title, description: 'Livo live stream' },
          cdn: {
            frameRate: 'variable',
            ingestionType: 'rtmp',
            resolution: 'variable',
          },
        }),
      },
    );
    if (!res.ok) {
      const err = await res.text();
      throw new InternalServerErrorException(`Create stream failed: ${err}`);
    }
    const data: any = await res.json();
    const streamKey = (data.cdn?.ingestionInfo?.streamName ?? '') as string;
    return { streamId: data.id as string, streamKey };
  }

  async bindStreamToBroadcast(
    accessToken: string,
    broadcastId: string,
    streamId: string,
  ): Promise<void> {
    const params = new URLSearchParams({
      id: broadcastId,
      streamId,
      part: 'id',
    });
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?${params.toString()}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!res.ok) {
      const err = await res.text();
      throw new InternalServerErrorException(`Bind stream failed: ${err}`);
    }
  }

  async endBroadcast(accessToken: string, broadcastId: string): Promise<void> {
    const params = new URLSearchParams({
      id: broadcastId,
      broadcastStatus: 'complete',
      part: 'id',
    });
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?${params.toString()}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    // 400 is expected if stream is already ended / not in live state — ignore it
    if (!res.ok && res.status !== 400) {
      const err = await res.text();
      throw new InternalServerErrorException(`End broadcast failed: ${err}`);
    }
  }
}
