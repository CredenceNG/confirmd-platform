import { NestFactory } from '@nestjs/core';
import { HttpExceptionFilter } from 'libs/http-exception.filter';
import { Logger } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { WebhookModule } from '../src/webhook.module';
import { getNatsOptions } from '@credebl/common/nats.config';
import { CommonConstants } from '@credebl/common/common.constant';
import NestjsLoggerServiceAdapter from '@credebl/logger/nestjsLoggerServiceAdapter';

const logger = new Logger();

async function bootstrap(): Promise<void> {
  // Create HTTP application for external webhook endpoints
  const httpApp = await NestFactory.create(WebhookModule);
  httpApp.useLogger(httpApp.get(NestjsLoggerServiceAdapter));
  httpApp.useGlobalFilters(new HttpExceptionFilter());

  // Enable CORS for external webhook calls
  httpApp.enableCors({
    origin: '*', // Allow external agents to send webhooks
    methods: ['POST'],
    allowedHeaders: ['Content-Type']
  });

  // Start HTTP server for external webhooks
  const httpPort = process.env.WEBHOOK_PORT || 3020;
  await httpApp.listen(httpPort);
  logger.log(
    `🎣 Webhook-Service HTTP server listening on port ${httpPort} for external webhooks`
  );

  // Also create NATS microservice for internal communication
  const natsApp = await NestFactory.createMicroservice<MicroserviceOptions>(
    WebhookModule,
    {
      transport: Transport.NATS,
      options: getNatsOptions(
        CommonConstants.WEBHOOK_SERVICE,
        process.env.ISSUANCE_NKEY_SEED
      )
    }
  );
  natsApp.useLogger(natsApp.get(NestjsLoggerServiceAdapter));
  natsApp.useGlobalFilters(new HttpExceptionFilter());

  await natsApp.listen();
  logger.log(
    '🔗 Webhook-Service NATS microservice listening for internal communication'
  );
}
bootstrap();
