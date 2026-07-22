import { Module, forwardRef } from '@nestjs/common';
import { YoutubeService } from './youtube.service';
import { YoutubeController } from './youtube.controller';
import { MatchModule } from '../match/match.module';
import { LiveKitModule } from '../livekit/livekit.module';

@Module({
  imports: [forwardRef(() => MatchModule), forwardRef(() => LiveKitModule)],
  controllers: [YoutubeController],
  providers: [YoutubeService],
  exports: [YoutubeService],
})
export class YoutubeModule {}
