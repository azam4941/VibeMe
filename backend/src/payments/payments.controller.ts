import { Controller, Post, Get, Body, Req, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * POST /api/payments/create-order
   * Creates a Razorpay order for adding money
   */
  @Post('create-order')
  async createOrder(@Req() req, @Body() body: { amount: number }) {
    return this.paymentsService.createOrder(req.user.userId, body.amount);
  }

  /**
   * POST /api/payments/verify
   * Verifies Razorpay payment and adds funds
   */
  @Post('verify')
  async verifyPayment(
    @Req() req,
    @Body() body: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
      amount: number;
    },
  ) {
    return this.paymentsService.verifyPayment(
      req.user.userId,
      body.razorpayOrderId,
      body.razorpayPaymentId,
      body.razorpaySignature,
      body.amount,
    );
  }

  /**
   * POST /api/payments/withdraw
   * Withdraws from wallet
   */
  @Post('withdraw')
  async withdraw(@Req() req, @Body() body: { amount: number; upiId?: string }) {
    return this.paymentsService.withdraw(req.user.userId, body.amount, body.upiId);
  }

  /**
   * GET /api/payments/balance
   * Gets wallet balance and transaction history
   */
  @Get('balance')
  async getBalance(@Req() req) {
    return this.paymentsService.getWalletInfo(req.user.userId);
  }
}
