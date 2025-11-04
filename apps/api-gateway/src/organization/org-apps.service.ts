import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@credebl/prisma-service';
import { CommonService } from '@credebl/common';

@Injectable()
export class OrgAppsService {
  private readonly logger = new Logger('OrgAppsService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly commonService: CommonService
  ) {}

  /**
   * Get all apps for an organization
   */
  async getOrgApps(orgId: string): Promise<unknown[]> {
    this.logger.log(`Fetching apps for organization: ${orgId}`);

    const apps = await this.prisma.org_apps.findMany({
      where: {
        orgId,
        isActive: true
      },
      orderBy: {
        createDateTime: 'desc'
      }
    });

    // Decrypt webhook secrets before returning
    return apps.map((app) => ({
      ...app,
      webhookSecret: this.decryptSecret(app.webhookSecret)
    }));
  }

  /**
   * Get app by ID
   */
  async getAppById(orgId: string, appId: string): Promise<unknown> {
    this.logger.log(`Fetching app ${appId} for organization: ${orgId}`);

    const app = await this.prisma.org_apps.findFirst({
      where: {
        id: appId,
        orgId
      }
    });

    if (!app) {
      return null;
    }

    // Decrypt webhook secret before returning
    return {
      ...app,
      webhookSecret: this.decryptSecret(app.webhookSecret)
    };
  }

  /**
   * Create a new app
   */
  async createApp(orgId: string, createAppDto: Record<string, unknown>): Promise<unknown> {
    this.logger.log(`Creating app for organization: ${orgId}`);

    const { name, description, webhookUrl, webhookSecret, clientContext } = createAppDto;

    // Encrypt the webhook secret before storing
    const encryptedSecret = this.encryptSecret(webhookSecret as string);

    const app = await this.prisma.org_apps.create({
      data: {
        orgId,
        name: name as string,
        description: description as string,
        webhookUrl: webhookUrl as string,
        webhookSecret: encryptedSecret,
        clientContext: clientContext as Record<string, unknown>,
        isActive: true,
        createdBy: orgId, // TODO: Replace with actual user ID from auth context
        lastChangedBy: orgId // TODO: Replace with actual user ID from auth context
      }
    });

    // Return with decrypted secret
    return {
      ...app,
      webhookSecret
    };
  }

  /**
   * Update an app
   */
  async updateApp(orgId: string, appId: string, updateAppDto: Record<string, unknown>): Promise<unknown> {
    this.logger.log(`Updating app ${appId} for organization: ${orgId}`);

    const existingApp = await this.prisma.org_apps.findFirst({
      where: {
        id: appId,
        orgId
      }
    });

    if (!existingApp) {
      throw new NotFoundException('App not found');
    }

    const updateData: Record<string, unknown> = {
      lastChangedBy: orgId // TODO: Replace with actual user ID from auth context
    };

    // Only update fields that are provided
    if (updateAppDto.name) {
      updateData.name = updateAppDto.name;
    }
    if (updateAppDto.description) {
      updateData.description = updateAppDto.description;
    }
    if (updateAppDto.webhookUrl) {
      updateData.webhookUrl = updateAppDto.webhookUrl;
    }
    if (updateAppDto.clientContext) {
      updateData.clientContext = updateAppDto.clientContext;
    }
    if ('boolean' === typeof updateAppDto.isActive) {
      updateData.isActive = updateAppDto.isActive;
    }

    // Encrypt webhook secret if it's being updated
    if (updateAppDto.webhookSecret) {
      updateData.webhookSecret = this.encryptSecret(updateAppDto.webhookSecret as string);
    }

    const app = await this.prisma.org_apps.update({
      where: {
        id: appId
      },
      data: updateData
    });

    // Return with decrypted secret
    return {
      ...app,
      webhookSecret: updateAppDto.webhookSecret || this.decryptSecret(existingApp.webhookSecret)
    };
  }

  /**
   * Delete an app (soft delete by setting isActive to false)
   */
  async deleteApp(orgId: string, appId: string): Promise<void> {
    this.logger.log(`Deleting app ${appId} for organization: ${orgId}`);

    const existingApp = await this.prisma.org_apps.findFirst({
      where: {
        id: appId,
        orgId
      }
    });

    if (!existingApp) {
      throw new NotFoundException('App not found');
    }

    await this.prisma.org_apps.update({
      where: {
        id: appId
      },
      data: {
        isActive: false,
        lastChangedBy: orgId // TODO: Replace with actual user ID from auth context
      }
    });
  }

  /**
   * Encrypt webhook secret
   */
  private encryptSecret(secret: string): string {
    try {
      const encrypted = this.commonService.dataEncryption(secret);
      this.logger.log('🔐 Successfully encrypted webhook secret');
      return encrypted;
    } catch (error) {
      this.logger.error(`❌ Failed to encrypt webhook secret: ${error.message}`);
      throw error;
    }
  }

  /**
   * Decrypt webhook secret
   */
  private decryptSecret(encryptedSecret: string): string {
    try {
      const decrypted = this.commonService.decryptString(encryptedSecret);
      this.logger.log('🔓 Successfully decrypted webhook secret');
      return decrypted;
    } catch (error) {
      this.logger.error(`❌ Failed to decrypt webhook secret: ${error.message}`);
      this.logger.warn('⚠️ Returning encrypted value as fallback');
      return encryptedSecret;
    }
  }
}
