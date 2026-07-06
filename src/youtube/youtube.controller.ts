import { Controller, Get, Query, Res, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { YoutubeService } from './youtube.service';
import { MatchService } from '../match/match.service';

@Controller('youtube')
export class YoutubeController {
  constructor(
    private readonly youtubeService: YoutubeService,
    private readonly matchService: MatchService,
  ) {}

  /** Frontend calls this to get the Google OAuth URL for a specific match */
  @Get('auth-url')
  getAuthUrl(@Query('matchId') matchId: string) {
    if (!matchId) throw new BadRequestException('matchId is required');
    return { authUrl: this.youtubeService.getAuthUrl(matchId) };
  }

  /**
   * Google redirects here after the broadcaster authenticates.
   * state = matchId
   */
  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') matchId: string,
    @Res() res: Response,
  ) {
    if (!code || !matchId) {
      return res.status(400).send('<h2>Missing code or state.</h2>');
    }

    try {
      // Verify match exists BEFORE consuming the one-time OAuth code
      const match = await this.matchService.getMatch(matchId);

      // Idempotency: if this match already has a YouTube broadcast, a previous
      // callback already succeeded (browser called us twice). Return success.
      if (match.ytBroadcastId) {
        res.setHeader('Content-Type', 'text/html');
        return res.send(`
          <!DOCTYPE html><html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f9fafb;margin:0;">
            <div style="background:white;border-radius:12px;padding:32px 40px;text-align:center;box-shadow:0 2px 16px rgba(0,0,0,.08);max-width:360px;">
              <h2 style="color:#16a34a;margin-top:0;">Already connected!</h2>
              <p style="color:#6b7280;">YouTube Live is already set up for this match. Return to the app.</p>
            </div>
          </body></html>
        `);
      }

      const tokens = await this.youtubeService.exchangeCode(code);

      const { broadcastId, ytLiveUrl } = await this.youtubeService.createBroadcast(
        tokens.access_token,
        match.name,
      );
      const { streamId, streamKey } = await this.youtubeService.createStream(
        tokens.access_token,
        match.name,
      );
      await this.youtubeService.bindStreamToBroadcast(
        tokens.access_token,
        broadcastId,
        streamId,
      );

      // WHIP URL — capturer will push WebRTC directly here (free, no egress needed)
      const ytWhipUrl = `https://whip.youtube.com/live/${streamKey}`;

      await this.matchService.saveYoutubeInfo(matchId, {
        ytBroadcastId: broadcastId,
        ytStreamId: streamId,
        ytWhipUrl,
        ytLiveUrl,
      });

      res.setHeader('Content-Type', 'text/html');
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>YouTube Connected</title>
          <style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#f9fafb;margin:0;}
          .box{background:white;border-radius:12px;padding:32px 40px;text-align:center;box-shadow:0 2px 16px rgba(0,0,0,.08);max-width:360px;}
          h2{color:#16a34a;margin-top:0;}p{color:#6b7280;}</style></head>
          <body>
            <div class="box">
              <h2>YouTube Connected!</h2>
              <p>Return to the Livo app — the capturer will start streaming to YouTube automatically.</p>
              <p style="margin-top:16px;font-size:13px;color:#9ca3af;">You can close this tab.</p>
            </div>
          </body>
        </html>
      `);
    } catch (err: any) {
      res.setHeader('Content-Type', 'text/html');
      res.status(500).send(`
        <!DOCTYPE html><html><body style="font-family:sans-serif;padding:32px;">
          <h2 style="color:#dc2626;">Connection failed</h2>
          <p>${err?.message ?? 'Unknown error'}</p>
          <p>Close this tab and try again from the app.</p>
        </body></html>
      `);
    }
  }
}
