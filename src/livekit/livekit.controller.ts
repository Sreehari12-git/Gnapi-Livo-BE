import { Body, Controller, Post } from '@nestjs/common';
import { LiveKitService } from './livekit.service';
import { GenerateTokenDto } from './dto/generate-token.dto';

@Controller('livekit')
export class LiveKitController {
  constructor(private readonly livekitService: LiveKitService) {}

  @Post('token')
  async generateToken(@Body() generateTokenDto: GenerateTokenDto) {
    return this.livekitService.generateToken(generateTokenDto);
  }
}
