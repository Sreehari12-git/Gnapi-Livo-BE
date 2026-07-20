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
              liveCapturerIdentities: [],
              liveCommentatorIdentities: [],
              ytBroadcastId: null,
              ytStreamId: null,
              ytWhipUrl: null,
              ytLiveUrl: null,
              egressId: null,
            }
          : {}),
      },
    });

    if (isEnding) {
      if (current.egressId) {
        await this.liveKitService.stopRecording(current.egressId);
      }

      await this.liveKitService.sendRoomData(match.eventId, {
        type: 'MATCH_LIVE_UPDATE',
        matchId: match.id,
        liveCapturerIdentities: [],
        liveCommentatorIdentities: [],
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

    await this.liveKitService.sendRoomData(match.eventId, {
      type: 'MATCH_LIVE_UPDATE',
      matchId: match.id,
      liveCapturerIdentities: match.liveCapturerIdentities,
      liveCommentatorIdentities: match.liveCommentatorIdentities,
      ytWhipUrl: match.ytWhipUrl,
    });

    return match;
  }

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
      liveCapturerIdentities: match.liveCapturerIdentities,
      liveCommentatorIdentities: match.liveCommentatorIdentities,
      ytWhipUrl: null,
    });

    return match;
  }

  async setLiveSelection(matchId: string, dto: SetMatchLiveSelectionDto) {
    const target = await this.getMatch(matchId);
    const newCapturers = dto.liveCapturerIdentities ?? target.liveCapturerIdentities;
    const newCommentators = dto.liveCommentatorIdentities ?? target.liveCommentatorIdentities;

    const updatedMatch = await this.prisma.$transaction(async (tx) => {
      // Remove any newly-claimed identities from other matches (one-match-at-a-time rule)
      const claimedIds = [...newCapturers, ...newCommentators];
      if (claimedIds.length > 0) {
        const conflicting = await tx.match.findMany({
          where: {
            eventId: target.eventId,
            id: { not: matchId },
            OR: [
              { liveCapturerIdentities: { hasSome: claimedIds } },
              { liveCommentatorIdentities: { hasSome: claimedIds } },
            ],
          },
        });

        for (const conflict of conflicting) {
          await tx.match.update({
            where: { id: conflict.id },
            data: {
              liveCapturerIdentities: conflict.liveCapturerIdentities.filter(
                (id) => !claimedIds.includes(id),
              ),
              liveCommentatorIdentities: conflict.liveCommentatorIdentities.filter(
                (id) => !claimedIds.includes(id),
              ),
            },
          });
        }
      }

      const goesLive = newCapturers.length > 0 || newCommentators.length > 0;

      return tx.match.update({
        where: { id: matchId },
        data: {
          liveCapturerIdentities: newCapturers,
          liveCommentatorIdentities: newCommentators,
          ...(goesLive && target.liveStatus === 'not_started' ? { liveStatus: 'live' } : {}),
        },
      });
    });

    if (updatedMatch.liveStatus === 'live' && target.liveStatus === 'not_started' && !target.egressId) {
      try {
        const { egressId, recordingUrl } = await this.liveKitService.startRecording(target.eventId, matchId);
        await this.prisma.match.update({
          where: { id: matchId },
          data: { egressId, recordingUrl },
        });
      } catch (error) {
        console.error('Failed to start LiveKit egress recording:', error);
      }
    }

    await this.liveKitService.sendRoomData(target.eventId, {
      type: 'MATCH_LIVE_UPDATE',
      matchId: updatedMatch.id,
      liveCapturerIdentities: updatedMatch.liveCapturerIdentities,
      liveCommentatorIdentities: updatedMatch.liveCommentatorIdentities,
      ytWhipUrl: updatedMatch.ytWhipUrl,
    });

    return updatedMatch;
  }
}
