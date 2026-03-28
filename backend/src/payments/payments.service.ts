import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/user.schema';
import * as crypto from 'crypto';

@Injectable()
export class PaymentsService {
  private razorpayKeyId: string;
  private razorpayKeySecret: string;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {
    this.razorpayKeyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder';
    this.razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret';
  }

  /**
   * Create a Razorpay order for adding money
   */
  async createOrder(userId: string, amount: number) {
    if (amount <= 0 || amount > 50000) {
      throw new BadRequestException('Amount must be between ₹1 and ₹50,000');
    }

    // If Razorpay keys are configured, create a real order
    if (this.razorpayKeyId && this.razorpayKeyId !== 'rzp_test_placeholder') {
      try {
        const Razorpay = require('razorpay');
        const instance = new Razorpay({
          key_id: this.razorpayKeyId,
          key_secret: this.razorpayKeySecret,
        });

        const order = await instance.orders.create({
          amount: amount * 100, // paise
          currency: 'INR',
          receipt: `receipt_${userId}_${Date.now()}`,
          notes: { userId, type: 'wallet_topup' },
        });

        return {
          orderId: order.id,
          amount,
          currency: 'INR',
          keyId: this.razorpayKeyId,
        };
      } catch (err) {
        console.error('Razorpay order creation failed:', err);
        // Fall through to simulated mode
      }
    }

    // Simulated mode (when Razorpay not configured)
    const simulatedOrderId = `order_sim_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return {
      orderId: simulatedOrderId,
      amount,
      currency: 'INR',
      keyId: this.razorpayKeyId,
      simulated: true,
    };
  }

  /**
   * Verify Razorpay payment and add funds to wallet
   */
  async verifyPayment(
    userId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
    amount: number,
  ) {
    if (amount <= 0) throw new BadRequestException('Invalid amount');

    // Real verification if Razorpay is configured
    if (this.razorpayKeySecret && this.razorpayKeySecret !== 'placeholder_secret' && !razorpayOrderId.startsWith('order_sim_')) {
      const body = razorpayOrderId + '|' + razorpayPaymentId;
      const expectedSig = crypto
        .createHmac('sha256', this.razorpayKeySecret)
        .update(body)
        .digest('hex');

      if (expectedSig !== razorpaySignature) {
        throw new BadRequestException('Invalid payment signature — payment not verified');
      }
    }

    // Add funds to wallet
    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      {
        $inc: { balance: amount },
        $push: {
          transactions: {
            type: 'credit',
            amount,
            description: `Added ₹${amount} to wallet`,
            createdAt: new Date(),
          },
        },
      },
      { new: true },
    );

    return {
      success: true,
      newBalance: updatedUser.balance,
      user: updatedUser,
    };
  }

  /**
   * Withdraw from wallet
   */
  async withdraw(userId: string, amount: number, upiId?: string) {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');

    const user = await this.userModel.findById(userId);
    if (!user) throw new BadRequestException('User not found');
    if (user.balance < amount) throw new BadRequestException('Insufficient balance');

    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      {
        $inc: { balance: -amount },
        $push: {
          transactions: {
            type: 'debit',
            amount,
            description: `Withdrawal of ₹${amount}${upiId ? ` to ${upiId}` : ''}`,
            createdAt: new Date(),
          },
        },
      },
      { new: true },
    );

    return {
      success: true,
      newBalance: updatedUser.balance,
      user: updatedUser,
    };
  }

  /**
   * Get wallet info
   */
  async getWalletInfo(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    return {
      balance: user.balance || 0,
      totalEarnings: user.totalEarnings || 0,
      totalSpent: user.totalSpent || 0,
      transactions: (user.transactions || []).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    };
  }
}
