import { Module } from '@nestjs/common';
import { EventController } from './event.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { EventService } from './event.service';

@Module({
  imports: [PrismaModule],
  controllers: [EventController],
  providers: [EventService]
})
export class EventModule {}
