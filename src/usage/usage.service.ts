import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  async onParticipantJoined(room: string, identity: string, role: string): Promise<void> {
    const event = await this.prisma.eventInfo.findUnique({ where: { id: room } });
    if (!event) return;

    await this.prisma.usageSession.upsert({
      where: { room_identity: { room, identity } },
      create: { adminId: event.createdBy, room, identity, role, startedAt: new Date() },
      update: { endedAt: null, durationMinutes: null, startedAt: new Date(), role },
    });
  }

  async onParticipantLeft(room: string, identity: string): Promise<void> {
    const session = await this.prisma.usageSession.findUnique({
      where: { room_identity: { room, identity } },
    });
    if (!session || session.endedAt) return;

    const endedAt = new Date();
    const durationMinutes = (endedAt.getTime() - session.startedAt.getTime()) / 60000;

    await this.prisma.$transaction([
      this.prisma.usageSession.update({
        where: { room_identity: { room, identity } },
        data: { endedAt, durationMinutes },
      }),
      this.prisma.subscription.update({
        where: { adminId: session.adminId },
        data: { usedMinutes: { increment: durationMinutes } },
      }),
    ]);
  }

  async getRemainingMinutes(adminId: number): Promise<number> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { adminId },
      include: { plan: true },
    });
    if (!subscription) return 0;

    const activeSessions = await this.prisma.usageSession.findMany({
      where: { adminId, endedAt: null },
    });

    const now = new Date();
    const activeMinutes = activeSessions.reduce(
      (sum, s) => sum + (now.getTime() - s.startedAt.getTime()) / 60000,
      0,
    );

    return subscription.plan.usageLimitMinutes - subscription.usedMinutes - activeMinutes;
  }

  async getUsageStats(adminId: number): Promise<{
    usedMinutes: number;
    limitMinutes: number;
    remainingMinutes: number;
  }> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { adminId },
      include: { plan: true },
    });
    if (!subscription) return { usedMinutes: 0, limitMinutes: 0, remainingMinutes: 0 };

    const remaining = await this.getRemainingMinutes(adminId);
    return {
      usedMinutes: subscription.usedMinutes,
      limitMinutes: subscription.plan.usageLimitMinutes,
      remainingMinutes: Math.max(0, remaining),
    };
  }
}
