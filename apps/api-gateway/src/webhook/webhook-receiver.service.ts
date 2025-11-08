import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { WebhookDeliveryService } from './webhook-delivery.service';

@Injectable()
export class WebhookReceiverService {
  private readonly logger = new Logger('WebhookReceiverService');

  constructor(
    @Inject('NATS_CLIENT') private readonly natsClient: ClientProxy,
    private readonly webhookDeliveryService: WebhookDeliveryService
  ) {
    this.logger.log('🎣 WebhookReceiverService initialized');
  }

  async processConnectionWebhook(webhookData: Record<string, unknown>): Promise<unknown> {
    this.logger.log('🔗 === PROCESSING CONNECTION WEBHOOK ===');
    this.logger.log(`📊 Connection State: ${webhookData.state || 'unknown'}`);
    this.logger.log(`🆔 Connection ID: ${webhookData.id || webhookData.connectionId || 'unknown'}`);
    this.logger.log(`� WEBHOOK_PAYLOAD: ${JSON.stringify(webhookData)}`);

    try {
      // Transform webhook data into the format expected by connection service
      const connectionPayload = this.transformWebhookToConnectionPayload(webhookData);

      this.logger.log(`🔄 Transformed Payload: ${JSON.stringify(connectionPayload)}`);

      // Forward the webhook to the connection service for processing
      const result = await this.natsClient.send({ cmd: 'webhook-get-connection' }, connectionPayload).toPromise();

      this.logger.log('✅ Connection webhook forwarded to connection service successfully');

      // Extract tenantId from webhook data
      const tenantId = webhookData.contextCorrelationId || webhookData.tenantId;

      if (tenantId && 'string' === typeof tenantId) {
        // Deliver to org apps (outbound webhook)
        await this.webhookDeliveryService.deliverToOrgApps('Connection', tenantId, webhookData);
      } else {
        this.logger.warn('⚠️ No tenantId found in webhook data, skipping org app delivery');
      }

      return result;
    } catch (error) {
      this.logger.error('❌ Failed to process connection webhook:', error);
      throw error;
    }
  }

  /**
   * Transform raw webhook data into ICreateConnection format
   */
  private transformWebhookToConnectionPayload(webhookData: Record<string, unknown>): Record<string, unknown> {
    this.logger.log('🔄 === WEBHOOK PAYLOAD TRANSFORMATION ===');
    this.logger.log(`📋 Raw webhook data: ${JSON.stringify(webhookData, null, 2)}`);

    // Extract orgId from webhook data - this might come in different formats
    // depending on how the webhook is configured
    let orgId = webhookData.orgId || webhookData.organizationId || webhookData.org_id;

    // Log the contextCorrelationId for debugging
    this.logger.log(`🔍 contextCorrelationId: ${webhookData.contextCorrelationId}`);

    // If orgId is not in webhook data, we need to derive it
    // The contextCorrelationId is actually the tenant ID from the agent
    if (!orgId && webhookData.contextCorrelationId && 'default' !== webhookData.contextCorrelationId) {
      // contextCorrelationId is the tenant ID - we need to map it to orgId
      orgId = webhookData.contextCorrelationId;
      this.logger.log(`🔗 Using contextCorrelationId as orgId: ${orgId}`);
    }

    // If still no orgId, this is a problem - log and use a default
    if (!orgId || 'unknown-org' === orgId) {
      this.logger.warn('⚠️ No valid orgId found in webhook data');
      this.logger.warn(`⚠️ Available fields: ${Object.keys(webhookData).join(', ')}`);
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
      createDateTime: webhookData.createDateTime || webhookData.createdAt || new Date().toISOString(),
      lastChangedDateTime: webhookData.lastChangedDateTime || webhookData.updatedAt || new Date().toISOString(),
      id: connectionId,
      connectionId, // Ensure both id and connectionId are set
      state: webhookData.state || 'unknown',
      imageUrl: webhookData.imageUrl || webhookData.image_url || '',
      orgDid: webhookData.orgDid || webhookData.did || webhookData.myDid,
      theirLabel: webhookData.theirLabel || webhookData.their_label || webhookData.alias || 'Unknown',
      autoAcceptConnection: webhookData.autoAcceptConnection !== undefined ? webhookData.autoAcceptConnection : true,
      outOfBandId: webhookData.outOfBandId || webhookData.outbound_id || webhookData.invitation_msg_id || '',
      orgId,
      contextCorrelationId: webhookData.contextCorrelationId || webhookData.context_correlation_id || '',
      // Add required fields for database validation - ensure they're never undefined
      createdBy: webhookData.createdBy || 'system-webhook',
      lastChangedBy: webhookData.lastChangedBy || 'system-webhook'
    };

    return {
      connectionDto,
      orgId
    };
  }

  async processCredentialWebhook(webhookData: Record<string, unknown>): Promise<unknown> {
    this.logger.log('🎓 === PROCESSING CREDENTIAL WEBHOOK ===');
    this.logger.log(`📊 Credential State: ${webhookData.state || 'unknown'}`);

    try {
      // Forward to issuance service for webhook event processing
      const result = await this.natsClient.send({ cmd: 'webhook-credential-received' }, webhookData).toPromise();

      this.logger.log('✅ Credential webhook processed successfully');

      // Extract tenantId from webhook data
      const tenantId = webhookData.contextCorrelationId || webhookData.tenantId;

      if (tenantId && 'string' === typeof tenantId) {
        // Deliver to org apps (outbound webhook)
        await this.webhookDeliveryService.deliverToOrgApps('Credential', tenantId, webhookData);
      } else {
        this.logger.warn('⚠️ No tenantId found in webhook data, skipping org app delivery');
      }

      return result;
    } catch (error) {
      this.logger.error('❌ Failed to process credential webhook:', error);
      throw error;
    }
  }

  async processProofWebhook(webhookData: Record<string, unknown>): Promise<unknown> {
    this.logger.log('🔍 === PROCESSING PROOF WEBHOOK ===');
    this.logger.log(`📊 Proof State: ${webhookData.state || 'unknown'}`);
    this.logger.log(`🆔 Proof ID: ${webhookData.id || webhookData.proofId || webhookData.proof_id || 'unknown'}`);
    this.logger.log(`🔗 Connection ID: ${webhookData.connectionId || webhookData.connection_id || 'unknown'}`);
    this.logger.log(`🧵 Thread ID: ${webhookData.threadId || webhookData.thread_id || 'unknown'}`);
    this.logger.log(`📦 Full Payload Keys: ${Object.keys(webhookData).join(', ')}`);

    try {
      // Forward to verification service for webhook event processing
      const result = await this.natsClient.send({ cmd: 'webhook-proof-received' }, webhookData).toPromise();

      this.logger.log('✅ Proof webhook forwarded to verification service successfully');

      // Extract tenantId from webhook data with multiple fallback options
      const tenantId = webhookData.contextCorrelationId || webhookData.tenantId || webhookData.tenant_id;

      this.logger.log(
        `🔍 TenantId extraction: contextCorrelationId=${webhookData.contextCorrelationId}, tenantId=${webhookData.tenantId}, tenant_id=${webhookData.tenant_id}`
      );

      if (tenantId && 'string' === typeof tenantId) {
        this.logger.log(`✅ TenantId found: ${tenantId}, proceeding with org app delivery`);
        // Deliver to org apps (outbound webhook)
        await this.webhookDeliveryService.deliverToOrgApps('Proof', tenantId, webhookData);
      } else {
        this.logger.warn('⚠️ No tenantId found in webhook data, skipping org app delivery');
        this.logger.warn(`⚠️ Available webhook fields: ${JSON.stringify(Object.keys(webhookData))}`);
        this.logger.warn(`⚠️ Full webhook payload for debugging: ${JSON.stringify(webhookData)}`);
      }

      return result;
    } catch (error) {
      this.logger.error('❌ Failed to process proof webhook:', error);
      throw error;
    }
  }

  async processBasicMessageWebhook(webhookData: Record<string, unknown>): Promise<unknown> {
    this.logger.log('💬 === PROCESSING BASIC MESSAGE WEBHOOK ===');

    try {
      // Forward to connection service
      const result = await this.natsClient.send({ cmd: 'webhook-basic-message-received' }, webhookData).toPromise();

      this.logger.log('✅ Basic message webhook processed successfully');
      return result;
    } catch (error) {
      this.logger.error('❌ Failed to process basic message webhook:', error);
      throw error;
    }
  }

  async processQuestionAnswerWebhook(webhookData: Record<string, unknown>): Promise<unknown> {
    this.logger.log('❓ === PROCESSING QUESTION-ANSWER WEBHOOK ===');

    try {
      // Forward to connection service
      const result = await this.natsClient.send({ cmd: 'webhook-question-answer-received' }, webhookData).toPromise();

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
  async processWebhookEvent(webhookData: Record<string, unknown>): Promise<unknown> {
    this.logger.log('🎯 === GENERAL WEBHOOK EVENT PROCESSING ===');
    this.logger.log(`📋 Webhook Type Detection - Available fields: ${Object.keys(webhookData).join(', ')}`);
    this.logger.log(`📋 Webhook State: ${webhookData.state || 'N/A'}`);
    this.logger.log(`� WEBHOOK_PAYLOAD: ${JSON.stringify(webhookData)}`);

    try {
      // Check for proof-related webhook FIRST with comprehensive detection
      // This needs to be before credential check because some states overlap
      const isProofWebhook =
        webhookData.proofId ||
        webhookData.proof_id ||
        webhookData.presentation ||
        webhookData.proofExchangeId ||
        webhookData.proof_exchange_id ||
        webhookData.presentationExchangeId ||
        webhookData.presentation_exchange_id ||
        // Check for proof-specific state values
        (webhookData.state &&
          'string' === typeof webhookData.state &&
          ((webhookData.state.includes('request') && webhookData.state.includes('sent')) ||
            (webhookData.state.includes('request') && webhookData.state.includes('received')) ||
            webhookData.state.includes('presentation') ||
            webhookData.state.includes('proposal') ||
            ('done' === webhookData.state && (webhookData.threadId || webhookData.thread_id)))) ||
        // Check metadata for proof/presentation indicators
        (webhookData.metadata &&
          (webhookData.metadata['_anoncreds/presentation'] || webhookData.metadata['presentationExchange']));

      if (isProofWebhook) {
        this.logger.log('✅ Detected as PROOF webhook');
        return await this.processProofWebhook(webhookData);
      }

      // Determine webhook type based on the data structure
      if (
        webhookData.credentialId ||
        webhookData.credential_id ||
        webhookData.credentialAttributes ||
        webhookData.credentialExchangeId ||
        (webhookData.metadata && webhookData.metadata['_anoncreds/credential']) ||
        (webhookData.state &&
          'string' === typeof webhookData.state &&
          (webhookData.state.includes('offer') ||
            webhookData.state.includes('credential') ||
            webhookData.state.includes('issued')) &&
          (webhookData.threadId || webhookData.thread_id))
      ) {
        // Credential-related webhook
        this.logger.log('✅ Detected as CREDENTIAL webhook');
        return await this.processCredentialWebhook(webhookData);
      } else if (
        webhookData.connectionId ||
        webhookData.connection_id ||
        (webhookData.state &&
          'string' === typeof webhookData.state &&
          (webhookData.state.includes('invitation') ||
            webhookData.state.includes('request') ||
            webhookData.state.includes('response') ||
            webhookData.state.includes('complete')))
      ) {
        // Connection-related webhook
        this.logger.log('✅ Detected as CONNECTION webhook');
        return await this.processConnectionWebhook(webhookData);
      } else if (webhookData.questionText || webhookData.question_text) {
        // Question-answer webhook
        this.logger.log('✅ Detected as QUESTION-ANSWER webhook');
        return await this.processQuestionAnswerWebhook(webhookData);
      } else {
        // Default to basic message or connection webhook
        this.logger.warn('⚠️ Unknown webhook type, defaulting to connection processing');
        this.logger.warn(`⚠️ Webhook payload for investigation: ${JSON.stringify(webhookData, null, 2)}`);
        return await this.processConnectionWebhook(webhookData);
      }
    } catch (error) {
      this.logger.error('❌ Failed to process webhook event:', error);
      throw error;
    }
  }
}
