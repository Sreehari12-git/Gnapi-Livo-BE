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

  async createOrder(adminId: number, amount: number, currency = 'INR') {
    const order = await this.razorpay.orders.create({
      amount: amount * 100,
      currency,
      payment_capture: true,
    } as any);

    await this.prisma.transaction.create({
      data: {
        adminId,
        orderId: order.id as string,
        amount: amount * 100,
        currency,
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
        create: { adminId, plan: 'pro', status: 'active' },
        update: { plan: 'pro', status: 'active' },
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
    // Delete admin — cascades to subscription & transactions via onDelete: Cascade
    await this.prisma.adminLogin.delete({ where: { id: adminId } }).catch(() => {});
    return { success: true };
  }

  async activateFree(adminId: number) {
    await this.prisma.subscription.upsert({
      where: { adminId },
      create: { adminId, plan: 'free', status: 'active' },
      update: { plan: 'free', status: 'active' },
    });
    return { success: true };
  }
}
