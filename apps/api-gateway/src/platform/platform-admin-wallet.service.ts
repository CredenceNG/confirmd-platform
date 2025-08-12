import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  ConflictException
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { BaseService } from '../../../../libs/service/base.service';
import { NATSClient } from '@credebl/common/NATSClient';
import {
  CreatePlatformAdminWalletDto,
  ConfigurePlatformAdminWalletDto,
  PlatformAdminWalletStatusDto,
  PlatformAdminWalletType,
  PlatformAdminWalletNetwork
} from './dto/platform-admin-wallet.dto';

export interface IPlatformAdminWalletCreationResponse {
  walletId: string;
  agentEndpoint: string;
  status: string;
  message: string;
  agentSpinupStatus?: number;
}

export interface IPlatformAdminWalletProvision {
  walletName: string;
  walletPassword: string;
  seed?: string;
  label: string;
  walletType: PlatformAdminWalletType;
  network: PlatformAdminWalletNetwork;
  webhookEndpoint: string;
  clientSocketId?: string;
  config?: Record<string, unknown>;
  userId: string;
}

// User interface for type safety
interface IUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

@Injectable()
export class PlatformAdminWalletService extends BaseService {
  protected readonly logger = new Logger('PlatformAdminWalletService');

  constructor(
    @Inject('NATS_CLIENT')
    private readonly platformAdminWalletServiceProxy: ClientProxy,
    private readonly natsClient: NATSClient
  ) {
    super('PlatformAdminWalletService');
  }

  /**
   * Create Platform Admin Wallet
   * @param createWalletDto Wallet creation details
   * @param user Platform admin user
   * @returns Wallet creation response
   */
  async createPlatformAdminWallet(
    createWalletDto: CreatePlatformAdminWalletDto,
    user: IUser
  ): Promise<IPlatformAdminWalletCreationResponse> {
    try {
      this.logger.log(
        `🚀 Creating platform admin wallet for user: ${user?.email}`
      );

      // Check if platform admin wallet already exists for this user
      const existingWallet = await this.checkExistingPlatformAdminWallet(
        user.id
      );
      if (existingWallet) {
        throw new ConflictException(
          'Platform admin wallet already exists for this user'
        );
      }

      // Generate unique wallet name and password
      const walletName = this.generateWalletName(user);
      const walletPassword = this.generateWalletPassword();

      // Prepare wallet provision payload
      const walletProvisionPayload: IPlatformAdminWalletProvision = {
        walletName,
        walletPassword,
        seed: createWalletDto.seed,
        label: createWalletDto.label,
        walletType:
          createWalletDto.walletType || PlatformAdminWalletType.DEDICATED,
        network:
          createWalletDto.network || PlatformAdminWalletNetwork.INDICIO_TESTNET,
        webhookEndpoint: `${process.env.API_GATEWAY_PROTOCOL || 'http'}://${
          process.env.API_GATEWAY_HOST || 'localhost'
        }:${process.env.API_GATEWAY_PORT || '5000'}/platform-admin/webhooks`,
        clientSocketId: createWalletDto.clientSocketId,
        config: createWalletDto.config,
        userId: user.id
      };

      this.logger.log(
        `📋 Wallet provision payload prepared for user: ${user?.email}`
      );

      // Send wallet provision request via NATS
      const walletCreationResponse = await this.natsClient.sendNatsMessage(
        this.platformAdminWalletServiceProxy as any,
        'platform-admin-wallet-provision',
        walletProvisionPayload
      );

      this.logger.log(
        `✅ Platform admin wallet creation initiated for user: ${user?.email}`
      );

      return {
        walletId: walletName,
        agentEndpoint: walletCreationResponse?.agentEndpoint || 'pending',
        status: 'PROVISIONING',
        message: 'Platform admin wallet creation initiated successfully',
        agentSpinupStatus: 1
      };
    } catch (error) {
      this.logger.error(
        `❌ Error creating platform admin wallet for user ${user?.email}: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Get Platform Admin Wallet Status
   * @param user Platform admin user
   * @returns Wallet status
   */
  async getPlatformAdminWalletStatus(
    user: IUser
  ): Promise<PlatformAdminWalletStatusDto> {
    try {
      this.logger.log(
        `🔍 Getting platform admin wallet status for user: ${user?.email}`
      );

      // Get wallet status via NATS
      const walletStatus = await this.natsClient.sendNatsMessage(
        this.platformAdminWalletServiceProxy as any,
        'platform-admin-wallet-status',
        { userId: user.id }
      );

      if (!walletStatus) {
        throw new BadRequestException(
          'Platform admin wallet not found for this user'
        );
      }

      return {
        status: walletStatus.status,
        endpoint: walletStatus.endpoint,
        createdAt: walletStatus.createdAt,
        updatedAt: walletStatus.updatedAt,
        additionalInfo: walletStatus.additionalInfo
      };
    } catch (error) {
      this.logger.error(
        `❌ Error getting platform admin wallet status for user ${user?.email}: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Configure Platform Admin Wallet
   * @param configureWalletDto Configuration details
   * @param user Platform admin user
   * @returns Configuration result
   */
  async configurePlatformAdminWallet(
    configureWalletDto: ConfigurePlatformAdminWalletDto,
    user: IUser
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(
        `⚙️ Configuring platform admin wallet for user: ${user?.email}`
      );

      // Send configuration request via NATS
      const configurationResult = await this.natsClient.sendNatsMessage(
        this.platformAdminWalletServiceProxy as any,
        'platform-admin-wallet-configure',
        {
          userId: user.id,
          config: configureWalletDto.config,
          clientSocketId: configureWalletDto.clientSocketId
        }
      );

      if (!configurationResult?.success) {
        throw new BadRequestException(
          'Failed to configure platform admin wallet'
        );
      }

      this.logger.log(
        `✅ Platform admin wallet configured successfully for user: ${user?.email}`
      );

      return {
        success: true,
        message: 'Platform admin wallet configured successfully'
      };
    } catch (error) {
      this.logger.error(
        `❌ Error configuring platform admin wallet for user ${user?.email}: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Check if platform admin wallet already exists for user
   * @param userId User ID
   * @returns Existing wallet information or null
   */
  private async checkExistingPlatformAdminWallet(
    userId: string
  ): Promise<unknown> {
    try {
      const existingWallet = await this.natsClient.sendNatsMessage(
        this.platformAdminWalletServiceProxy as any,
        'platform-admin-wallet-check-existing',
        { userId }
      );
      return existingWallet;
    } catch (error) {
      this.logger.log(
        `No existing platform admin wallet found for user: ${userId}`
      );
      return null;
    }
  }

  /**
   * Generate unique wallet name for platform admin
   * @param user Platform admin user
   * @returns Unique wallet name
   */
  private generateWalletName(user: IUser): string {
    const timestamp = Date.now();
    const userIdentifier =
      user.email?.split('@')[0] || user.id?.substring(0, 8) || 'admin';
    return `platform-admin-${userIdentifier}-${timestamp}`;
  }

  /**
   * Generate secure wallet password
   * @returns Random wallet password
   */
  private generateWalletPassword(): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; 32 > i; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}
