import {
  Controller,
  Post,
  Body,
  Param,
  Logger,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { WebhookReceiverService } from './webhook-receiver.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhookReceiverController {
  private readonly logger = new Logger('WebhookReceiverController');

  constructor(private readonly webhookReceiverService: WebhookReceiverService) {
    this.logger.log(
      '🎣 WebhookReceiverController initialized - Ready to receive external webhook events'
    );
  }

  @Post('/connections')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive connection webhook events from external agents',
    description:
      'Endpoint for receiving DIDComm connection state change events from external agents/wallets'
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook event processed successfully'
  })
  async receiveConnectionWebhook(
    @Body() webhookData: any
  ): Promise<{ status: string }> {
    this.logger.log('🎯 === EXTERNAL CONNECTION WEBHOOK RECEIVED ===');
    this.logger.log(`📨 WEBHOOK_PAYLOAD: ${JSON.stringify(webhookData)}`);

    try {
      const result = await this.webhookReceiverService.processConnectionWebhook(webhookData);
      const response = { status: 'success' };
      this.logger.log(`📬 WEBHOOK_RESPONSE: ${JSON.stringify(response)}`);
      this.logger.log('✅ Connection webhook processed successfully');
      return response;
    } catch (error) {
      this.logger.error('❌ Connection webhook processing failed:', error);
      const errorResponse = { status: 'error' };
      this.logger.log(`📬 WEBHOOK_RESPONSE: ${JSON.stringify(errorResponse)}`);
      return errorResponse;
    }
  }

  @Post('/credentials')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive credential webhook events from external agents',
    description:
      'Endpoint for receiving DIDComm credential issuance/verification events from external agents/wallets'
  })
  async receiveCredentialWebhook(
    @Body() webhookData: any
  ): Promise<{ status: string }> {
    this.logger.log('🎓 === EXTERNAL CREDENTIAL WEBHOOK RECEIVED ===');
    this.logger.log(`📨 WEBHOOK_PAYLOAD: ${JSON.stringify(webhookData)}`);

    try {
      const result = await this.webhookReceiverService.processCredentialWebhook(webhookData);
      const response = { status: 'success' };
      this.logger.log(`📬 WEBHOOK_RESPONSE: ${JSON.stringify(response)}`);
      this.logger.log('✅ Credential webhook processed successfully');
      return response;
    } catch (error) {
      this.logger.error('❌ Credential webhook processing failed:', error);
      const errorResponse = { status: 'error' };
      this.logger.log(`📬 WEBHOOK_RESPONSE: ${JSON.stringify(errorResponse)}`);
      return errorResponse;
    }
  }

  @Post('/proofs')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive proof webhook events from external agents',
    description:
      'Endpoint for receiving DIDComm proof presentation events from external agents/wallets'
  })
  async receiveProofWebhook(
    @Body() webhookData: any
  ): Promise<{ status: string }> {
    this.logger.log('🔍 === EXTERNAL PROOF WEBHOOK RECEIVED ===');
    this.logger.log(`📨 WEBHOOK_PAYLOAD: ${JSON.stringify(webhookData)}`);

    try {
      const result = await this.webhookReceiverService.processProofWebhook(webhookData);
      const response = { status: 'success' };
      this.logger.log(`📬 WEBHOOK_RESPONSE: ${JSON.stringify(response)}`);
      this.logger.log('✅ Proof webhook processed successfully');
      return response;
    } catch (error) {
      this.logger.error('❌ Proof webhook processing failed:', error);
      const errorResponse = { status: 'error' };
      this.logger.log(`📬 WEBHOOK_RESPONSE: ${JSON.stringify(errorResponse)}`);
      return errorResponse;
    }
  }

  @Post('/basic-messages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive basic message webhook events from external agents',
    description:
      'Endpoint for receiving DIDComm basic message events from external agents/wallets'
  })
  async receiveBasicMessageWebhook(
    @Body() webhookData: any
  ): Promise<{ status: string }> {
    this.logger.log('💬 === EXTERNAL BASIC MESSAGE WEBHOOK RECEIVED ===');
    this.logger.log(`📨 WEBHOOK_PAYLOAD: ${JSON.stringify(webhookData)}`);

    try {
      const result = await this.webhookReceiverService.processBasicMessageWebhook(webhookData);
      const response = { status: 'success' };
      this.logger.log(`📬 WEBHOOK_RESPONSE: ${JSON.stringify(response)}`);
      this.logger.log('✅ Basic message webhook processed successfully');
      return response;
    } catch (error) {
      this.logger.error('❌ Basic message webhook processing failed:', error);
      const errorResponse = { status: 'error' };
      this.logger.log(`📬 WEBHOOK_RESPONSE: ${JSON.stringify(errorResponse)}`);
      return errorResponse;
    }
  }

  @Post('/question-answer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive question-answer webhook events from external agents',
    description:
      'Endpoint for receiving DIDComm question-answer protocol events from external agents/wallets'
  })
  async receiveQuestionAnswerWebhook(
    @Body() webhookData: any
  ): Promise<{ status: string }> {
    this.logger.log('❓ === EXTERNAL QUESTION-ANSWER WEBHOOK RECEIVED ===');
    this.logger.log(`📨 WEBHOOK_PAYLOAD: ${JSON.stringify(webhookData)}`);

    try {
      const result = await this.webhookReceiverService.processQuestionAnswerWebhook(
        webhookData
      );
      const response = { status: 'success' };
      this.logger.log(`📬 WEBHOOK_RESPONSE: ${JSON.stringify(response)}`);
      this.logger.log('✅ Question-answer webhook processed successfully');
      return response;
    } catch (error) {
      this.logger.error('❌ Question-answer webhook processing failed:', error);
      const errorResponse = { status: 'error' };
      this.logger.log(`📬 WEBHOOK_RESPONSE: ${JSON.stringify(errorResponse)}`);
      return errorResponse;
    }
  }

  @Post('/:orgId/connections')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive connection webhook events for specific organization',
    description:
      'Organization-specific endpoint for receiving DIDComm connection events'
  })
  @ApiParam({
    name: 'orgId',
    description: 'Organization ID',
    type: 'string'
  })
  async receiveOrgConnectionWebhook(
    @Param('orgId') orgId: string,
    @Body() webhookData: any
  ): Promise<{ status: string }> {
    this.logger.log(
      `🏢 === ORG-SPECIFIC CONNECTION WEBHOOK RECEIVED (${orgId}) ===`
    );
    const payload = { ...webhookData, orgId };
    this.logger.log(`📨 WEBHOOK_PAYLOAD: ${JSON.stringify(payload)}`);

    try {
      const result = await this.webhookReceiverService.processConnectionWebhook(payload);
      const response = { status: 'success' };
      this.logger.log(`📬 WEBHOOK_RESPONSE: ${JSON.stringify(response)}`);
      this.logger.log(
        '✅ Org-specific connection webhook processed successfully'
      );
      return response;
    } catch (error) {
      this.logger.error(
        '❌ Org-specific connection webhook processing failed:',
        error
      );
      const errorResponse = { status: 'error' };
      this.logger.log(`📬 WEBHOOK_RESPONSE: ${JSON.stringify(errorResponse)}`);
      return errorResponse;
    }
  }
}
