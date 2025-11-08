import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@credebl/prisma-service';
import { CommonService } from '@credebl/common';
import { JsonValue } from '@prisma/client/runtime/library';

interface OrgApp {
  id: string;
  name: string;
  webhookUrl: string;
  webhookSecret: string;
  clientContext: JsonValue;
}

interface WebhookPayload {
  type: 'Connection' | 'Proof' | 'Credential';
  timestamp: string;
  orgId: string;
  tenantId: string;
  appId?: string; // Added: Unique app identifier
  appName?: string; // Added: Human-readable app name
  data: Record<string, unknown>;
  clientContext: JsonValue;
}

@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger('WebhookDeliveryService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly commonService: CommonService
  ) {
    this.logger.log('📬 WebhookDeliveryService initialized');
  }

  /**
   * Send webhook to all active org apps for the given tenantId
   * @param webhookType Type of webhook (Connection, Proof, Credential)
   * @param tenantId Tenant ID from the webhook event
   * @param webhookData The raw webhook data from Credo
   */
  async deliverToOrgApps(
    webhookType: 'Connection' | 'Proof' | 'Credential',
    tenantId: string,
    webhookData: Record<string, unknown>
  ): Promise<void> {
    this.logger.log(`📤 === OUTBOUND WEBHOOK DELIVERY START ===`);
    this.logger.log(`📋 Type: ${webhookType}, TenantId: ${tenantId}`);
    this.logger.log(`📦 Webhook data keys: ${Object.keys(webhookData).join(', ')}`);
    this.logger.log(`📊 Webhook state: ${webhookData.state || 'N/A'}`);

    try {
      // Step 1: Get orgId from tenantId
      this.logger.log(`🔍 Looking up orgId for tenantId: ${tenantId}`);
      const orgAgent = await this.prisma.org_agents.findFirst({
        where: { tenantId },
        select: { orgId: true }
      });

      if (!orgAgent || !orgAgent.orgId) {
        this.logger.warn(`⚠️ No org found for tenantId: ${tenantId}`);
        this.logger.warn(`⚠️ This means no org_agents record exists with this tenantId`);
        return;
      }

      const { orgId } = orgAgent;
      this.logger.log(`🏢 Found orgId: ${orgId}`);

      // Step 2: Get all active apps for this org
      this.logger.log(`🔍 Looking up active apps for orgId: ${orgId}`);
      const orgApps = await this.prisma.org_apps.findMany({
        where: {
          orgId,
          isActive: true
        },
        select: {
          id: true,
          name: true,
          webhookUrl: true,
          webhookSecret: true,
          clientContext: true
        }
      });

      if (!orgApps || 0 === orgApps.length) {
        this.logger.warn(`⚠️ No active apps found for orgId: ${orgId}`);
        this.logger.warn(`⚠️ Either no apps are registered or all apps are inactive`);
        return;
      }

      this.logger.log(`📱 Found ${orgApps.length} active app(s) for orgId: ${orgId}`);
      this.logger.log(`📱 Apps: ${orgApps.map((app) => `${app.name} (${app.id})`).join(', ')}`);

      // Step 3: Format the webhook payload according to org app spec
      const payload: WebhookPayload = {
        type: webhookType,
        timestamp: new Date().toISOString(),
        orgId,
        tenantId,
        data: webhookData,
        clientContext: {}
      };

      this.logger.log(`📨 Formatted payload ready for delivery`);

      // Step 4: Send to each app
      const deliveryPromises = orgApps.map((app) => this.sendWebhookToApp(app, payload));

      const results = await Promise.allSettled(deliveryPromises);

      // Log results summary
      const successful = results.filter((r) => 'fulfilled' === r.status).length;
      const failed = results.filter((r) => 'rejected' === r.status).length;

      this.logger.log(`✅ Webhook delivery completed: ${successful} successful, ${failed} failed`);
    } catch (error) {
      this.logger.error(`❌ Error in webhook delivery: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Send webhook to a single org app
   */
  private async sendWebhookToApp(app: OrgApp, payload: WebhookPayload): Promise<void> {
    this.logger.log(`📤 Sending webhook to app: ${app.name} (${app.id})`);
    this.logger.log(`🌐 URL: ${app.webhookUrl}`);

    const deliveryRecord = {
      appId: app.id,
      webhookUrl: app.webhookUrl,
      eventType: payload.type,
      eventData: payload as unknown as JsonValue,
      createdBy: payload.orgId,
      lastChangedBy: payload.orgId
    };

    try {
      // Decrypt the webhook secret
      const decryptedSecret = this.decryptSecret(app.webhookSecret);

      // Merge app's clientContext and add app identification
      const finalPayload = {
        ...payload,
        appId: app.id, // Add app ID as differentiator
        appName: app.name, // Add app name for clarity
        clientContext: app.clientContext || {}
      };

      this.logger.log(`📨 OUTBOUND_WEBHOOK_PAYLOAD: ${JSON.stringify(finalPayload)}`);

      // Send HTTP POST to app's webhook URL
      const response = await fetch(app.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': decryptedSecret,
          'x-app-id': app.id, // Add app ID to headers for easier filtering
          'x-org-id': payload.orgId // Add org ID to headers
        },
        body: JSON.stringify(finalPayload)
      });

      if (response.ok) {
        const responseData = await response.text();
        this.logger.log(`✅ Webhook delivered successfully to ${app.name}`);
        this.logger.log(`📬 Response: ${responseData}`);

        // Track successful delivery
        await this.trackDelivery({
          ...deliveryRecord,
          deliveryStatus: 'delivered',
          httpStatus: response.status,
          responseBody: responseData.substring(0, 1000), // Limit response body size
          deliveredAt: new Date()
        });
      } else {
        const errorBody = await response.text();
        this.logger.error(`❌ Webhook delivery failed to ${app.name}: ${response.status} ${response.statusText}`);
        this.logger.error(`Error response: ${errorBody}`);

        // Track failed delivery
        await this.trackDelivery({
          ...deliveryRecord,
          deliveryStatus: 'failed',
          httpStatus: response.status,
          responseBody: errorBody.substring(0, 1000),
          errorMessage: `HTTP ${response.status}: ${response.statusText}`
        });
      }
    } catch (error) {
      this.logger.error(`❌ Failed to send webhook to ${app.name}: ${error.message}`);

      // Track failed delivery (network error, timeout, etc.)
      await this.trackDelivery({
        ...deliveryRecord,
        deliveryStatus: 'failed',
        errorMessage: error.message,
        httpStatus: null,
        responseBody: null
      });

      // Don't throw - continue with other apps
    }
  }

  /**
   * Track webhook delivery attempt in database
   */
  private async trackDelivery(data: {
    appId: string;
    webhookUrl: string;
    eventType: string;
    eventData: JsonValue;
    deliveryStatus: string;
    httpStatus: number | null;
    responseBody: string | null;
    errorMessage?: string;
    createdBy: string;
    lastChangedBy: string;
    deliveredAt?: Date;
  }): Promise<void> {
    try {
      await this.prisma.webhook_deliveries.create({
        data: {
          appId: data.appId,
          webhookUrl: data.webhookUrl,
          eventType: data.eventType,
          eventData: data.eventData,
          deliveryStatus: data.deliveryStatus,
          httpStatus: data.httpStatus,
          responseBody: data.responseBody,
          errorMessage: data.errorMessage || null,
          attemptCount: 1,
          createdBy: data.createdBy,
          lastChangedBy: data.lastChangedBy,
          deliveredAt: data.deliveredAt || null
        }
      });

      this.logger.log(`📝 Delivery tracked: ${data.deliveryStatus} to app ${data.appId}`);
    } catch (error) {
      // Don't fail webhook delivery if tracking fails
      this.logger.error(`⚠️ Failed to track delivery: ${error.message}`);
    }
  }

  /**
   * Decrypt the webhook secret stored in database
   * Uses CryptoJS AES encryption with CRYPTO_PRIVATE_KEY from environment
   */
  private decryptSecret(encryptedSecret: string): string {
    try {
      // Use CommonService's decryptString method which handles CryptoJS decryption
      const decryptedSecret = this.commonService.decryptString(encryptedSecret);
      this.logger.log(`🔓 Successfully decrypted webhook secret`);
      return decryptedSecret;
    } catch (error) {
      this.logger.error(`❌ Failed to decrypt webhook secret: ${error.message}`);
      this.logger.warn('⚠️ Using encrypted value as fallback');
      // Fallback to encrypted value if decryption fails
      return encryptedSecret;
    }
  }
}
