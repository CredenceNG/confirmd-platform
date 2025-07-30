import { Injectable, Logger } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import {
  MobileWebhookData,
  MobileWebhookEventType,
  MobileWebhookRouting,
  MobileAgentConfig,
  MobileNotificationConfig,
  MobileContext,
} from "../interfaces/mobile-agent.interfaces";

@Injectable()
export class MobileWebhookService {
  private readonly logger = new Logger("MobileWebhookService");

  constructor(@Inject("NATS_CLIENT") private readonly natsClient: ClientProxy) {
    this.logger.log(
      "🚀 MobileWebhookService initialized - Enhanced mobile webhook processing ready"
    );
  }

  /**
   * Enhanced webhook processing specifically optimized for mobile wallet interactions
   */
  async processMobileWebhook(webhookData: MobileWebhookData): Promise<void> {
    this.logger.log("📱 === PROCESSING MOBILE WEBHOOK ===");
    this.logger.log(`🔥 Event Type: ${webhookData.eventType}`);
    this.logger.log(`🏢 Organization: ${webhookData.organizationId}`);
    this.logger.log(`📋 Data: ${JSON.stringify(webhookData.data, null, 2)}`);

    try {
      // Enhanced mobile-specific processing
      await this.enrichMobileWebhookData(webhookData);

      // Route to appropriate handlers based on event type
      await this.routeMobileWebhook(webhookData);

      // Send real-time notifications
      await this.sendMobileNotifications(webhookData);

      // Update mobile analytics
      await this.updateMobileAnalytics(webhookData);

      this.logger.log("✅ Mobile webhook processed successfully");
    } catch (error) {
      this.logger.error("❌ Mobile webhook processing failed:", error);
      await this.handleMobileWebhookError(webhookData, error);
      throw error;
    }
  }

  /**
   * Enhance webhook data with mobile-specific context and metadata
   */
  private async enrichMobileWebhookData(
    webhookData: MobileWebhookData
  ): Promise<void> {
    this.logger.log("🔍 Enriching mobile webhook data with context");

    try {
      // Add mobile context if not present
      if (!webhookData.mobileContext) {
        webhookData.mobileContext = await this.detectMobileContext(webhookData);
      }

      // Enrich with organization mobile config
      const orgMobileConfig = await this.getOrganizationMobileConfig(
        webhookData.organizationId
      );
      if (orgMobileConfig) {
        webhookData.data.metadata = {
          ...webhookData.data.metadata,
          mobileConfig: orgMobileConfig.mobileFeatures,
          walletCompatibility: orgMobileConfig.walletCompatibility,
        };
      }

      // Add timestamp if missing
      if (!webhookData.timestamp) {
        webhookData.timestamp = new Date().toISOString();
      }
    } catch (error) {
      this.logger.error("Error enriching mobile webhook data:", error);
    }
  }

  /**
   * Route mobile webhooks to appropriate handlers based on event type
   */
  private async routeMobileWebhook(
    webhookData: MobileWebhookData
  ): Promise<void> {
    this.logger.log(`🎯 Routing mobile webhook: ${webhookData.eventType}`);

    const routingRules = await this.getMobileWebhookRouting(
      webhookData.organizationId
    );

    switch (webhookData.eventType) {
      case MobileWebhookEventType.MOBILE_CONNECTION_REQUEST:
      case MobileWebhookEventType.MOBILE_CONNECTION_RESPONSE:
        await this.handleMobileConnectionWebhook(webhookData);
        break;

      case MobileWebhookEventType.MOBILE_CREDENTIAL_OFFER:
      case MobileWebhookEventType.MOBILE_CREDENTIAL_REQUEST:
      case MobileWebhookEventType.MOBILE_CREDENTIAL_ISSUED:
        await this.handleMobileCredentialWebhook(webhookData);
        break;

      case MobileWebhookEventType.MOBILE_PROOF_REQUEST:
      case MobileWebhookEventType.MOBILE_PROOF_PRESENTATION:
        await this.handleMobileProofWebhook(webhookData);
        break;

      case MobileWebhookEventType.MOBILE_WALLET_CONNECTED:
      case MobileWebhookEventType.MOBILE_WALLET_DISCONNECTED:
        await this.handleMobileWalletStatusWebhook(webhookData);
        break;

      case MobileWebhookEventType.MOBILE_ERROR:
        await this.handleMobileErrorWebhook(webhookData);
        break;

      default:
        this.logger.warn(
          `Unhandled mobile webhook event type: ${webhookData.eventType}`
        );
    }

    // Forward to external webhooks if configured
    if (routingRules) {
      await this.forwardToExternalWebhooks(webhookData, routingRules);
    }
  }

  /**
   * Handle mobile connection events with enhanced processing
   */
  private async handleMobileConnectionWebhook(
    webhookData: MobileWebhookData
  ): Promise<void> {
    this.logger.log("🔗 Processing mobile connection webhook");

    const connectionPayload = {
      organizationId: webhookData.organizationId,
      connectionId: webhookData.data.connectionId,
      state: webhookData.data.state,
      previousState: webhookData.data.previousState,
      mobileContext: webhookData.mobileContext,
      timestamp: webhookData.timestamp,
    };

    // Forward to connection service with mobile enhancement
    await this.natsClient
      .send({ cmd: "mobile-connection-webhook" }, connectionPayload)
      .toPromise();
  }

  /**
   * Handle mobile credential events
   */
  private async handleMobileCredentialWebhook(
    webhookData: MobileWebhookData
  ): Promise<void> {
    this.logger.log("🎫 Processing mobile credential webhook");

    const credentialPayload = {
      organizationId: webhookData.organizationId,
      credentialId: webhookData.data.credentialId,
      connectionId: webhookData.data.connectionId,
      state: webhookData.data.state,
      mobileContext: webhookData.mobileContext,
      timestamp: webhookData.timestamp,
    };

    // Forward to credential service with mobile enhancement
    await this.natsClient
      .send({ cmd: "mobile-credential-webhook" }, credentialPayload)
      .toPromise();
  }

  /**
   * Handle mobile proof events
   */
  private async handleMobileProofWebhook(
    webhookData: MobileWebhookData
  ): Promise<void> {
    this.logger.log("🔍 Processing mobile proof webhook");

    const proofPayload = {
      organizationId: webhookData.organizationId,
      proofId: webhookData.data.proofId,
      connectionId: webhookData.data.connectionId,
      state: webhookData.data.state,
      mobileContext: webhookData.mobileContext,
      timestamp: webhookData.timestamp,
    };

    // Forward to proof service with mobile enhancement
    await this.natsClient
      .send({ cmd: "mobile-proof-webhook" }, proofPayload)
      .toPromise();
  }

  /**
   * Handle mobile wallet status changes
   */
  private async handleMobileWalletStatusWebhook(
    webhookData: MobileWebhookData
  ): Promise<void> {
    this.logger.log("📱 Processing mobile wallet status webhook");

    const statusPayload = {
      organizationId: webhookData.organizationId,
      connectionId: webhookData.data.connectionId,
      status:
        webhookData.eventType === MobileWebhookEventType.MOBILE_WALLET_CONNECTED
          ? "connected"
          : "disconnected",
      mobileContext: webhookData.mobileContext,
      timestamp: webhookData.timestamp,
    };

    // Update wallet status tracking
    await this.natsClient
      .send({ cmd: "mobile-wallet-status-update" }, statusPayload)
      .toPromise();
  }

  /**
   * Handle mobile error events
   */
  private async handleMobileErrorWebhook(
    webhookData: MobileWebhookData
  ): Promise<void> {
    this.logger.error("❌ Processing mobile error webhook");
    this.logger.error(`Error Code: ${webhookData.data.errorCode}`);
    this.logger.error(`Error Message: ${webhookData.data.errorMessage}`);

    const errorPayload = {
      organizationId: webhookData.organizationId,
      errorCode: webhookData.data.errorCode,
      errorMessage: webhookData.data.errorMessage,
      mobileContext: webhookData.mobileContext,
      timestamp: webhookData.timestamp,
      originalWebhookData: webhookData,
    };

    // Forward to error handling service
    await this.natsClient
      .send({ cmd: "mobile-error-webhook" }, errorPayload)
      .toPromise();
  }

  /**
   * Send real-time notifications for mobile events
   */
  private async sendMobileNotifications(
    webhookData: MobileWebhookData
  ): Promise<void> {
    this.logger.log("📢 Sending mobile notifications");

    try {
      const notificationConfig = await this.getMobileNotificationConfig(
        webhookData.organizationId
      );

      if (notificationConfig) {
        const notificationPayload = {
          organizationId: webhookData.organizationId,
          eventType: webhookData.eventType,
          webhookData,
          config: notificationConfig,
        };

        // Send via NATS to notification service
        await this.natsClient
          .send({ cmd: "send-mobile-notification" }, notificationPayload)
          .toPromise();
      }
    } catch (error) {
      this.logger.error("Error sending mobile notifications:", error);
    }
  }

  /**
   * Update mobile analytics and metrics
   */
  private async updateMobileAnalytics(
    webhookData: MobileWebhookData
  ): Promise<void> {
    this.logger.log("📊 Updating mobile analytics");

    try {
      const analyticsPayload = {
        organizationId: webhookData.organizationId,
        eventType: webhookData.eventType,
        timestamp: webhookData.timestamp,
        mobileContext: webhookData.mobileContext,
        state: webhookData.data.state,
      };

      // Send to analytics service
      await this.natsClient
        .send({ cmd: "update-mobile-analytics" }, analyticsPayload)
        .toPromise();
    } catch (error) {
      this.logger.error("Error updating mobile analytics:", error);
    }
  }

  /**
   * Handle webhook processing errors
   */
  private async handleMobileWebhookError(
    webhookData: MobileWebhookData,
    error: Error
  ): Promise<void> {
    this.logger.error("🚨 Handling mobile webhook error");

    const errorPayload = {
      organizationId: webhookData.organizationId,
      originalWebhook: webhookData,
      error: {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      },
    };

    // Send to error tracking service
    await this.natsClient
      .send({ cmd: "mobile-webhook-error" }, errorPayload)
      .toPromise();
  }

  /**
   * Detect mobile context from webhook data
   */
  private async detectMobileContext(
    _webhookData: MobileWebhookData
  ): Promise<MobileContext> {
    // This would analyze the webhook data to detect mobile wallet type, platform, etc.
    // For now, return a basic structure
    return {
      walletType: "unknown",
      walletVersion: "unknown",
      platformType: "web", // Default to 'web', can be 'ios' | 'android' | 'web'
    };
  }

  /**
   * Get organization mobile configuration
   */
  private async getOrganizationMobileConfig(
    organizationId: string
  ): Promise<MobileAgentConfig | null> {
    try {
      return await this.natsClient
        .send({ cmd: "get-mobile-agent-config" }, { organizationId })
        .toPromise();
    } catch (error) {
      this.logger.error("Error getting organization mobile config:", error);
      return null;
    }
  }

  /**
   * Get mobile webhook routing rules
   */
  private async getMobileWebhookRouting(
    organizationId: string
  ): Promise<MobileWebhookRouting | null> {
    try {
      return await this.natsClient
        .send({ cmd: "get-mobile-webhook-routing" }, { organizationId })
        .toPromise();
    } catch (error) {
      this.logger.error("Error getting mobile webhook routing:", error);
      return null;
    }
  }

  /**
   * Get mobile notification configuration
   */
  private async getMobileNotificationConfig(
    organizationId: string
  ): Promise<MobileNotificationConfig | null> {
    try {
      return await this.natsClient
        .send({ cmd: "get-mobile-notification-config" }, { organizationId })
        .toPromise();
    } catch (error) {
      this.logger.error("Error getting mobile notification config:", error);
      return null;
    }
  }

  /**
   * Forward webhooks to external endpoints based on routing rules
   */
  private async forwardToExternalWebhooks(
    webhookData: MobileWebhookData,
    routingRules: MobileWebhookRouting
  ): Promise<void> {
    this.logger.log("🚀 Forwarding to external webhooks");

    for (const rule of routingRules.routingRules) {
      if (rule.enabled && rule.eventTypes.includes(webhookData.eventType)) {
        try {
          const forwardPayload = {
            rule,
            webhookData,
            destinationUrl: rule.destinationUrl,
            retryPolicy: routingRules.retryPolicy,
            authentication: routingRules.authentication,
          };

          // Send to webhook forwarding service
          await this.natsClient
            .send({ cmd: "forward-mobile-webhook" }, forwardPayload)
            .toPromise();
        } catch (error) {
          this.logger.error(
            `Error forwarding to ${rule.destinationUrl}:`,
            error
          );
        }
      }
    }
  }
}
