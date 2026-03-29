import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/user.schema';
import * as crypto from 'crypto';
import Razorpay = require('razorpay');

@Injectable()
export class PaymentsService {
  private razorpay: InstanceType<typeof Razorpay>;
  private razorpayKeyId: string;
  private razorpayKeySecret: string;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {
    this.razorpayKeyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_SWycOSiz5MvgZA';
    this.razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || 'WqghuL4BYfRe2uMOlfN6KAb5';

    this.razorpay = new Razorpay({
      key_id: this.razorpayKeyId,
      key_secret: this.razorpayKeySecret,
    });

    console.log('💳 Razorpay initialized with key:', this.razorpayKeyId);
  }

  /**
   * Create a Razorpay order for adding money
   */
  async createOrder(userId: string, amount: number) {
    if (amount <= 0 || amount > 50000) {
      throw new BadRequestException('Amount must be between ₹1 and ₹50,000');
    }

    try {
      const order = await this.razorpay.orders.create({
        amount: amount * 100, // convert to paise
        currency: 'INR',
        receipt: `rcpt_${userId.slice(-6)}_${Date.now()}`,
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
      throw new BadRequestException('Failed to create payment order: ' + (err.message || 'Unknown error'));
    }
  }

  /**
   * Verify Razorpay payment signature and add funds to wallet
   */
  async verifyPayment(
    userId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
    amount: number,
  ) {
    if (amount <= 0) throw new BadRequestException('Invalid amount');

    // Verify Razorpay signature
    const body = razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSig = crypto
      .createHmac('sha256', this.razorpayKeySecret)
      .update(body)
      .digest('hex');

    if (expectedSig !== razorpaySignature) {
      throw new BadRequestException('Payment verification failed — invalid signature');
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
            description: `Added ₹${amount} via Razorpay`,
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
