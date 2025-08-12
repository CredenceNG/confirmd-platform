import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import * as crypto from 'crypto';
import {
  MobileAgentConfig,
  MobileWebhookRouting,
  MobileNotificationConfig,
  MobileLedgerConfig,
  MobileFeaturesConfig,
  MobileNotificationTemplate,
  NotificationDeliveryPreferences,
  MobileWebhookEventType
} from '../interfaces/mobile-agent.interfaces';

@Injectable()
export class MobileAgentConfigService {
  private readonly logger = new Logger('MobileAgentConfigService');

  constructor(@Inject('NATS_CLIENT') private readonly natsClient: ClientProxy) {
    this.logger.log(
      '🚀 MobileAgentConfigService initialized - Enhanced mobile agent configuration management ready'
    );
  }

  /**
   * Create or update mobile agent configuration for an organization
   */
  async updateMobileAgentConfig(
    organizationId: string,
    config: Partial<MobileAgentConfig>
  ): Promise<MobileAgentConfig> {
    this.logger.log(
      `📱 Updating mobile agent configuration for org: ${organizationId}`
    );

    try {
      // Get current configuration
      const currentConfig = await this.getMobileAgentConfig(organizationId);

      // Merge with new configuration
      const updatedConfig: MobileAgentConfig = {
        ...this.getDefaultMobileConfig(organizationId),
        ...currentConfig,
        ...config,
        organizationId // Ensure org ID is always set
      };

      // Validate configuration
      await this.validateMobileAgentConfig(updatedConfig);

      // Save configuration via NATS
      const savedConfig = await this.natsClient
        .send({ cmd: 'save-mobile-agent-config' }, updatedConfig)
        .toPromise();

      // Update agent with new configuration
      await this.applyMobileConfigToAgent(organizationId, updatedConfig);

      this.logger.log(
        `✅ Mobile agent configuration updated successfully for org: ${organizationId}`
      );
      return savedConfig;
    } catch (error) {
      this.logger.error(
        '❌ Failed to update mobile agent configuration:',
        error
      );
      throw error;
    }
  }

  /**
   * Get mobile agent configuration for an organization
   */
  async getMobileAgentConfig(
    organizationId: string
  ): Promise<MobileAgentConfig | null> {
    this.logger.log(
      `📋 Getting mobile agent configuration for org: ${organizationId}`
    );

    try {
      const config = await this.natsClient
        .send({ cmd: 'get-mobile-agent-config' }, { organizationId })
        .toPromise();

      // Return default config if none exists
      return config || this.getDefaultMobileConfig(organizationId);
    } catch (error) {
      this.logger.error('❌ Failed to get mobile agent configuration:', error);
      return this.getDefaultMobileConfig(organizationId);
    }
  }

  /**
   * Setup mobile webhook routing for an organization
   */
  async setupMobileWebhookRouting(
    organizationId: string,
    routing: Partial<MobileWebhookRouting>
  ): Promise<MobileWebhookRouting> {
    this.logger.log(
      `🔗 Setting up mobile webhook routing for org: ${organizationId}`
    );

    try {
      const fullRouting: MobileWebhookRouting = {
        organizationId,
        mobileWebhookUrl:
          routing.mobileWebhookUrl ||
          `${process.env.API_GATEWAY_URL}/mobile/webhooks/${organizationId}`,
        routingRules: routing.routingRules || [],
        retryPolicy: routing.retryPolicy || {
          maxRetries: 3,
          retryDelayMs: 1000,
          exponentialBackoff: true
        },
        authentication: routing.authentication
      };

      // Save routing configuration
      const savedRouting = await this.natsClient
        .send({ cmd: 'save-mobile-webhook-routing' }, fullRouting)
        .toPromise();

      this.logger.log(
        `✅ Mobile webhook routing configured for org: ${organizationId}`
      );
      return savedRouting;
    } catch (error) {
      this.logger.error('❌ Failed to setup mobile webhook routing:', error);
      throw error;
    }
  }

  /**
   * Configure mobile notifications for an organization
   */
  async configureMobileNotifications(
    organizationId: string,
    notificationConfig: Partial<MobileNotificationConfig>
  ): Promise<MobileNotificationConfig> {
    this.logger.log(
      `📢 Configuring mobile notifications for org: ${organizationId}`
    );

    try {
      const fullNotificationConfig: MobileNotificationConfig = {
        organizationId,
        notificationTemplates:
          notificationConfig.notificationTemplates ||
          this.getDefaultNotificationTemplates(),
        deliveryPreferences:
          notificationConfig.deliveryPreferences ||
          this.getDefaultDeliveryPreferences(),
        fcmConfig: notificationConfig.fcmConfig,
        apnsConfig: notificationConfig.apnsConfig,
        websocketConfig: notificationConfig.websocketConfig
      };

      // Save notification configuration
      const savedConfig = await this.natsClient
        .send(
          { cmd: 'save-mobile-notification-config' },
          fullNotificationConfig
        )
        .toPromise();

      this.logger.log(
        `✅ Mobile notifications configured for org: ${organizationId}`
      );
      return savedConfig;
    } catch (error) {
      this.logger.error('❌ Failed to configure mobile notifications:', error);
      throw error;
    }
  }

  /**
   * Generate mobile-optimized agent configuration for deployment
   */
  async generateMobileAgentDeploymentConfig(
    organizationId: string
  ): Promise<Record<string, unknown>> {
    this.logger.log(
      `🔧 Generating mobile agent deployment config for org: ${organizationId}`
    );

    try {
      const mobileConfig = await this.getMobileAgentConfig(organizationId);
      const orgDetails = await this.getOrganizationDetails(organizationId);

      const deploymentConfig = {
        // Basic agent configuration
        label: `${orgDetails.name}_mobile_agent`,
        walletId: `${organizationId}_mobile_wallet`,
        walletKey: this.generateSecureWalletKey(),

        // Mobile-optimized connection settings
        autoAcceptConnections: mobileConfig?.autoAcceptConnections ?? true,
        autoAcceptCredentials:
          mobileConfig?.autoAcceptCredentials ?? 'contentApproved',
        autoAcceptProofs: mobileConfig?.autoAcceptProofs ?? 'contentApproved',

        // Enhanced mobile endpoints
        endpoints: mobileConfig?.endpoints || [this.getDefaultAgentEndpoint(organizationId)],
        webhookUrl: `${process.env.API_GATEWAY_URL}/mobile/webhooks/${organizationId}`,

        // Mobile-specific network configuration
        indyLedger: this.transformLedgerConfigForAgent(
          mobileConfig?.ledgerConfig || []
        ),

        // Mobile-optimized transport settings
        inboundTransport: [
          {
            transport: 'http',
            port: this.getAvailablePort()
          },
          {
            transport: 'ws', // WebSocket for real-time mobile communication
            port: this.getAvailablePort() + 1
          }
        ],
        outboundTransport: ['http', 'ws'],

        // Mobile-specific features
        tenancy: true, // Enable multi-tenancy for mobile wallets
        logLevel: 'production' === process.env.NODE_ENV ? 1 : 3,

        // Mobile wallet compatibility settings
        connectionImageUrl: mobileConfig?.mobileFeatures
          ?.enableQRCodeOptimization
          ? `${process.env.API_GATEWAY_URL}/assets/mobile-connection-image.png`
          : undefined,

        // Enhanced mobile features
        mobileEnhancements: {
          enablePushNotifications:
            mobileConfig?.mobileFeatures?.enablePushNotifications ?? false,
          enableBackgroundProcessing:
            mobileConfig?.mobileFeatures?.enableBackgroundProcessing ?? true,
          maxConnectionsCache:
            mobileConfig?.mobileFeatures?.maxConnectionsCache ?? 100,
          connectionTimeout:
            mobileConfig?.mobileFeatures?.connectionTimeout ?? 30000
        }
      };

      this.logger.log(
        `✅ Mobile agent deployment config generated for org: ${organizationId}`
      );
      return deploymentConfig;
    } catch (error) {
      this.logger.error(
        '❌ Failed to generate mobile agent deployment config:',
        error
      );
      throw error;
    }
  }

  /**
   * Validate mobile agent configuration
   */
  private async validateMobileAgentConfig(
    config: MobileAgentConfig
  ): Promise<void> {
    const errors: string[] = [];

    if (!config.organizationId) {
      errors.push('Organization ID is required');
    }

    if (!config.agentLabel || 3 > config.agentLabel.length) {
      errors.push('Agent label must be at least 3 characters long');
    }

    if (!config.endpoints || 0 === config.endpoints.length) {
      errors.push('At least one endpoint is required');
    }

    // Validate webhook URL format
    if (config.webhookUrl && !this.isValidUrl(config.webhookUrl)) {
      errors.push('Invalid webhook URL format');
    }

    // Validate mobile webhook URL format
    if (config.mobileWebhookUrl && !this.isValidUrl(config.mobileWebhookUrl)) {
      errors.push('Invalid mobile webhook URL format');
    }

    // Validate supported wallets
    if (0 === config.walletCompatibility.supportedWallets.length) {
      errors.push('At least one supported wallet must be specified');
    }

    if (0 < errors.length) {
      throw new Error(
        `Mobile agent configuration validation failed: ${errors.join(', ')}`
      );
    }
  }

  /**
   * Apply mobile configuration to running agent
   */
  private async applyMobileConfigToAgent(
    organizationId: string,
    config: MobileAgentConfig
  ): Promise<void> {
    this.logger.log(
      `🔄 Applying mobile configuration to agent for org: ${organizationId}`
    );

    try {
      // Send configuration update to agent service
      await this.natsClient
        .send({ cmd: 'update-agent-mobile-config' }, { organizationId, config })
        .toPromise();

      this.logger.log(
        `✅ Mobile configuration applied to agent for org: ${organizationId}`
      );
    } catch (error) {
      this.logger.error(
        '❌ Failed to apply mobile configuration to agent:',
        error
      );
      throw error;
    }
  }

  /**
   * Get default mobile configuration
   */
  private getDefaultMobileConfig(organizationId: string): MobileAgentConfig {
    return {
      organizationId,
      agentLabel: `${organizationId}_mobile_agent`,
      autoAcceptConnections: true,
      autoAcceptCredentials: 'contentApproved',
      autoAcceptProofs: 'contentApproved',
      webhookUrl: `${process.env.API_GATEWAY_URL}/webhooks/${organizationId}`,
      mobileWebhookUrl: `${process.env.API_GATEWAY_URL}/mobile/webhooks/${organizationId}`,
      endpoints: [this.getDefaultAgentEndpoint(organizationId)],
      ledgerConfig: this.getDefaultLedgerConfig(),
      walletCompatibility: {
        supportedWallets: ['ariesBifold', 'trinsic', 'lissi'],
        protocolVersions: ['didcomm/1.0', 'didcomm/2.0'],
        transportMethods: ['http', 'websocket'],
        credentialFormats: ['indy', 'anoncreds']
      },
      enableRealTimeNotifications: true,
      websocketEndpoint: `${
        process.env.WEBSOCKET_URL || 'ws://localhost:3001'
      }/mobile/${organizationId}`,
      mobileFeatures: this.getDefaultMobileFeatures()
    };
  }

  /**
   * Get default ledger configuration
   */
  private getDefaultLedgerConfig(): MobileLedgerConfig[] {
    return [
      {
        name: 'Indicio TestNet',
        genesisUrl:
          'https://raw.githubusercontent.com/Indicio-tech/indicio-network/main/genesis_files/pool_transactions_testnet_genesis',
        namespace: 'indicio:testnet',
        isProduction: false,
        mobileOptimized: true
      },
      {
        name: 'BCovrin Test',
        genesisUrl: 'http://test.bcovrin.vonx.io/genesis',
        namespace: 'bcovrin:test',
        isProduction: false,
        mobileOptimized: true
      }
    ];
  }

  /**
   * Get default mobile features configuration
   */
  private getDefaultMobileFeatures(): MobileFeaturesConfig {
    return {
      enableQRCodeOptimization: true,
      enablePushNotifications: false,
      enableBackgroundProcessing: true,
      enableOfflineMode: false,
      maxConnectionsCache: 100,
      connectionTimeout: 30000,
      retryAttempts: 3
    };
  }

  /**
   * Get default notification templates
   */
  private getDefaultNotificationTemplates(): MobileNotificationTemplate[] {
    return [
      {
        eventType: MobileWebhookEventType.MOBILE_CONNECTION_REQUEST,
        title: 'New Connection Request',
        body: 'You have received a new connection request',
        priority: 'high'
      },
      {
        eventType: MobileWebhookEventType.MOBILE_CREDENTIAL_OFFER,
        title: 'Credential Offer',
        body: 'You have received a new credential offer',
        priority: 'high'
      },
      {
        eventType: MobileWebhookEventType.MOBILE_PROOF_REQUEST,
        title: 'Proof Request',
        body: 'You have received a proof request',
        priority: 'high'
      }
    ];
  }

  /**
   * Get default delivery preferences
   */
  private getDefaultDeliveryPreferences(): NotificationDeliveryPreferences {
    return {
      enablePushNotifications: false,
      enableWebSocketNotifications: true,
      enableEmailNotifications: false,
      maxNotificationsPerHour: 10
    };
  }

  /**
   * Helper methods
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private getDefaultAgentEndpoint(organizationId: string): string {
    return `${
      process.env.AGENT_ENDPOINT_BASE || 'https://agents.confamd.com'
    }/${organizationId}`;
  }

  private generateSecureWalletKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private getAvailablePort(): number {
    // In a real implementation, this would check for available ports
    return Math.floor(Math.random() * (9999 - 9000) + 9000);
  }

  private async getOrganizationDetails(
    organizationId: string
  ): Promise<{ name: string }> {
    try {
      return await this.natsClient
        .send({ cmd: 'get-organization-details' }, { organizationId })
        .toPromise();
    } catch (error) {
      this.logger.error('Failed to get organization details:', error);
      return { name: `org_${organizationId}` };
    }
  }

  private transformLedgerConfigForAgent(ledgerConfigs: MobileLedgerConfig[]): {
    genesisTransactions: string;
    indyNamespace: string;
    isProduction: boolean;
  }[] {
    return ledgerConfigs.map((config) => ({
      genesisTransactions: config.genesisUrl,
      indyNamespace: config.namespace,
      isProduction: config.isProduction
    }));
  }
}
