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

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
      try {
        const serviceAccountPath = path.resolve(__dirname, '..', '..', 'src', 'config', 'firebase-service-account.json');
        serviceAccount = require(serviceAccountPath);
      } catch (e) {
        // Fallback: Embed JSON directly if file/env var missing (useful for first-time Render deploy)
        serviceAccount = {
          "type": "service_account",
          "project_id": "vibeme-bce95",
          "private_key_id": "c5a555c5135eda60c313fe87fe1b9c890e3f4271",
          "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCky6OG2ZmutH6x\ns3IBJ1swP5RvCu6U0ubY9CPPOiuI5z/MJZQySYG7LVJQx2JuxKMW100TsPssyGfK\nCojwNNN6gr6DuuwVtDYl0C35dGSVPKIswq01B+V5/885Ip8k+bPJmUZUjR3jLR09\nTz43EGjcWDv3ME7ThjXbDEFhd6LeTX99vVH+K/bF6ryhcnzvBzLb0wEakeRckMHm\n8/WTc42lMDr2r/BheCj6gzTW55ldL+CNuoiiISmsr/gBxNVX0inFVs9ooKNJgMyd\nijC5Vennssj2sAZpt9Gkq/ea9KJPiGz0lBdvVvgIRu14cifErtkZGJUeR4j8/qN4\nnhn5hwQ5AgMBAAECggEAESNzi4n0W3C+j10N8XRGHcey+HRu2Q/w/aWwVrQiRG/m\nWOUcmzk9UnnVany97i6plm3IQJDCoobqEl9TnAWma8KOrTUCqgQusHKM4XlbH5Ep\nfZW2fUInua8ivjqtSeNlMQVthMwTTGXL+W0VF5VvjmDnxZ6iyAlYbwJAh3IxgERs\nwDu90hyj1BRmp7eEZWxJ7c2tX9Hf/vAFUIh63sMI+f+e0RwjYDVAvqTsDktVkvoN\nwptLvIkxfonUWxHZFiHZ+K+enfkWC99D0rZ9oCKDyXAuZVhOYT011oyVCNp6KJCg\nlSpb+OY1/DDCVUZGzGyJzzf4P3MxtAQsrO0upB8d7QKBgQDZVm+s7VpYyF2SM4BB\nYPGP/1CVewWLXAg8lBndN1x9FwCjzQZvdcOzf+g1n6JHh2cP+ZvN8fsHvvxJ7pUI\nJVSl3LHkgOuxaN7CD4qNTgRVbTMl7y+IqVDorjPOx6vz+x0LTetmf3LHBbLsQyUy\nhvmeGaa4JfKk3nd3q/QjohgN7QKBgQDCHG4RBNHh3ztZ4dc5AzfP36av9sDaqp0w\nKd9KnYrE1UPB/cjF282DY7ADf78+nIdZGnhkGYRXZ8TxW7K65ZahMd+fOjzHsveO\n45YQJqAclEQXchvLK6knVx1KBX3sAt2nA3Gh4AslRFFfTeX5lMJu9kA4Kzyv8L80\nGLDaHPYl/QKBgDo8oBYNT81Ee1ZGuJJMQM5eEqDLYzPxiD97S+bsA7t9I23A7X2G\nZ9c8aeOcj+Zs0OAF+YrY0XRE5+ODq6mQHzuGhKB/LyjNugr0ESNGCYE+jpsWmX0c\nKZL/wuAgvuHUova5fV9svTu5OjV21IvSgSatJvBnMrqc5hRKHlRCBgINAoGAH9G3\nPTT0DrmgKgi6Vg8v+/Rmh5vEW1Pydm22u619jOyEse0fF0gDtVEHDlvHhsTz7uhG\n6enA5u8Mup/UeYyfF4dsZ9aNFhNBP3wRIk6immy3iLxcz/41OUyvcW3bCXAi03je\nDLIEQbSkPiIv26zF/piBSHPV++VUAn81pltvAiUCgYB8R3Q4VclKMtGB3RMrepHG\nXB/InukXSyZuxM+tKzrdu0iyGFJoIUFu5MUdGu8liZcKInLvjaMKCwte/rnaJl0W\nYgRZq6F+7mjzTKSSarbm8wsXpEFW5+p58RUJJDUcGcbHd6NJeP9P7uXTkxf57W5f\n6vyTDIhnzpbP6DQVzfL7kA==\n-----END PRIVATE KEY-----\n",
          "client_email": "firebase-adminsdk-fbsvc@vibeme-bce95.iam.gserviceaccount.com"
        };
      }
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
