import { Injectable, BadRequestException } from '@nestjs/common';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentService {
  private razorpay: Razorpay;

  constructor(private readonly prisma: PrismaService) {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }

  async getPlans() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { amount: 'asc' },
    });
  }

  async getCurrentSubscription(adminId: number) {
    return this.prisma.subscription.findUnique({
      where: { adminId },
      include: { plan: true },
    });
  }

  async createOrder(adminId: number, planId: number) {
    const plan = await this.prisma.subscriptionPlan.findUniqueOrThrow({
      where: { id: planId },
    });

    const order = await this.razorpay.orders.create({
      amount: plan.amount * 100,
      currency: 'INR',
      payment_capture: true,
    });

    await this.prisma.transaction.create({
      data: {
        adminId,
        orderId: order.id,
        amount: plan.amount * 100,
        currency: 'INR',
        status: 'pending',
      },
    });

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    };
  }

  async verifyAndActivate(
    adminId: number,
    planId: number,
    orderId: string,
    paymentId: string,
    signature: string,
  ) {
    const body = `${orderId}|${paymentId}`;
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest('hex');

    if (expected !== signature) {
      throw new BadRequestException('Payment verification failed');
    }

    await this.prisma.$transaction([
      this.prisma.transaction.update({
        where: { orderId },
        data: { paymentId, status: 'success' },
      }),
      this.prisma.subscription.upsert({
        where: { adminId },
        create: { adminId, planId, status: 'active' },
        update: { planId, status: 'active' },
      }),
    ]);

    return { success: true };
  }

  async handleFailure(adminId: number, orderId?: string) {
    if (orderId) {
      await this.prisma.transaction
        .update({ where: { orderId }, data: { status: 'failed' } })
        .catch(() => {});
    }
    await this.prisma.adminLogin
      .delete({ where: { id: adminId } })
      .catch(() => {});
    return { success: true };
  }

  async activateFree(adminId: number, planId: number) {
    await this.prisma.subscription.upsert({
      where: { adminId },
      create: { adminId, planId, status: 'active' },
      update: { planId, status: 'active' },
    });
    return { success: true };
  }
}
