import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LiveKitService } from '../livekit/livekit.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { SetMatchLiveSelectionDto } from './dto/set-match-live-selection.dto';

@Injectable()
export class MatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly liveKitService: LiveKitService,
  ) {}

  async createMatch(dto: CreateMatchDto) {
    const { eventId, sport, name } = dto;

    const event = await this.prisma.eventInfo.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return this.prisma.match.create({ data: { eventId, sport, name } });
  }

  async listMatchesForEvent(eventId: string, forViewer: boolean) {
    return this.prisma.match.findMany({
      where: {
        eventId,
        ...(forViewer ? { liveStatus: { in: ['live', 'ended'] } } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getMatch(id: string) {
    const match = await this.prisma.match.findUnique({ where: { id } });
    if (!match) {
      throw new NotFoundException('Match not found');
    }
    return match;
  }

  async updateMatch(id: string, dto: UpdateMatchDto) {
    const current = await this.getMatch(id);

    const { finalScore, ...rest } = dto;
    const isEnding = dto.liveStatus === 'ended';

    const match = await this.prisma.match.update({
      where: { id },
      data: {
        ...rest,
        ...(isEnding
          ? {
              liveCapturerIdentity: null,
              liveCommentatorIdentity: null,
              ytBroadcastId: null,
              ytStreamId: null,
              ytWhipUrl: null,
              ytLiveUrl: null,
            }
          : {}),
      },
    });

    if (isEnding) {
      // Notify capturer to stop WHIP (ytWhipUrl: null tells capturer to close the connection)
      await this.liveKitService.sendRoomData(match.eventId, {
        type: 'MATCH_LIVE_UPDATE',
        matchId: match.id,
        liveCapturerIdentity: null,
        liveCommentatorIdentity: null,
        ytWhipUrl: null,
      });

      if (finalScore) {
        await this.prisma.matchHistory.upsert({
          where: { matchId: match.id },
          update: { ...finalScore },
          create: {
            eventId: match.eventId,
            matchId: match.id,
            sport: current.sport,
            name: current.name,
            ...finalScore,
          },
        });
      }
    }

    return match;
  }

  async deleteMatch(id: string) {
    await this.getMatch(id);
    await this.prisma.match.delete({ where: { id } });
    return { message: 'Match deleted successfully' };
  }

  /** Saves YouTube broadcast info and notifies the assigned capturer to start WHIP */
  async saveYoutubeInfo(
    matchId: string,
    info: {
      ytBroadcastId: string;
      ytStreamId: string;
      ytWhipUrl: string;
      ytLiveUrl: string;
    },
  ) {
    const match = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        ytBroadcastId: info.ytBroadcastId,
        ytStreamId: info.ytStreamId,
        ytWhipUrl: info.ytWhipUrl,
        ytLiveUrl: info.ytLiveUrl,
      },
    });

    // Tell the assigned capturer to open a WHIP connection to YouTube
    await this.liveKitService.sendRoomData(match.eventId, {
      type: 'MATCH_LIVE_UPDATE',
      matchId: match.id,
      liveCapturerIdentity: match.liveCapturerIdentity,
      liveCommentatorIdentity: match.liveCommentatorIdentity,
      ytWhipUrl: match.ytWhipUrl,
    });

    return match;
  }

  /** Stops the YouTube stream for a match — clears ytWhipUrl and notifies capturer */
  async stopYoutubeStream(matchId: string) {
    const match = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        ytBroadcastId: null,
        ytStreamId: null,
        ytWhipUrl: null,
        ytLiveUrl: null,
      },
    });

    await this.liveKitService.sendRoomData(match.eventId, {
      type: 'MATCH_LIVE_UPDATE',
      matchId: match.id,
      liveCapturerIdentity: match.liveCapturerIdentity,
      liveCommentatorIdentity: match.liveCommentatorIdentity,
      ytWhipUrl: null,
    });

    return match;
  }

  async setLiveSelection(matchId: string, dto: SetMatchLiveSelectionDto) {
    const target = await this.getMatch(matchId);
    const { liveCapturerIdentity, liveCommentatorIdentity } = dto;

    const { updatedMatch, clearedMatches } = await this.prisma.$transaction(async (tx) => {
      const identitiesToClaim = [liveCapturerIdentity, liveCommentatorIdentity].filter(
        (identity): identity is string => !!identity,
      );

      const cleared: { id: string; liveCapturerIdentity: string | null; liveCommentatorIdentity: string | null; ytWhipUrl: string | null }[] = [];

      if (identitiesToClaim.length > 0) {
        const conflicting = await tx.match.findMany({
          where: {
            eventId: target.eventId,
            id: { not: matchId },
            OR: [
              { liveCapturerIdentity: { in: identitiesToClaim } },
              { liveCommentatorIdentity: { in: identitiesToClaim } },
            ],
          },
        });

        for (const conflict of conflicting) {
          const clearedMatch = await tx.match.update({
            where: { id: conflict.id },
            data: {
              liveCapturerIdentity:
                conflict.liveCapturerIdentity && identitiesToClaim.includes(conflict.liveCapturerIdentity)
                  ? null
                  : conflict.liveCapturerIdentity,
              liveCommentatorIdentity:
                conflict.liveCommentatorIdentity && identitiesToClaim.includes(conflict.liveCommentatorIdentity)
                  ? null
                  : conflict.liveCommentatorIdentity,
            },
          });
          cleared.push(clearedMatch);
        }
      }

      const goesLive = !!liveCapturerIdentity || !!liveCommentatorIdentity;

      const updated = await tx.match.update({
        where: { id: matchId },
        data: {
          liveCapturerIdentity,
          liveCommentatorIdentity,
          ...(goesLive && target.liveStatus === 'not_started' ? { liveStatus: 'live' } : {}),
        },
      });

      return { updatedMatch: updated, clearedMatches: cleared };
    });

    // Include ytWhipUrl so that when a capturer is (re)assigned, they know to start/stop WHIP
    await this.liveKitService.sendRoomData(target.eventId, {
      type: 'MATCH_LIVE_UPDATE',
      matchId: updatedMatch.id,
      liveCapturerIdentity: updatedMatch.liveCapturerIdentity,
      liveCommentatorIdentity: updatedMatch.liveCommentatorIdentity,
      ytWhipUrl: updatedMatch.ytWhipUrl,
    });

    for (const clearedMatch of clearedMatches) {
      await this.liveKitService.sendRoomData(target.eventId, {
        type: 'MATCH_LIVE_UPDATE',
        matchId: clearedMatch.id,
        liveCapturerIdentity: clearedMatch.liveCapturerIdentity,
        liveCommentatorIdentity: clearedMatch.liveCommentatorIdentity,
        ytWhipUrl: clearedMatch.ytWhipUrl,
      });
    }

    return updatedMatch;
  }
}
