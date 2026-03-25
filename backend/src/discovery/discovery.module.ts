import { Module } from '@nestjs/common';
import { DiscoveryController } from './discovery.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [DiscoveryController],
})
export class DiscoveryModule {}
