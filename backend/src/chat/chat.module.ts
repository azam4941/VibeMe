import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { Message, MessageSchema, ChatRoom, ChatRoomSchema } from './chat.schema';
import { UsersModule } from '../users/users.module';

import { ModerationService } from '../common/moderation.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: ChatRoom.name, schema: ChatRoomSchema },
    ]),
    UsersModule,
  ],
  controllers: [ChatController],
  providers: [ChatGateway, ChatService, ModerationService],
  exports: [ChatService],
})
export class ChatModule {}
