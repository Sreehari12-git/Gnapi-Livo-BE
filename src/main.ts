import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Capture raw body for LiveKit webhooks (Content-Type: application/webhook+json)
  app.use(
    '/livekit/webhook',
    express.raw({ type: 'application/webhook+json' }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
