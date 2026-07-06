import { Module } from '@nestjs/common';
import { MatchController } from './match.controller';
import { MatchService } from './match.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { LiveKitModule } from 'src/livekit/livekit.module';

@Module({
  imports: [PrismaModule, LiveKitModule],
  controllers: [MatchController],
  providers: [MatchService],
  exports: [MatchService],
})
export class MatchModule {}
