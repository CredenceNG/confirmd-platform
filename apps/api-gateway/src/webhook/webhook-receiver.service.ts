import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class WebhookReceiverService {
  private readonly logger = new Logger('WebhookReceiverService');

  constructor(@Inject('NATS_CLIENT') private readonly natsClient: ClientProxy) {
    this.logger.log('🎣 WebhookReceiverService initialized');
  }

  async processConnectionWebhook(webhookData: any): Promise<void> {
    this.logger.log('🔗 === PROCESSING CONNECTION WEBHOOK ===');
    this.logger.log(`📊 Connection State: ${webhookData.state || 'unknown'}`);
    this.logger.log(
      `🆔 Connection ID: ${
        webhookData.id || webhookData.connectionId || 'unknown'
      }`
    );
    this.logger.log(
      `📦 Raw Webhook Data: ${JSON.stringify(webhookData, null, 2)}`
    );

    try {
      // Transform webhook data into the format expected by connection service
      const connectionPayload =
        this.transformWebhookToConnectionPayload(webhookData);

      this.logger.log(
        `🔄 Transformed Payload: ${JSON.stringify(connectionPayload, null, 2)}`
      );

      // Forward the webhook to the connection service for processing
      const result = await this.natsClient
        .send({ cmd: 'webhook-get-connection' }, connectionPayload)
        .toPromise();

      this.logger.log(
        '✅ Connection webhook forwarded to connection service successfully'
      );
      return result;
    } catch (error) {
      this.logger.error('❌ Failed to process connection webhook:', error);
      throw error;
    }
  }

  /**
   * Transform raw webhook data into ICreateConnection format
   */
  private transformWebhookToConnectionPayload(webhookData: any): any {
    this.logger.log('🔄 === WEBHOOK PAYLOAD TRANSFORMATION ===');
    this.logger.log(
      `📋 Raw webhook data: ${JSON.stringify(webhookData, null, 2)}`
    );

    // Extract orgId from webhook data - this might come in different formats
    // depending on how the webhook is configured
    let orgId =
      webhookData.orgId || webhookData.organizationId || webhookData.org_id;

    // Log the contextCorrelationId for debugging
    this.logger.log(
      `🔍 contextCorrelationId: ${webhookData.contextCorrelationId}`
    );

    // If orgId is not in webhook data, we need to derive it
    // The contextCorrelationId is actually the tenant ID from the agent
    if (
      !orgId &&
      webhookData.contextCorrelationId &&
      'default' !== webhookData.contextCorrelationId
    ) {
      // contextCorrelationId is the tenant ID - we need to map it to orgId
      orgId = webhookData.contextCorrelationId;
      this.logger.log(`🔗 Using contextCorrelationId as orgId: ${orgId}`);
    }

    // If still no orgId, this is a problem - log and use a default
    if (!orgId || 'unknown-org' === orgId) {
      this.logger.warn('⚠️ No valid orgId found in webhook data');
      this.logger.warn(
        `⚠️ Available fields: ${Object.keys(webhookData).join(', ')}`
      );
      // Set to null so the repository can handle the lookup properly
      orgId = null;
    }

    // Generate a unique connection ID if not provided
    const connectionId = webhookData.id || webhookData.connectionId || webhookData.connection_id;
    
    // Log warning if no connection ID is found
    if (!connectionId) {
      this.logger.warn('⚠️ No connectionId found in webhook data - this may cause database issues');
      this.logger.warn(`⚠️ Webhook data keys: ${Object.keys(webhookData).join(', ')}`);
    }

    const connectionDto = {
      createDateTime:
        webhookData.createDateTime ||
        webhookData.createdAt ||
        new Date().toISOString(),
      lastChangedDateTime:
        webhookData.lastChangedDateTime ||
        webhookData.updatedAt ||
        new Date().toISOString(),
      id: connectionId,
      connectionId: connectionId, // Ensure both id and connectionId are set
      state: webhookData.state || 'unknown',
      imageUrl: webhookData.imageUrl || webhookData.image_url || '',
      orgDid: webhookData.orgDid || webhookData.did || webhookData.myDid,
      theirLabel:
        webhookData.theirLabel ||
        webhookData.their_label ||
        webhookData.alias ||
        'Unknown',
      autoAcceptConnection:
        webhookData.autoAcceptConnection !== undefined
          ? webhookData.autoAcceptConnection
          : true,
      outOfBandId:
        webhookData.outOfBandId ||
        webhookData.outbound_id ||
        webhookData.invitation_msg_id ||
        '',
      orgId,
      contextCorrelationId:
        webhookData.contextCorrelationId ||
        webhookData.context_correlation_id ||
        '',
      // Add required fields for database validation - ensure they're never undefined
      createdBy: webhookData.createdBy || 'system-webhook',
      lastChangedBy: webhookData.lastChangedBy || 'system-webhook'
    };

    return {
      connectionDto,
      orgId
    };
  }

  async processCredentialWebhook(webhookData: any): Promise<void> {
    this.logger.log('🎓 === PROCESSING CREDENTIAL WEBHOOK ===');
    this.logger.log(`📊 Credential State: ${webhookData.state || 'unknown'}`);

    try {
      // Forward to issuance service for webhook event processing
      const result = await this.natsClient
        .send({ cmd: 'webhook-credential-received' }, webhookData)
        .toPromise();

      this.logger.log('✅ Credential webhook processed successfully');
      return result;
    } catch (error) {
      this.logger.error('❌ Failed to process credential webhook:', error);
      throw error;
    }
  }

  async processProofWebhook(webhookData: any): Promise<void> {
    this.logger.log('🔍 === PROCESSING PROOF WEBHOOK ===');
    this.logger.log(`📊 Proof State: ${webhookData.state || 'unknown'}`);

    try {
      // Forward to verification service for webhook event processing
      const result = await this.natsClient
        .send({ cmd: 'webhook-proof-received' }, webhookData)
        .toPromise();

      this.logger.log('✅ Proof webhook processed successfully');
      return result;
    } catch (error) {
      this.logger.error('❌ Failed to process proof webhook:', error);
      throw error;
    }
  }

  async processBasicMessageWebhook(webhookData: any): Promise<void> {
    this.logger.log('💬 === PROCESSING BASIC MESSAGE WEBHOOK ===');

    try {
      // Forward to connection service
      const result = await this.natsClient
        .send({ cmd: 'webhook-basic-message-received' }, webhookData)
        .toPromise();

      this.logger.log('✅ Basic message webhook processed successfully');
      return result;
    } catch (error) {
      this.logger.error('❌ Failed to process basic message webhook:', error);
      throw error;
    }
  }

  async processQuestionAnswerWebhook(webhookData: any): Promise<void> {
    this.logger.log('❓ === PROCESSING QUESTION-ANSWER WEBHOOK ===');

    try {
      // Forward to connection service
      const result = await this.natsClient
        .send({ cmd: 'webhook-question-answer-received' }, webhookData)
        .toPromise();

      this.logger.log('✅ Question-answer webhook processed successfully');
      return result;
    } catch (error) {
      this.logger.error('❌ Failed to process question-answer webhook:', error);
      throw error;
    }
  }

  /**
   * Main webhook processing method that routes to specific handlers
   */
  async processWebhookEvent(webhookData: any): Promise<any> {
    this.logger.log('🎯 === GENERAL WEBHOOK EVENT PROCESSING ===');
    this.logger.log(`📦 Webhook Data: ${JSON.stringify(webhookData, null, 2)}`);

    try {
      // Determine webhook type based on the data structure
      if (
        webhookData.credentialId ||
        webhookData.credential_id ||
        webhookData.credentialAttributes ||
        webhookData.credentialExchangeId ||
        (webhookData.metadata &&
          webhookData.metadata['_anoncreds/credential']) ||
        (webhookData.state &&
          (webhookData.state.includes('offer') ||
            webhookData.state.includes('credential') ||
            webhookData.state.includes('issued') ||
            'done' === webhookData.state) &&
          (webhookData.threadId || webhookData.thread_id))
      ) {
        // Credential-related webhook
        return await this.processCredentialWebhook(webhookData);
      } else if (
        webhookData.connectionId ||
        webhookData.connection_id ||
        (webhookData.state && !webhookData.credentialAttributes)
      ) {
        // Connection-related webhook
        return await this.processConnectionWebhook(webhookData);
      } else if (
        webhookData.proofId ||
        webhookData.proof_id ||
        webhookData.presentation
      ) {
        // Proof-related webhook
        return await this.processProofWebhook(webhookData);
      } else if (webhookData.questionText || webhookData.question_text) {
        // Question-answer webhook
        return await this.processQuestionAnswerWebhook(webhookData);
      } else {
        // Default to basic message or connection webhook
        this.logger.log(
          '🔄 Unknown webhook type, defaulting to connection processing'
        );
        return await this.processConnectionWebhook(webhookData);
      }
    } catch (error) {
      this.logger.error('❌ Failed to process webhook event:', error);
      throw error;
    }
  }
}
