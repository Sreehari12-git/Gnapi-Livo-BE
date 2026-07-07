import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { PaymentService } from './payment.service';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('create-order')
  createOrder(
    @Body('adminId') adminId: number,
    @Body('amount') amount: number,
  ) {
    return this.paymentService.createOrder(Number(adminId), amount ?? 999);
  }

  @Post('verify')
  verify(
    @Body('adminId') adminId: number,
    @Body('orderId') orderId: string,
    @Body('paymentId') paymentId: string,
    @Body('signature') signature: string,
  ) {
    return this.paymentService.verifyAndActivate(Number(adminId), orderId, paymentId, signature);
  }

  @Post('fail')
  fail(
    @Body('adminId') adminId: number,
    @Body('orderId') orderId: string,
  ) {
    return this.paymentService.handleFailure(Number(adminId), orderId);
  }

  @Post('free')
  free(@Body('adminId') adminId: number) {
    return this.paymentService.activateFree(Number(adminId));
  }
}
