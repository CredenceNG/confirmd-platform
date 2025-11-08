import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@credebl/prisma-service';
import {
  ICreateEcosystem,
  IUpdateEcosystem,
  IAddOrgToEcosystem,
  IAddSchemaToEcosystem,
  IUpdateSchemaPricing,
  ICreateEcosystemInvitation,
  IEcosystemPagination
} from '../interfaces/ecosystem.interface';
import {
  ecosystem,
  // eslint-disable-next-line camelcase
  ecosystem_orgs,
  // eslint-disable-next-line camelcase
  ecosystem_schemas,
  // eslint-disable-next-line camelcase
  ecosystem_invitations,
  // eslint-disable-next-line camelcase
  ecosystem_transactions
} from '@prisma/client';

@Injectable()
export class EcosystemRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger
  ) {}

  // Ecosystem CRUD operations
  async createEcosystem(data: ICreateEcosystem): Promise<ecosystem> {
    try {
      return await this.prisma.ecosystem.create({
        data: {
          name: data.name,
          logo: data.logo,
          description: data.description,
          createdBy: data.userId,
          lastChangedBy: data.userId
        }
      });
    } catch (error) {
      this.logger.error(`Error creating ecosystem: ${JSON.stringify(error)}`);
      throw error;
    }
  }

  async getEcosystemById(ecosystemId: string): Promise<ecosystem> {
    try {
      const ecosystem = await this.prisma.ecosystem.findUnique({
        where: {
          id: ecosystemId,
          deletedAt: null
        },
        include: {
          organizations: {
            where: { deletedAt: null },
            include: {
              organisation: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  logoUrl: true
                }
              }
            }
          },
          schemas: {
            where: { deletedAt: null }
          },
          invitations: {
            where: { deletedAt: null }
          }
        }
      });

      if (!ecosystem) {
        throw new NotFoundException('Ecosystem not found');
      }

      return ecosystem;
    } catch (error) {
      this.logger.error(`Error getting ecosystem by id: ${JSON.stringify(error)}`);
      throw error;
    }
  }

  async getAllEcosystems(pagination: IEcosystemPagination): Promise<{ ecosystems: ecosystem[]; totalCount: number }> {
    try {
      const { pageNumber, pageSize, search } = pagination;
      const skip = (pageNumber - 1) * pageSize;

      const whereClause = {
        deletedAt: null,
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } }
          ]
        })
      };

      const [ecosystems, totalCount] = await Promise.all([
        this.prisma.ecosystem.findMany({
          where: whereClause,
          skip,
          take: pageSize,
          orderBy: {
            createDateTime: 'desc'
          },
          include: {
            organizations: {
              where: { deletedAt: null },
              select: {
                id: true,
                ecosystemRole: true,
                organisation: {
                  select: {
                    id: true,
                    name: true,
                    logoUrl: true
                  }
                }
              }
            }
          }
        }),
        this.prisma.ecosystem.count({ where: whereClause })
      ]);

      return { ecosystems, totalCount };
    } catch (error) {
      this.logger.error(`Error getting all ecosystems: ${JSON.stringify(error)}`);
      throw error;
    }
  }

  async updateEcosystem(data: IUpdateEcosystem): Promise<ecosystem> {
    try {
      const updateData: Record<string, unknown> = {
        lastChangedBy: data.userId,
        lastChangedDateTime: new Date()
      };

      if (data.name) {
        updateData.name = data.name;
      }
      if (data.logo !== undefined) {
        updateData.logo = data.logo;
      }
      if (data.description !== undefined) {
        updateData.description = data.description;
      }

      return await this.prisma.ecosystem.update({
        where: {
          id: data.ecosystemId
        },
        data: updateData
      });
    } catch (error) {
      this.logger.error(`Error updating ecosystem: ${JSON.stringify(error)}`);
      throw error;
    }
  }

  async deleteEcosystem(ecosystemId: string, userId: string): Promise<ecosystem> {
    try {
      return await this.prisma.ecosystem.update({
        where: {
          id: ecosystemId
        },
        data: {
          deletedAt: new Date(),
          lastChangedBy: userId,
          lastChangedDateTime: new Date()
        }
      });
    } catch (error) {
      this.logger.error(`Error deleting ecosystem: ${JSON.stringify(error)}`);
      throw error;
    }
  }

  // Organization management
  // eslint-disable-next-line camelcase
  async addOrganizationToEcosystem(data: IAddOrgToEcosystem): Promise<ecosystem_orgs> {
    try {
      // Check if organization is already in ecosystem
      // eslint-disable-next-line camelcase
      const existing = await this.prisma.ecosystem_orgs.findFirst({
        where: {
          ecosystemId: data.ecosystemId,
          orgId: data.orgId,
          deletedAt: null
        }
      });

      if (existing) {
        throw new ConflictException('Organization is already part of this ecosystem');
      }

      // eslint-disable-next-line camelcase
      return await this.prisma.ecosystem_orgs.create({
        data: {
          ecosystemId: data.ecosystemId,
          orgId: data.orgId,
          ecosystemRole: data.ecosystemRole,
          createdBy: data.userId
        }
      });
    } catch (error) {
      this.logger.error(`Error adding organization to ecosystem: ${JSON.stringify(error)}`);
      throw error;
    }
  }

  // eslint-disable-next-line camelcase
  async removeOrganizationFromEcosystem(ecosystemId: string, orgId: string): Promise<ecosystem_orgs> {
    try {
      // eslint-disable-next-line camelcase
      const ecosystemOrg = await this.prisma.ecosystem_orgs.findFirst({
        where: {
          ecosystemId,
          orgId,
          deletedAt: null
        }
      });

      if (!ecosystemOrg) {
        throw new NotFoundException('Organization not found in this ecosystem');
      }

      // eslint-disable-next-line camelcase
      return await this.prisma.ecosystem_orgs.update({
        where: {
          id: ecosystemOrg.id
        },
        data: {
          deletedAt: new Date()
        }
      });
    } catch (error) {
      this.logger.error(`Error removing organization from ecosystem: ${JSON.stringify(error)}`);
      throw error;
    }
  }

  // eslint-disable-next-line camelcase
  async getEcosystemOrganizations(
    ecosystemId: string,
    pagination: IEcosystemPagination
  ): Promise<{ organizations: ecosystem_orgs[]; totalCount: number }> {
    try {
      const { pageNumber, pageSize, search } = pagination;
      const skip = (pageNumber - 1) * pageSize;

      const whereClause: Record<string, unknown> = {
        ecosystemId,
        deletedAt: null
      };

      if (search) {
        whereClause.organisation = {
          name: { contains: search, mode: 'insensitive' as const }
        };
      }

      const [organizations, totalCount] = await Promise.all([
        // eslint-disable-next-line camelcase
        this.prisma.ecosystem_orgs.findMany({
          where: whereClause,
          skip,
          take: pageSize,
          include: {
            organisation: {
              select: {
                id: true,
                name: true,
                description: true,
                logoUrl: true,
                website: true
              }
            }
          },
          orderBy: {
            createDateTime: 'desc'
          }
        }),
        // eslint-disable-next-line camelcase
        this.prisma.ecosystem_orgs.count({ where: whereClause })
      ]);

      return { organizations, totalCount };
    } catch (error) {
      this.logger.error(`Error getting ecosystem organizations: ${JSON.stringify(error)}`);
      throw error;
    }
  }

  // Schema management
  // eslint-disable-next-line camelcase
  async addSchemaToEcosystem(data: IAddSchemaToEcosystem): Promise<ecosystem_schemas> {
    try {
      // Check if schema already exists in ecosystem
      // eslint-disable-next-line camelcase
      const existing = await this.prisma.ecosystem_schemas.findFirst({
        where: {
          ecosystemId: data.ecosystemId,
          schemaLedgerId: data.schemaLedgerId,
          deletedAt: null
        }
      });

      if (existing) {
        throw new ConflictException('Schema already exists in this ecosystem');
      }

      // eslint-disable-next-line camelcase
      return await this.prisma.ecosystem_schemas.create({
        data: {
          ecosystemId: data.ecosystemId,
          schemaLedgerId: data.schemaLedgerId,

          // Pricing
          issuancePrice: data.issuancePrice,
          verificationPrice: data.verificationPrice,
          revocationPrice: data.revocationPrice,
          currency: data.currency,

          // Issuance Revenue Sharing
          issuancePlatformShare: data.issuancePlatformShare,
          issuanceEcosystemShare: data.issuanceEcosystemShare,
          issuanceIssuerShare: data.issuanceIssuerShare,

          // Verification Revenue Sharing
          verificationPlatformShare: data.verificationPlatformShare,
          verificationEcosystemShare: data.verificationEcosystemShare,
          verificationVerifierShare: data.verificationVerifierShare,

          // Revocation Revenue Sharing
          revocationPlatformShare: data.revocationPlatformShare,
          revocationEcosystemShare: data.revocationEcosystemShare,
          revocationIssuerShare: data.revocationIssuerShare,

          createdBy: data.userId,
          lastChangedBy: data.userId
        }
      });
    } catch (error) {
      this.logger.error(`Error adding schema to ecosystem: ${JSON.stringify(error)}`);
      throw error;
    }
  }

  // eslint-disable-next-line camelcase
  async updateSchemaPricing(data: IUpdateSchemaPricing): Promise<ecosystem_schemas> {
    try {
      const updateData: Record<string, unknown> = {
        lastChangedBy: data.userId,
        lastChangedDateTime: new Date()
      };

      // Pricing
      if (data.issuancePrice !== undefined) {
        updateData.issuancePrice = data.issuancePrice;
      }
      if (data.verificationPrice !== undefined) {
        updateData.verificationPrice = data.verificationPrice;
      }
      if (data.revocationPrice !== undefined) {
        updateData.revocationPrice = data.revocationPrice;
      }
      if (data.currency !== undefined) {
        updateData.currency = data.currency;
      }

      // Issuance Revenue Sharing
      if (data.issuancePlatformShare !== undefined) {
        updateData.issuancePlatformShare = data.issuancePlatformShare;
      }
      if (data.issuanceEcosystemShare !== undefined) {
        updateData.issuanceEcosystemShare = data.issuanceEcosystemShare;
      }
      if (data.issuanceIssuerShare !== undefined) {
        updateData.issuanceIssuerShare = data.issuanceIssuerShare;
      }

      // Verification Revenue Sharing
      if (data.verificationPlatformShare !== undefined) {
        updateData.verificationPlatformShare = data.verificationPlatformShare;
      }
      if (data.verificationEcosystemShare !== undefined) {
        updateData.verificationEcosystemShare = data.verificationEcosystemShare;
      }
      if (data.verificationVerifierShare !== undefined) {
        updateData.verificationVerifierShare = data.verificationVerifierShare;
      }

      // Revocation Revenue Sharing
      if (data.revocationPlatformShare !== undefined) {
        updateData.revocationPlatformShare = data.revocationPlatformShare;
      }
      if (data.revocationEcosystemShare !== undefined) {
        updateData.revocationEcosystemShare = data.revocationEcosystemShare;
      }
      if (data.revocationIssuerShare !== undefined) {
        updateData.revocationIssuerShare = data.revocationIssuerShare;
      }

      // eslint-disable-next-line camelcase
      return await this.prisma.ecosystem_schemas.update({
        where: {
          id: data.schemaId
        },
        data: updateData
      });
    } catch (error) {
      this.logger.error(`Error updating schema pricing: ${JSON.stringify(error)}`);
      throw error;
    }
  }

  // eslint-disable-next-line camelcase
  async getEcosystemSchemas(
    ecosystemId: string,
    pagination: IEcosystemPagination
  ): Promise<{ schemas: ecosystem_schemas[]; totalCount: number }> {
    try {
      const { pageNumber, pageSize, search } = pagination;
      const skip = (pageNumber - 1) * pageSize;

      const whereClause: Record<string, unknown> = {
        ecosystemId,
        deletedAt: null
      };

      if (search) {
        whereClause.schemaLedgerId = { contains: search, mode: 'insensitive' as const };
      }

      const [schemas, totalCount] = await Promise.all([
        // eslint-disable-next-line camelcase
        this.prisma.ecosystem_schemas.findMany({
          where: whereClause,
          skip,
          take: pageSize,
          orderBy: {
            createDateTime: 'desc'
          }
        }),
        this.prisma.ecosystem_schemas.count({ where: whereClause })
      ]);

      return { schemas, totalCount };
    } catch (error) {
      this.logger.error(`Error getting ecosystem schemas: ${JSON.stringify(error)}`);
      throw error;
    }
  }

  // Invitation management
  // eslint-disable-next-line camelcase
  async createEcosystemInvitation(data: ICreateEcosystemInvitation): Promise<ecosystem_invitations> {
    try {
      // Check if invitation already exists for this email in this ecosystem
      const existing = await this.prisma.ecosystem_invitations.findFirst({
        where: {
          ecosystemId: data.ecosystemId,
          email: data.email,
          deletedAt: null
        }
      });

      if (existing) {
        throw new ConflictException('Invitation already exists for this email in this ecosystem');
      }

      // eslint-disable-next-line camelcase
      return await this.prisma.ecosystem_invitations.create({
        data: {
          ecosystemId: data.ecosystemId,
          email: data.email,
          orgId: data.orgId,
          ecosystemRole: data.ecosystemRole,
          createdBy: data.userId
        }
      });
    } catch (error) {
      this.logger.error(`Error creating ecosystem invitation: ${JSON.stringify(error)}`);
      throw error;
    }
  }

  // eslint-disable-next-line camelcase
  async getEcosystemInvitations(
    ecosystemId: string,
    pagination: IEcosystemPagination
  ): Promise<{ invitations: ecosystem_invitations[]; totalCount: number }> {
    try {
      const { pageNumber, pageSize, search } = pagination;
      const skip = (pageNumber - 1) * pageSize;

      const whereClause: Record<string, unknown> = {
        ecosystemId,
        deletedAt: null
      };

      if (search) {
        whereClause.email = { contains: search, mode: 'insensitive' as const };
      }

      const [invitations, totalCount] = await Promise.all([
        // eslint-disable-next-line camelcase
        this.prisma.ecosystem_invitations.findMany({
          where: whereClause,
          skip,
          take: pageSize,
          orderBy: {
            createDateTime: 'desc'
          }
        }),
        this.prisma.ecosystem_invitations.count({ where: whereClause })
      ]);

      return { invitations, totalCount };
    } catch (error) {
      this.logger.error(`Error getting ecosystem invitations: ${JSON.stringify(error)}`);
      throw error;
    }
  }

  // Transaction management
  // eslint-disable-next-line camelcase
  async createTransaction(data: Record<string, unknown>): Promise<ecosystem_transactions> {
    try {
      // eslint-disable-next-line camelcase
      return await this.prisma.ecosystem_transactions.create({
        data: {
          ecosystemId: data.ecosystemId,
          orgId: data.orgId,
          schemaLedgerId: data.schemaLedgerId,
          transactionType: data.transactionType,
          amount: data.amount,
          issuerShare: data.issuerShare,
          platformShare: data.platformShare,
          credentialId: data.credentialId
        }
      });
    } catch (error) {
      this.logger.error(`Error creating transaction: ${JSON.stringify(error)}`);
      throw error;
    }
  }

  async checkEcosystemExists(name: string): Promise<ecosystem | null> {
    try {
      return await this.prisma.ecosystem.findFirst({
        where: {
          name,
          deletedAt: null
        }
      });
    } catch (error) {
      this.logger.error(`Error checking ecosystem exists: ${JSON.stringify(error)}`);
      throw error;
    }
  }
}
