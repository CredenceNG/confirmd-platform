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

    try {
      // Step 1: Get orgId from tenantId
      const orgAgent = await this.prisma.org_agents.findFirst({
        where: { tenantId },
        select: { orgId: true }
      });

      if (!orgAgent || !orgAgent.orgId) {
        this.logger.warn(`⚠️ No org found for tenantId: ${tenantId}`);
        return;
      }

      const { orgId } = orgAgent;
      this.logger.log(`🏢 Found orgId: ${orgId}`);

      // Step 2: Get all active apps for this org
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
        return;
      }

      this.logger.log(`📱 Found ${orgApps.length} active app(s) for orgId: ${orgId}`);

      // Step 3: Format the webhook payload according to org app spec
      const payload: WebhookPayload = {
        type: webhookType,
        timestamp: new Date().toISOString(),
        orgId,
        tenantId,
        data: webhookData,
        clientContext: {}
      };

      // Step 4: Send to each app
      const deliveryPromises = orgApps.map((app) => this.sendWebhookToApp(app, payload));

      await Promise.allSettled(deliveryPromises);

      this.logger.log(`✅ Webhook delivery completed for all apps`);
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

    try {
      // Decrypt the webhook secret
      const decryptedSecret = this.decryptSecret(app.webhookSecret);

      // Merge app's clientContext if exists
      const finalPayload = {
        ...payload,
        clientContext: app.clientContext || {}
      };

      this.logger.log(`📨 OUTBOUND_WEBHOOK_PAYLOAD: ${JSON.stringify(finalPayload)}`);

      // Send HTTP POST to app's webhook URL
      const response = await fetch(app.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': decryptedSecret
        },
        body: JSON.stringify(finalPayload)
      });

      if (response.ok) {
        const responseData = await response.text();
        this.logger.log(`✅ Webhook delivered successfully to ${app.name}`);
        this.logger.log(`📬 Response: ${responseData}`);
      } else {
        this.logger.error(`❌ Webhook delivery failed to ${app.name}: ${response.status} ${response.statusText}`);
        const errorBody = await response.text();
        this.logger.error(`Error response: ${errorBody}`);
      }
    } catch (error) {
      this.logger.error(`❌ Failed to send webhook to ${app.name}: ${error.message}`);
      // Don't throw - continue with other apps
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
