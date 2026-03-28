import { Module, OnModuleInit } from '@nestjs/common';
import { MongooseModule, InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { ChatModule } from './chat/chat.module';
import { BookingModule } from './booking/booking.module';
import { RatingsModule } from './ratings/ratings.module';
import { AdminModule } from './admin/admin.module';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    // Database
    MongooseModule.forRoot(
      process.env.MONGO_URI || 'mongodb+srv://azamali1001199_db_user:Azamali9319@cluster0.cwuhc7f.mongodb.net/rentme?retryWrites=true&w=majority',
      { autoIndex: true },
    ),

    // JWT — global so every module can inject JwtService
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'rentme-secret-key-2026',
      signOptions: { expiresIn: '7d' },
    }),

    // Rate Limiting — 60 requests per 60 seconds per IP
    // Rate Limiting — 200 req/min global (OTP endpoints have stricter per-endpoint limits)
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 200 }],
    }),

    // Feature modules
    AuthModule,
    UsersModule,
    DiscoveryModule,
    ChatModule,
    BookingModule,
    RatingsModule,
    AdminModule,
    PaymentsModule,
  ],
  providers: [
    // Apply rate limiting globally
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements OnModuleInit {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  onModuleInit() {
    this.connection.on('connected', () => {
      console.log('✅ MongoDB Connected successfully to database:', this.connection.db.databaseName);
    });
    this.connection.on('error', (err) => {
      console.error('❌ MongoDB Connection error:', err);
    });
  }
}
