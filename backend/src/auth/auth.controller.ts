import { Controller, Post, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SendOtpDto, VerifyOtpDto, VerifyFirebaseDto } from '../common/dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-otp')
  // @Throttle({ default: { ttl: 60000, limit: 3 } })
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto.phoneNumber);
  }

  @Post('verify-otp')
  // @Throttle({ default: { ttl: 60000, limit: 10 } })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.phoneNumber, dto.otp);
  }

  @Post('verify-firebase')
  async verifyFirebase(@Body() dto: VerifyFirebaseDto) {
    return this.authService.verifyFirebaseOtp(dto.idToken);
  }
}
