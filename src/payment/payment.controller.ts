import { Controller, Get, Post, Body, Param, BadRequestException } from '@nestjs/common';
import { PaymentService } from './payment.service';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get('plans')
  getPlans() {
    return this.paymentService.getPlans();
  }

  @Get('subscription/:adminId')
  getCurrentSubscription(@Param('adminId') adminId: string) {
    return this.paymentService.getCurrentSubscription(Number(adminId));
  }

  @Post('create-order')
  createOrder(
    @Body('adminId') adminId: number,
    @Body('planId') planId: number,
  ) {
    return this.paymentService.createOrder(Number(adminId), Number(planId));
  }

  @Post('verify')
  verify(
    @Body('adminId') adminId: number,
    @Body('planId') planId: number,
    @Body('orderId') orderId: string,
    @Body('paymentId') paymentId: string,
    @Body('signature') signature: string,
  ) {
    return this.paymentService.verifyAndActivate(Number(adminId), Number(planId), orderId, paymentId, signature);
  }

  @Post('fail')
  fail(
    @Body('adminId') adminId: number,
    @Body('orderId') orderId: string,
  ) {
    return this.paymentService.handleFailure(Number(adminId), orderId);
  }

  @Post('free')
  free(
    @Body('adminId') adminId: number,
    @Body('planId') planId: number,
  ) {
    return this.paymentService.activateFree(Number(adminId), Number(planId));
  }
}
