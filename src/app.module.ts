import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { EventService } from './event/event.service';
import { EventModule } from './event/event.module';
import { LiveKitModule } from './livekit/livekit.module';

@Module({
  imports: [AuthModule, EventModule, LiveKitModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
