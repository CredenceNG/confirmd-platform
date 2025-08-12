import {
  Controller,
  Logger,
  Post,
  Body,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { WebhookService } from './webhook.service';
import {
  ICreateWebhookUrl,
  IGetWebhookUrl,
  IWebhookDto
} from '../interfaces/webhook.interfaces';
import { IWebhookUrl } from '@credebl/common/interfaces/webhook.interface';

@Controller()
export class WebhookController {
  private readonly logger = new Logger('webhookService');
  constructor(private readonly webhookService: WebhookService) {}

  // ========== NATS-based endpoints for internal communication ==========

  @MessagePattern({ cmd: 'register-webhook' })
  async registerWebhook(payload: {
    registerWebhookDto: IWebhookDto;
  }): Promise<ICreateWebhookUrl> {
    return this.webhookService.registerWebhook(payload.registerWebhookDto);
  }

  @MessagePattern({ cmd: 'get-webhookurl' })
  async getWebhookUrl(payload: IWebhookUrl): Promise<IGetWebhookUrl> {
    return this.webhookService.getWebhookUrl(payload);
  }

  @MessagePattern({ cmd: 'post-webhook-response-to-webhook-url' })
  async webhookResponse(payload: {
    webhookUrl: string;
    data: object;
  }): Promise<object> {
    return this.webhookService.webhookResponse(
      payload.webhookUrl,
      payload.data
    );
  }

  // ========== HTTP endpoints for external webhook events ==========

  @Post('/connections')
  @HttpCode(HttpStatus.OK)
  async receiveConnectionWebhook(
    @Body() webhookData: object
  ): Promise<{ status: string }> {
    this.logger.log('🎯 === EXTERNAL CONNECTION WEBHOOK RECEIVED ===');
    this.logger.log(
      `📨 Connection Event: ${JSON.stringify(webhookData, null, 2)}`
    );

    try {
      // Process the connection webhook data here
      // This is where we'll integrate with the connection service
      await this.webhookService.processExternalConnectionWebhook(webhookData);
      this.logger.log('✅ External connection webhook processed successfully');
      return { status: 'success' };
    } catch (error) {
      this.logger.error(
        '❌ External connection webhook processing failed:',
        error
      );
      return { status: 'error' };
    }
  }

  @Post('/credentials')
  @HttpCode(HttpStatus.OK)
  async receiveCredentialWebhook(
    @Body() webhookData: object
  ): Promise<{ status: string }> {
    this.logger.log('🎓 === EXTERNAL CREDENTIAL WEBHOOK RECEIVED ===');
    this.logger.log(
      `📨 Credential Event: ${JSON.stringify(webhookData, null, 2)}`
    );

    try {
      await this.webhookService.processExternalCredentialWebhook(webhookData);
      this.logger.log('✅ External credential webhook processed successfully');
      return { status: 'success' };
    } catch (error) {
      this.logger.error(
        '❌ External credential webhook processing failed:',
        error
      );
      return { status: 'error' };
    }
  }

  @Post('/proofs')
  @HttpCode(HttpStatus.OK)
  async receiveProofWebhook(
    @Body() webhookData: object
  ): Promise<{ status: string }> {
    this.logger.log('🔍 === EXTERNAL PROOF WEBHOOK RECEIVED ===');
    this.logger.log(`📨 Proof Event: ${JSON.stringify(webhookData, null, 2)}`);

    try {
      await this.webhookService.processExternalProofWebhook(webhookData);
      this.logger.log('✅ External proof webhook processed successfully');
      return { status: 'success' };
    } catch (error) {
      this.logger.error('❌ External proof webhook processing failed:', error);
      return { status: 'error' };
    }
  }

  @Post('/basic-messages')
  @HttpCode(HttpStatus.OK)
  async receiveBasicMessageWebhook(
    @Body() webhookData: object
  ): Promise<{ status: string }> {
    this.logger.log('💬 === EXTERNAL BASIC MESSAGE WEBHOOK RECEIVED ===');
    this.logger.log(
      `📨 Basic Message Event: ${JSON.stringify(webhookData, null, 2)}`
    );

    try {
      await this.webhookService.processExternalBasicMessageWebhook(webhookData);
      this.logger.log(
        '✅ External basic message webhook processed successfully'
      );
      return { status: 'success' };
    } catch (error) {
      this.logger.error(
        '❌ External basic message webhook processing failed:',
        error
      );
      return { status: 'error' };
    }
  }

  @Post('/question-answer')
  @HttpCode(HttpStatus.OK)
  async receiveQuestionAnswerWebhook(
    @Body() webhookData: object
  ): Promise<{ status: string }> {
    this.logger.log('❓ === EXTERNAL QUESTION-ANSWER WEBHOOK RECEIVED ===');
    this.logger.log(
      `📨 Question-Answer Event: ${JSON.stringify(webhookData, null, 2)}`
    );

    try {
      await this.webhookService.processExternalQuestionAnswerWebhook(
        webhookData
      );
      this.logger.log(
        '✅ External question-answer webhook processed successfully'
      );
      return { status: 'success' };
    } catch (error) {
      this.logger.error(
        '❌ External question-answer webhook processing failed:',
        error
      );
      return { status: 'error' };
    }
  }
}
