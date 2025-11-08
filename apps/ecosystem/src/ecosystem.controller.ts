import { Controller, Logger, Body } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { EcosystemService } from './ecosystem.service';
import { CreateEcosystemDto } from '../dtos/create-ecosystem.dto';
import { UpdateEcosystemDto } from '../dtos/update-ecosystem.dto';
import { AddOrgToEcosystemDto } from '../dtos/add-org-to-ecosystem.dto';
import { AddSchemaToEcosystemDto } from '../dtos/add-schema-to-ecosystem.dto';
import { UpdateSchemaPricingDto } from '../dtos/update-schema-pricing.dto';
import { CreateEcosystemInvitationDto } from '../dtos/create-invitation.dto';
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

@Controller()
export class EcosystemController {
  constructor(private readonly ecosystemService: EcosystemService) {}
  private readonly logger = new Logger('EcosystemController');

  /**
   * Create a new ecosystem
   */
  @MessagePattern({ cmd: 'create-ecosystem' })
  async createEcosystem(
    @Body() payload: { createEcosystemDto: CreateEcosystemDto; userId: string }
  ): Promise<ecosystem> {
    const data: ICreateEcosystem = {
      name: payload.createEcosystemDto.name,
      logo: payload.createEcosystemDto.logo,
      description: payload.createEcosystemDto.description,
      userId: payload.userId
    };
    return this.ecosystemService.createEcosystem(data);
  }

  /**
   * Get ecosystem by ID
   */
  @MessagePattern({ cmd: 'get-ecosystem-by-id' })
  async getEcosystemById(@Body() payload: { ecosystemId: string }): Promise<ecosystem> {
    return this.ecosystemService.getEcosystemById(payload.ecosystemId);
  }

  /**
   * Get all ecosystems with pagination
   */
  @MessagePattern({ cmd: 'get-all-ecosystems' })
  async getAllEcosystems(
    @Body() payload: { pageNumber: number; pageSize: number; search: string }
  ): Promise<IGetEcosystems> {
    const pagination: IEcosystemPagination = {
      pageNumber: payload.pageNumber || 1,
      pageSize: payload.pageSize || 10,
      search: payload.search || ''
    };
    return this.ecosystemService.getAllEcosystems(pagination);
  }

  /**
   * Update an ecosystem
   */
  @MessagePattern({ cmd: 'update-ecosystem' })
  async updateEcosystem(
    @Body() payload: { updateEcosystemDto: UpdateEcosystemDto; ecosystemId: string; userId: string }
  ): Promise<ecosystem> {
    const data: IUpdateEcosystem = {
      ecosystemId: payload.ecosystemId,
      name: payload.updateEcosystemDto.name,
      logo: payload.updateEcosystemDto.logo,
      description: payload.updateEcosystemDto.description,
      userId: payload.userId
    };
    return this.ecosystemService.updateEcosystem(data);
  }

  /**
   * Delete an ecosystem
   */
  @MessagePattern({ cmd: 'delete-ecosystem' })
  async deleteEcosystem(@Body() payload: { ecosystemId: string; userId: string }): Promise<{ message: string }> {
    return this.ecosystemService.deleteEcosystem(payload.ecosystemId, payload.userId);
  }

  /**
   * Add organization to ecosystem
   */
  @MessagePattern({ cmd: 'add-org-to-ecosystem' })
  async addOrganizationToEcosystem(
    @Body() payload: { addOrgDto: AddOrgToEcosystemDto; ecosystemId: string; userId: string }
  ): Promise<object> {
    const data: IAddOrgToEcosystem = {
      ecosystemId: payload.ecosystemId,
      orgId: payload.addOrgDto.orgId,
      ecosystemRole: payload.addOrgDto.ecosystemRole,
      userId: payload.userId
    };
    return this.ecosystemService.addOrganizationToEcosystem(data);
  }

  /**
   * Remove organization from ecosystem
   */
  @MessagePattern({ cmd: 'remove-org-from-ecosystem' })
  async removeOrganizationFromEcosystem(
    @Body() payload: { ecosystemId: string; orgId: string; userId: string }
  ): Promise<{ message: string }> {
    const data: IRemoveOrgFromEcosystem = {
      ecosystemId: payload.ecosystemId,
      orgId: payload.orgId,
      userId: payload.userId
    };
    return this.ecosystemService.removeOrganizationFromEcosystem(data);
  }

  /**
   * Get ecosystem organizations
   */
  @MessagePattern({ cmd: 'get-ecosystem-orgs' })
  async getEcosystemOrganizations(
    @Body() payload: { ecosystemId: string; pageNumber: number; pageSize: number; search: string }
  ): Promise<IGetEcosystemOrgs> {
    const pagination: IEcosystemPagination = {
      pageNumber: payload.pageNumber || 1,
      pageSize: payload.pageSize || 10,
      search: payload.search || ''
    };
    return this.ecosystemService.getEcosystemOrganizations(payload.ecosystemId, pagination);
  }

  /**
   * Add schema to ecosystem
   */
  @MessagePattern({ cmd: 'add-schema-to-ecosystem' })
  async addSchemaToEcosystem(
    @Body() payload: { addSchemaDto: AddSchemaToEcosystemDto; ecosystemId: string; userId: string }
  ): Promise<object> {
    const data: IAddSchemaToEcosystem = {
      ecosystemId: payload.ecosystemId,
      schemaLedgerId: payload.addSchemaDto.schemaLedgerId,

      // Pricing
      issuancePrice: payload.addSchemaDto.issuancePrice,
      verificationPrice: payload.addSchemaDto.verificationPrice,
      revocationPrice: payload.addSchemaDto.revocationPrice,
      currency: payload.addSchemaDto.currency,

      // Issuance Revenue Sharing
      issuancePlatformShare: payload.addSchemaDto.issuancePlatformShare,
      issuanceEcosystemShare: payload.addSchemaDto.issuanceEcosystemShare,
      issuanceIssuerShare: payload.addSchemaDto.issuanceIssuerShare,

      // Verification Revenue Sharing
      verificationPlatformShare: payload.addSchemaDto.verificationPlatformShare,
      verificationEcosystemShare: payload.addSchemaDto.verificationEcosystemShare,
      verificationVerifierShare: payload.addSchemaDto.verificationVerifierShare,

      // Revocation Revenue Sharing
      revocationPlatformShare: payload.addSchemaDto.revocationPlatformShare,
      revocationEcosystemShare: payload.addSchemaDto.revocationEcosystemShare,
      revocationIssuerShare: payload.addSchemaDto.revocationIssuerShare,

      userId: payload.userId
    };
    return this.ecosystemService.addSchemaToEcosystem(data);
  }

  /**
   * Update schema pricing
   */
  @MessagePattern({ cmd: 'update-schema-pricing' })
  async updateSchemaPricing(
    @Body() payload: { updatePricingDto: UpdateSchemaPricingDto; ecosystemId: string; schemaId: string; userId: string }
  ): Promise<object> {
    const data: IUpdateSchemaPricing = {
      ecosystemId: payload.ecosystemId,
      schemaId: payload.schemaId,

      // Pricing
      issuancePrice: payload.updatePricingDto.issuancePrice,
      verificationPrice: payload.updatePricingDto.verificationPrice,
      revocationPrice: payload.updatePricingDto.revocationPrice,
      currency: payload.updatePricingDto.currency,

      // Issuance Revenue Sharing
      issuancePlatformShare: payload.updatePricingDto.issuancePlatformShare,
      issuanceEcosystemShare: payload.updatePricingDto.issuanceEcosystemShare,
      issuanceIssuerShare: payload.updatePricingDto.issuanceIssuerShare,

      // Verification Revenue Sharing
      verificationPlatformShare: payload.updatePricingDto.verificationPlatformShare,
      verificationEcosystemShare: payload.updatePricingDto.verificationEcosystemShare,
      verificationVerifierShare: payload.updatePricingDto.verificationVerifierShare,

      // Revocation Revenue Sharing
      revocationPlatformShare: payload.updatePricingDto.revocationPlatformShare,
      revocationEcosystemShare: payload.updatePricingDto.revocationEcosystemShare,
      revocationIssuerShare: payload.updatePricingDto.revocationIssuerShare,

      userId: payload.userId
    };
    return this.ecosystemService.updateSchemaPricing(data);
  }

  /**
   * Get ecosystem schemas
   */
  @MessagePattern({ cmd: 'get-ecosystem-schemas' })
  async getEcosystemSchemas(
    @Body() payload: { ecosystemId: string; pageNumber: number; pageSize: number; search: string }
  ): Promise<IGetEcosystemSchemas> {
    const pagination: IEcosystemPagination = {
      pageNumber: payload.pageNumber || 1,
      pageSize: payload.pageSize || 10,
      search: payload.search || ''
    };
    return this.ecosystemService.getEcosystemSchemas(payload.ecosystemId, pagination);
  }

  /**
   * Create ecosystem invitation
   */
  @MessagePattern({ cmd: 'create-ecosystem-invitation' })
  async createEcosystemInvitation(
    @Body() payload: { invitationDto: CreateEcosystemInvitationDto; ecosystemId: string; userId: string }
  ): Promise<object> {
    const data: ICreateEcosystemInvitation = {
      ecosystemId: payload.ecosystemId,
      email: payload.invitationDto.email,
      orgId: payload.invitationDto.orgId,
      ecosystemRole: payload.invitationDto.ecosystemRole,
      userId: payload.userId
    };
    return this.ecosystemService.createEcosystemInvitation(data);
  }

  /**
   * Get ecosystem invitations
   */
  @MessagePattern({ cmd: 'get-ecosystem-invitations' })
  async getEcosystemInvitations(
    @Body() payload: { ecosystemId: string; pageNumber: number; pageSize: number; search: string }
  ): Promise<IGetEcosystemInvitations> {
    const pagination: IEcosystemPagination = {
      pageNumber: payload.pageNumber || 1,
      pageSize: payload.pageSize || 10,
      search: payload.search || ''
    };
    return this.ecosystemService.getEcosystemInvitations(payload.ecosystemId, pagination);
  }
}
