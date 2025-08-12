import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

// Real DIDComm Webhook Service for Mobile Wallet Integration
export interface DIDCommWebhookPayload {
  '@id': string;
  '@type': string;
  connectionId?: string;
  threadId?: string;
  state?: string;
  role?: string;
  orgId?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface MobileConnectionEvent {
  eventType:
    | 'connection-invitation'
    | 'connection-request'
    | 'connection-response'
    | 'connection-completed'
    | 'connection-error';
  connectionId: string;
  orgId: string;
  userId?: string;
  deviceId?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  [key: string]: unknown;
}

export interface MobileCredentialEvent {
  eventType:
    | 'credential-offer'
    | 'credential-request'
    | 'credential-issue'
    | 'credential-received'
    | 'credential-error';
  credentialExchangeId: string;
  connectionId: string;
  orgId: string;
  credentialDefinitionId?: string;
  attributes?: Record<string, string>;
  timestamp: string;
  [key: string]: unknown;
}

export interface MobileProofEvent {
  eventType:
    | 'proof-request'
    | 'proof-presentation'
    | 'proof-verified'
    | 'proof-error';
  proofExchangeId: string;
  connectionId: string;
  orgId: string;
  proofName?: string;
  requestedAttributes?: Record<string, unknown>;
  timestamp: string;
  [key: string]: unknown;
}

@Injectable()
export class RealDIDCommWebhookService {
  private readonly logger = new Logger(RealDIDCommWebhookService.name);
  private readonly pendingConnections: Map<string, MobileConnectionEvent> =
    new Map();
  private readonly activeConnections: Map<string, string> = new Map(); // connectionId -> userId

  constructor(@Inject('NATS_CLIENT') private readonly natsClient: ClientProxy) {
    this.logger.log('Real DIDComm Webhook Service initialized');
  }

  /**
   * Process real DIDComm webhook from mobile wallet
   */
  public async processWebhook(payload: DIDCommWebhookPayload): Promise<void> {
    try {
      this.logger.log('Processing real DIDComm webhook:', {
        type: payload['@type'],
        id: payload['@id'],
        connectionId: payload.connectionId,
        state: payload.state
      });

      // Route to appropriate handler based on message type
      if (payload['@type'].includes('connections')) {
        await this.handleConnectionWebhook(payload);
      } else if (payload['@type'].includes('issue-credential')) {
        await this.handleCredentialWebhook(payload);
      } else if (payload['@type'].includes('present-proof')) {
        await this.handleProofWebhook(payload);
      } else if (payload['@type'].includes('trust_ping')) {
        await this.handleTrustPingWebhook(payload);
      } else {
        this.logger.warn(`Unhandled webhook type: ${payload['@type']}`);
      }

      // Emit general webhook processed event
      await this.emitWebhookEvent('webhook-processed', {
        payload,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Failed to process DIDComm webhook:', error);

      // Emit webhook error event
      await this.emitWebhookEvent('webhook-error', {
        payload,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle connection protocol webhooks
   */
  private async handleConnectionWebhook(
    payload: DIDCommWebhookPayload
  ): Promise<void> {
    try {
      const { connectionId } = payload;
      if (!connectionId) {
        this.logger.warn('Connection webhook missing connectionId');
        return;
      }

      let eventType: MobileConnectionEvent['eventType'];

      // Determine event type based on message type and state
      if (payload['@type'].includes('invitation')) {
        eventType = 'connection-invitation';
      } else if (payload['@type'].includes('request')) {
        eventType = 'connection-request';
      } else if (payload['@type'].includes('response')) {
        eventType = 'connection-response';
      } else if ('completed' === payload.state || 'active' === payload.state) {
        eventType = 'connection-completed';
      } else {
        eventType = 'connection-error';
      }

      const connectionEvent: MobileConnectionEvent = {
        eventType,
        connectionId,
        orgId: payload.orgId || 'unknown',
        userId: this.extractUserIdFromMetadata(payload.metadata),
        deviceId: this.extractDeviceIdFromMetadata(payload.metadata),
        metadata: payload.metadata,
        timestamp: payload.timestamp
      };

      // Store connection for tracking
      if ('connection-completed' === eventType && connectionEvent.userId) {
        this.activeConnections.set(connectionId, connectionEvent.userId);
      }

      this.logger.log(`Connection event: ${eventType}`, {
        connectionId,
        state: payload.state,
        orgId: connectionEvent.orgId
      });

      // Emit connection event for mobile services
      await this.emitWebhookEvent('mobile-connection', connectionEvent);

      // Trigger push notification if appropriate
      if ('connection-completed' === eventType) {
        await this.triggerConnectionNotification(connectionEvent);
      }
    } catch (error) {
      this.logger.error('Failed to handle connection webhook:', error);
    }
  }

  /**
   * Handle credential protocol webhooks
   */
  private async handleCredentialWebhook(
    payload: DIDCommWebhookPayload
  ): Promise<void> {
    try {
      const { connectionId } = payload;
      if (!connectionId) {
        this.logger.warn('Credential webhook missing connectionId');
        return;
      }

      let eventType: MobileCredentialEvent['eventType'];

      // Determine event type based on message type
      if (payload['@type'].includes('offer-credential')) {
        eventType = 'credential-offer';
      } else if (payload['@type'].includes('request-credential')) {
        eventType = 'credential-request';
      } else if (payload['@type'].includes('issue-credential')) {
        eventType = 'credential-issue';
      } else if (
        'done' === payload.state ||
        'credential-received' === payload.state
      ) {
        eventType = 'credential-received';
      } else {
        eventType = 'credential-error';
      }

      const credentialEvent: MobileCredentialEvent = {
        eventType,
        credentialExchangeId: payload.threadId || payload['@id'],
        connectionId,
        orgId: payload.orgId || 'unknown',
        credentialDefinitionId: this.extractCredDefIdFromMetadata(
          payload.metadata
        ),
        attributes: this.extractAttributesFromMetadata(payload.metadata),
        timestamp: payload.timestamp
      };

      this.logger.log(`Credential event: ${eventType}`, {
        connectionId,
        credentialExchangeId: credentialEvent.credentialExchangeId,
        orgId: credentialEvent.orgId
      });

      // Emit credential event
      await this.emitWebhookEvent('mobile-credential', credentialEvent);

      // Trigger push notification for credential events
      if (
        'credential-offer' === eventType ||
        'credential-received' === eventType
      ) {
        await this.triggerCredentialNotification(credentialEvent);
      }
    } catch (error) {
      this.logger.error('Failed to handle credential webhook:', error);
    }
  }

  /**
   * Handle proof protocol webhooks
   */
  private async handleProofWebhook(
    payload: DIDCommWebhookPayload
  ): Promise<void> {
    try {
      const { connectionId } = payload;
      if (!connectionId) {
        this.logger.warn('Proof webhook missing connectionId');
        return;
      }

      let eventType: MobileProofEvent['eventType'];

      // Determine event type based on message type
      if (payload['@type'].includes('request-presentation')) {
        eventType = 'proof-request';
      } else if (payload['@type'].includes('presentation')) {
        eventType = 'proof-presentation';
      } else if ('verified' === payload.state || 'done' === payload.state) {
        eventType = 'proof-verified';
      } else {
        eventType = 'proof-error';
      }

      const proofEvent: MobileProofEvent = {
        eventType,
        proofExchangeId: payload.threadId || payload['@id'],
        connectionId,
        orgId: payload.orgId || 'unknown',
        proofName: this.extractProofNameFromMetadata(payload.metadata),
        requestedAttributes: this.extractRequestedAttributesFromMetadata(
          payload.metadata
        ),
        timestamp: payload.timestamp
      };

      this.logger.log(`Proof event: ${eventType}`, {
        connectionId,
        proofExchangeId: proofEvent.proofExchangeId,
        orgId: proofEvent.orgId
      });

      // Emit proof event
      await this.emitWebhookEvent('mobile-proof', proofEvent);

      // Trigger push notification for proof requests
      if ('proof-request' === eventType) {
        await this.triggerProofNotification(proofEvent);
      }
    } catch (error) {
      this.logger.error('Failed to handle proof webhook:', error);
    }
  }

  /**
   * Handle trust ping webhooks
   */
  private async handleTrustPingWebhook(
    payload: DIDCommWebhookPayload
  ): Promise<void> {
    try {
      this.logger.log('Trust ping received:', {
        connectionId: payload.connectionId,
        type: payload['@type']
      });

      // Emit trust ping event
      await this.emitWebhookEvent('mobile-trust-ping', {
        connectionId: payload.connectionId,
        type: payload['@type'],
        timestamp: payload.timestamp
      });
    } catch (error) {
      this.logger.error('Failed to handle trust ping webhook:', error);
    }
  }

  /**
   * Get active connections
   */
  public getActiveConnections(): Map<string, string> {
    return new Map(this.activeConnections);
  }

  /**
   * Get user ID by connection ID
   */
  public getUserByConnection(connectionId: string): string | undefined {
    return this.activeConnections.get(connectionId);
  }

  /**
   * Check if connection is active
   */
  public isConnectionActive(connectionId: string): boolean {
    return this.activeConnections.has(connectionId);
  }

  // Private helper methods for extracting data from metadata

  private extractUserIdFromMetadata(
    metadata?: Record<string, unknown>
  ): string | undefined {
    return metadata?.userId as string;
  }

  private extractDeviceIdFromMetadata(
    metadata?: Record<string, unknown>
  ): string | undefined {
    return metadata?.deviceId as string;
  }

  private extractCredDefIdFromMetadata(
    metadata?: Record<string, unknown>
  ): string | undefined {
    return metadata?.credentialDefinitionId as string;
  }

  private extractAttributesFromMetadata(
    metadata?: Record<string, unknown>
  ): Record<string, string> | undefined {
    return metadata?.attributes as Record<string, string>;
  }

  private extractProofNameFromMetadata(
    metadata?: Record<string, unknown>
  ): string | undefined {
    return metadata?.proofName as string;
  }

  private extractRequestedAttributesFromMetadata(
    metadata?: Record<string, unknown>
  ): Record<string, unknown> | undefined {
    return metadata?.requestedAttributes as Record<string, unknown>;
  }

  // Notification trigger methods

  private async triggerConnectionNotification(
    event: MobileConnectionEvent
  ): Promise<void> {
    try {
      // Emit notification trigger event - this will be picked up by push notification service
      await this.emitWebhookEvent('trigger-notification', {
        type: 'connection-established',
        connectionId: event.connectionId,
        orgId: event.orgId,
        userId: event.userId,
        deviceId: event.deviceId,
        timestamp: event.timestamp
      });
    } catch (error) {
      this.logger.error('Failed to trigger connection notification:', error);
    }
  }

  private async triggerCredentialNotification(
    event: MobileCredentialEvent
  ): Promise<void> {
    try {
      const notificationType =
        'credential-offer' === event.eventType
          ? 'credential-offer'
          : 'credential-received';

      await this.emitWebhookEvent('trigger-notification', {
        type: notificationType,
        connectionId: event.connectionId,
        credentialExchangeId: event.credentialExchangeId,
        orgId: event.orgId,
        credentialDefinitionId: event.credentialDefinitionId,
        timestamp: event.timestamp
      });
    } catch (error) {
      this.logger.error('Failed to trigger credential notification:', error);
    }
  }

  private async triggerProofNotification(
    event: MobileProofEvent
  ): Promise<void> {
    try {
      await this.emitWebhookEvent('trigger-notification', {
        type: 'proof-request',
        connectionId: event.connectionId,
        proofExchangeId: event.proofExchangeId,
        orgId: event.orgId,
        proofName: event.proofName,
        timestamp: event.timestamp
      });
    } catch (error) {
      this.logger.error('Failed to trigger proof notification:', error);
    }
  }

  private async emitWebhookEvent(
    eventType: string,
    data: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.natsClient.emit(`mobile.webhook.${eventType}`, data);
    } catch (error) {
      this.logger.error(`Failed to emit webhook event: ${eventType}`, error);
    }
  }
}
