import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { EventService } from './event/event.service';
import { EventModule } from './event/event.module';
import { LiveKitModule } from './livekit/livekit.module';
import { MatchModule } from './match/match.module';
import { YoutubeModule } from './youtube/youtube.module';
import { PaymentModule } from './payment/payment.module';
import { UsageModule } from './usage/usage.module';

@Module({
  imports: [
    AuthModule,
    EventModule,
    LiveKitModule,
    MatchModule,
    YoutubeModule,
    PaymentModule,
    UsageModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
