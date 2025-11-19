import { Injectable, Logger, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PrismaService } from '@credebl/prisma-service';
import { EcosystemRepository } from '../repositories/ecosystem.repository';
import {
  ICreateEcosystem,
  IUpdateEcosystem,
  IAddOrgToEcosystem,
  IRemoveOrgFromEcosystem,
  IAddSchemaToEcosystem,
  IUpdateSchemaPricing,
  ICreateEcosystemInvitation,
  IEcosystemPagination,
  IGetEcosystems,
  IGetEcosystemOrgs,
  IGetEcosystemSchemas,
  IGetEcosystemInvitations
} from '../interfaces/ecosystem.interface';
import { ecosystem } from '@prisma/client';

@Injectable()
export class EcosystemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ecosystemRepository: EcosystemRepository,
    private readonly logger: Logger
  ) {}

  /**
   * Create a new ecosystem
   */
  async createEcosystem(data: ICreateEcosystem): Promise<ecosystem> {
    try {
      this.logger.log(`Creating ecosystem: ${data.name}`);

      // Check if ecosystem name already exists
      const existing = await this.ecosystemRepository.checkEcosystemExists(data.name);
      if (existing) {
        throw new ConflictException('Ecosystem with this name already exists');
      }

      const ecosystem = await this.ecosystemRepository.createEcosystem(data);

      this.logger.log(`Ecosystem created successfully: ${ecosystem.id}`);
      return ecosystem;
    } catch (error) {
      this.logger.error(`Error creating ecosystem: ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  /**
   * Get ecosystem by ID
   */
  async getEcosystemById(ecosystemId: string): Promise<ecosystem> {
    try {
      this.logger.log(`Fetching ecosystem: ${ecosystemId}`);

      const ecosystem = await this.ecosystemRepository.getEcosystemById(ecosystemId);

      if (!ecosystem) {
        throw new NotFoundException('Ecosystem not found');
      }

      return ecosystem;
    } catch (error) {
      this.logger.error(`Error getting ecosystem by id: ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  /**
   * Get all ecosystems with pagination
   */
  async getAllEcosystems(pagination: IEcosystemPagination): Promise<IGetEcosystems> {
    try {
      this.logger.log(`Fetching all ecosystems with pagination`);

      const { ecosystems, totalCount } = await this.ecosystemRepository.getAllEcosystems(pagination);

      const totalPages = Math.ceil(totalCount / pagination.pageSize);

      return {
        ecosystems,
        totalCount,
        totalPages
      };
    } catch (error) {
      this.logger.error(`Error getting all ecosystems: ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  /**
   * Update an ecosystem
   */
  async updateEcosystem(data: IUpdateEcosystem): Promise<ecosystem> {
    try {
      this.logger.log(`Updating ecosystem: ${data.ecosystemId}`);

      // Check if ecosystem exists
      const ecosystem = await this.ecosystemRepository.getEcosystemById(data.ecosystemId);
      if (!ecosystem) {
        throw new NotFoundException('Ecosystem not found');
      }

      // If name is being updated, check if new name already exists
      if (data.name && data.name !== ecosystem.name) {
        const existing = await this.ecosystemRepository.checkEcosystemExists(data.name);
        if (existing) {
          throw new ConflictException('Ecosystem with this name already exists');
        }
      }

      const updatedEcosystem = await this.ecosystemRepository.updateEcosystem(data);

      this.logger.log(`Ecosystem updated successfully: ${updatedEcosystem.id}`);
      return updatedEcosystem;
    } catch (error) {
      this.logger.error(`Error updating ecosystem: ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  /**
   * Delete an ecosystem (soft delete)
   */
  async deleteEcosystem(ecosystemId: string, userId: string): Promise<{ message: string }> {
    try {
      this.logger.log(`Deleting ecosystem: ${ecosystemId}`);

      // Check if ecosystem exists
      const ecosystem = await this.ecosystemRepository.getEcosystemById(ecosystemId);
      if (!ecosystem) {
        throw new NotFoundException('Ecosystem not found');
      }

      await this.ecosystemRepository.deleteEcosystem(ecosystemId, userId);

      this.logger.log(`Ecosystem deleted successfully: ${ecosystemId}`);
      return { message: 'Ecosystem deleted successfully' };
    } catch (error) {
      this.logger.error(`Error deleting ecosystem: ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  /**
   * Add organization to ecosystem
   */
  async addOrganizationToEcosystem(data: IAddOrgToEcosystem): Promise<object> {
    try {
      this.logger.log(`Adding organization ${data.orgId} to ecosystem ${data.ecosystemId}`);

      // Check if ecosystem exists
      const ecosystem = await this.ecosystemRepository.getEcosystemById(data.ecosystemId);
      if (!ecosystem) {
        throw new NotFoundException('Ecosystem not found');
      }

      // Check if organization exists
      const organization = await this.prisma.organisation.findUnique({
        where: { id: data.orgId }
      });

      if (!organization) {
        throw new NotFoundException('Organization not found');
      }

      const ecosystemOrg = await this.ecosystemRepository.addOrganizationToEcosystem(data);

      this.logger.log(`Organization added to ecosystem successfully`);
      return {
        message: 'Organization added to ecosystem successfully',
        data: ecosystemOrg
      };
    } catch (error) {
      this.logger.error(`Error adding organization to ecosystem: ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  /**
   * Remove organization from ecosystem
   */
  async removeOrganizationFromEcosystem(data: IRemoveOrgFromEcosystem): Promise<{ message: string }> {
    try {
      this.logger.log(`Removing organization ${data.orgId} from ecosystem ${data.ecosystemId}`);

      await this.ecosystemRepository.removeOrganizationFromEcosystem(data.ecosystemId, data.orgId);

      this.logger.log(`Organization removed from ecosystem successfully`);
      return { message: 'Organization removed from ecosystem successfully' };
    } catch (error) {
      this.logger.error(`Error removing organization from ecosystem: ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  /**
   * Get ecosystem organizations
   */
  async getEcosystemOrganizations(ecosystemId: string, pagination: IEcosystemPagination): Promise<IGetEcosystemOrgs> {
    try {
      this.logger.log(`Fetching organizations for ecosystem: ${ecosystemId}`);

      // Check if ecosystem exists
      const ecosystem = await this.ecosystemRepository.getEcosystemById(ecosystemId);
      if (!ecosystem) {
        throw new NotFoundException('Ecosystem not found');
      }

      const { organizations, totalCount } = await this.ecosystemRepository.getEcosystemOrganizations(
        ecosystemId,
        pagination
      );

      return {
        organizations,
        totalCount
      };
    } catch (error) {
      this.logger.error(`Error getting ecosystem organizations: ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  /**
   * Add schema to ecosystem
   */
  async addSchemaToEcosystem(data: IAddSchemaToEcosystem): Promise<object> {
    try {
      this.logger.log(`Adding schema ${data.schemaLedgerId} to ecosystem ${data.ecosystemId}`);

      // Check if ecosystem exists
      const ecosystem = await this.ecosystemRepository.getEcosystemById(data.ecosystemId);
      if (!ecosystem) {
        throw new NotFoundException('Ecosystem not found');
      }

      // Validate revenue sharing totals to 100%
      const issuanceTotal = data.issuancePlatformShare + data.issuanceEcosystemShare + data.issuanceIssuerShare;
      if (0.01 < Math.abs(issuanceTotal - 100)) {
        throw new BadRequestException(`Issuance revenue shares must total 100%. Current total: ${issuanceTotal}%`);
      }

      const verificationTotal =
        data.verificationPlatformShare + data.verificationEcosystemShare + data.verificationVerifierShare;
      if (0.01 < Math.abs(verificationTotal - 100)) {
        throw new BadRequestException(
          `Verification revenue shares must total 100%. Current total: ${verificationTotal}%`
        );
      }

      const revocationTotal = data.revocationPlatformShare + data.revocationEcosystemShare + data.revocationIssuerShare;
      if (0.01 < Math.abs(revocationTotal - 100)) {
        throw new BadRequestException(`Revocation revenue shares must total 100%. Current total: ${revocationTotal}%`);
      }

      const ecosystemSchema = await this.ecosystemRepository.addSchemaToEcosystem(data);

      this.logger.log(`Schema added to ecosystem successfully`);
      return {
        message: 'Schema added to ecosystem successfully',
        data: ecosystemSchema
      };
    } catch (error) {
      this.logger.error(`Error adding schema to ecosystem: ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  /**
   * Update schema pricing
   */
  async updateSchemaPricing(data: IUpdateSchemaPricing): Promise<object> {
    try {
      this.logger.log(`Updating schema pricing for schema ${data.schemaId}`);

      // Validate revenue sharing totals to 100% if all three shares are provided for any operation type

      // Validate issuance revenue shares
      const hasAllIssuanceShares =
        data.issuancePlatformShare !== undefined &&
        data.issuanceEcosystemShare !== undefined &&
        data.issuanceIssuerShare !== undefined;

      if (hasAllIssuanceShares) {
        const issuanceTotal = data.issuancePlatformShare + data.issuanceEcosystemShare + data.issuanceIssuerShare;
        if (0.01 < Math.abs(issuanceTotal - 100)) {
          throw new BadRequestException(`Issuance revenue shares must total 100%. Current total: ${issuanceTotal}%`);
        }
      }

      // Validate verification revenue shares
      const hasAllVerificationShares =
        data.verificationPlatformShare !== undefined &&
        data.verificationEcosystemShare !== undefined &&
        data.verificationVerifierShare !== undefined;

      if (hasAllVerificationShares) {
        const verificationTotal =
          data.verificationPlatformShare + data.verificationEcosystemShare + data.verificationVerifierShare;
        if (0.01 < Math.abs(verificationTotal - 100)) {
          throw new BadRequestException(
            `Verification revenue shares must total 100%. Current total: ${verificationTotal}%`
          );
        }
      }

      // Validate revocation revenue shares
      const hasAllRevocationShares =
        data.revocationPlatformShare !== undefined &&
        data.revocationEcosystemShare !== undefined &&
        data.revocationIssuerShare !== undefined;

      if (hasAllRevocationShares) {
        const revocationTotal =
          data.revocationPlatformShare + data.revocationEcosystemShare + data.revocationIssuerShare;
        if (0.01 < Math.abs(revocationTotal - 100)) {
          throw new BadRequestException(
            `Revocation revenue shares must total 100%. Current total: ${revocationTotal}%`
          );
        }
      }

      const updatedSchema = await this.ecosystemRepository.updateSchemaPricing(data);

      this.logger.log(`Schema pricing updated successfully`);
      return {
        message: 'Schema pricing updated successfully',
        data: updatedSchema
      };
    } catch (error) {
      this.logger.error(`Error updating schema pricing: ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  /**
   * Get ecosystem schemas
   */
  async getEcosystemSchemas(ecosystemId: string, pagination: IEcosystemPagination): Promise<IGetEcosystemSchemas> {
    try {
      this.logger.log(`Fetching schemas for ecosystem: ${ecosystemId}`);

      // Check if ecosystem exists
      const ecosystem = await this.ecosystemRepository.getEcosystemById(ecosystemId);
      if (!ecosystem) {
        throw new NotFoundException('Ecosystem not found');
      }

      const { schemas, totalCount } = await this.ecosystemRepository.getEcosystemSchemas(ecosystemId, pagination);

      return {
        schemas,
        totalCount
      };
    } catch (error) {
      this.logger.error(`Error getting ecosystem schemas: ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  /**
   * Create ecosystem invitation
   */
  async createEcosystemInvitation(data: ICreateEcosystemInvitation): Promise<object> {
    try {
      this.logger.log(`Creating invitation for ${data.email} to ecosystem ${data.ecosystemId}`);

      // Check if ecosystem exists
      const ecosystem = await this.ecosystemRepository.getEcosystemById(data.ecosystemId);
      if (!ecosystem) {
        throw new NotFoundException('Ecosystem not found');
      }

      // If orgId is provided, check if organization exists
      if (data.orgId) {
        const organization = await this.prisma.organisation.findUnique({
          where: { id: data.orgId }
        });

        if (!organization) {
          throw new NotFoundException('Organization not found');
        }
      }

      const invitation = await this.ecosystemRepository.createEcosystemInvitation(data);

      this.logger.log(`Ecosystem invitation created successfully`);

      // TODO: Send invitation email

      return {
        message: 'Ecosystem invitation created successfully',
        data: invitation
      };
    } catch (error) {
      this.logger.error(`Error creating ecosystem invitation: ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  /**
   * Get ecosystem invitations
   */
  async getEcosystemInvitations(
    ecosystemId: string,
    pagination: IEcosystemPagination
  ): Promise<IGetEcosystemInvitations> {
    try {
      this.logger.log(`Fetching invitations for ecosystem: ${ecosystemId}`);

      // Check if ecosystem exists
      const ecosystem = await this.ecosystemRepository.getEcosystemById(ecosystemId);
      if (!ecosystem) {
        throw new NotFoundException('Ecosystem not found');
      }

      const { invitations, totalCount } = await this.ecosystemRepository.getEcosystemInvitations(
        ecosystemId,
        pagination
      );

      return {
        invitations,
        totalCount
      };
    } catch (error) {
      this.logger.error(`Error getting ecosystem invitations: ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }
}
