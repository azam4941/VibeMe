import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import axios from 'axios';
import * as twilio from 'twilio';
import * as admin from 'firebase-admin';
import * as path from 'path';

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    let serviceAccount: any;

    // Option 1: Read from environment variable (for Render/production)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
      // Option 2: Read from local file (for development)
      const serviceAccountPath = path.resolve(__dirname, '..', '..', 'src', 'config', 'firebase-service-account.json');
      serviceAccount = require(serviceAccountPath);
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Failed to load Firebase service account key:', error.message);
  }
}

@Injectable()
export class AuthService {
  // In-memory OTP store (use Redis in production)
  private otpStore = new Map<string, { otp: string; expiresAt: number; attempts: number }>();

  // Rate-limit OTP sends per phone: max 5 per 10 minutes
  private otpSendLog = new Map<string, number[]>();

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async verifyFirebaseOtp(idToken: string): Promise<{ token: string; user: any; isNewUser: boolean }> {
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      let phoneNumber = decodedToken.phone_number;
      
      if (!phoneNumber) {
        throw new UnauthorizedException('Firebase token does not contain a phone number.');
      }
      
      // Strip +91 since local user database stores it without country code
      if (phoneNumber.startsWith('+91')) {
        phoneNumber = phoneNumber.slice(3);
      }

      // Find or create user
      let user = await this.usersService.findByPhone(phoneNumber);
      let isNewUser = false;

      if (!user) {
        user = await this.usersService.create({ phoneNumber, name: 'New User' });
        isNewUser = true;
      }

      if (user.isBlocked) {
        throw new UnauthorizedException('Your account has been suspended. Contact support.');
      }

      await this.usersService.updateLastActive(user._id.toString());

      const payload = {
        userId: user._id.toString(),
        phoneNumber: user.phoneNumber,
        isAdmin: user.isAdmin,
        isVerified: user.isVerified,
      };

      return {
        token: await this.jwtService.signAsync(payload),
        user,
        isNewUser,
      };
    } catch (error) {
      console.error('Firebase Verify Error:', error.message);
      throw new UnauthorizedException('Invalid Firebase Token: ' + error.message);
    }
  }

  async sendOtp(phoneNumber: string): Promise<{ message: string; otp?: string }> {
    // Rate-limit check
    this.enforceOtpRateLimit(phoneNumber);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    this.otpStore.set(phoneNumber, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      attempts: 0,
    });

    // Track send time for rate limiting
    const sends = this.otpSendLog.get(phoneNumber) || [];
    sends.push(Date.now());
    this.otpSendLog.set(phoneNumber, sends.filter(t => t > Date.now() - 600_000));

    // Send via Twilio if configured
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    if (twilioSid && twilioAuth && twilioPhone) {
      try {
        const client = twilio(twilioSid, twilioAuth);
        // Ensure phone number starts with country code, default to India +91 if missing
        const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
        
        await client.messages.create({
          body: `Your VibeMe Login OTP is: ${otp}. Do not share this with anyone!`,
          from: twilioPhone,
          to: formattedPhone
        });
        console.log(`📱 Real SMS Sent to ${formattedPhone} via Twilio`);
        return { message: 'OTP sent successfully via SMS' };
      } catch (err) {
        // Log Twilio error but don't crash - fall through to console fallback
        console.error('⚠️  Twilio SMS failed (falling back to console):', err.message);
        console.log(`📱 FALLBACK OTP for ${phoneNumber}: ${otp}`);
        // Return OTP in response so the user can still log in during development/testing
        return {
          message: 'SMS unavailable (Twilio error). OTP shown for testing.',
          otp,
        };
      }
    } 
    
    // Send via Fast2SMS if API key is present
    const fast2smsKey = process.env.FAST2SMS_API_KEY;
    if (fast2smsKey && fast2smsKey !== 'your_fast2sms_api_key_here') {
      try {
        await axios.post('https://www.fast2sms.com/dev/bulkV2', null, {
          headers: {
            authorization: fast2smsKey,
          },
          params: {
            variables_values: otp,
            route: 'otp',
            numbers: phoneNumber,
          }
        });
        console.log(`📱 Real SMS Sent to ${phoneNumber} via Fast2SMS`);
        return { message: 'OTP sent successfully via SMS' };
      } catch (err) {
        console.error('Failed to send SMS via Fast2SMS:', err.response?.data || err.message);
        throw new BadRequestException('Fast2SMS Error: You need to approve an OTP Template in your Fast2SMS Dashboard first.');
      }
    }

    // Fallback to console log for development
    console.log(`📱 DEVELOPMENT OTP for ${phoneNumber}: ${otp}`);
    return {
      message: 'OTP logged to console (Missing API Key)',
      otp, // Remove in production when keys are setup
    };
  }

  async verifyOtp(phoneNumber: string, otp: string): Promise<{ token: string; user: any; isNewUser: boolean }> {
    const stored = this.otpStore.get(phoneNumber);

    if (!stored) {
      throw new UnauthorizedException('No OTP requested for this number. Send OTP first.');
    }

    // Max 5 wrong attempts, then invalidate
    if (stored.attempts >= 5) {
      this.otpStore.delete(phoneNumber);
      throw new UnauthorizedException('Too many wrong attempts. Request a new OTP.');
    }

    if (Date.now() > stored.expiresAt) {
      this.otpStore.delete(phoneNumber);
      throw new UnauthorizedException('OTP expired. Request a new one.');
    }

    if (stored.otp !== otp) {
      stored.attempts++;
      throw new UnauthorizedException(`Invalid OTP. ${5 - stored.attempts} attempts remaining.`);
    }

    // OTP valid — clean up
    this.otpStore.delete(phoneNumber);

    // Find or create user
    let user = await this.usersService.findByPhone(phoneNumber);
    let isNewUser = false;

    if (!user) {
      user = await this.usersService.create({ phoneNumber, name: 'New User' });
      isNewUser = true;
    }

    // Check if blocked
    if (user.isBlocked) {
      throw new UnauthorizedException('Your account has been suspended. Contact support.');
    }

    // Update last active
    await this.usersService.updateLastActive(user._id.toString());

    const payload = {
      userId: user._id.toString(),
      phoneNumber: user.phoneNumber,
      isAdmin: user.isAdmin,
      isVerified: user.isVerified,
    };

    const token = await this.jwtService.signAsync(payload);

    return { token, user, isNewUser };
  }

  private enforceOtpRateLimit(phoneNumber: string): void {
    const sends = this.otpSendLog.get(phoneNumber) || [];
    const recentSends = sends.filter(t => t > Date.now() - 600_000); // last 10 minutes
    if (recentSends.length >= 5) {
      throw new BadRequestException('Too many OTP requests. Try again in 10 minutes.');
    }
  }
}
