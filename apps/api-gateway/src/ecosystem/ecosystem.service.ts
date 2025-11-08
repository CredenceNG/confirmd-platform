import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { BaseService } from 'libs/service/base.service';
import { ecosystem } from '@prisma/client';

@Injectable()
export class EcosystemService extends BaseService {
  constructor(@Inject('NATS_CLIENT') private readonly natsClient: ClientProxy) {
    super('EcosystemService');
  }

  /**
   * Create a new ecosystem
   */
  async createEcosystem(createEcosystemDto: object, userId: string): Promise<ecosystem> {
    const payload = { createEcosystemDto, userId };
    return firstValueFrom(this.natsClient.send({ cmd: 'create-ecosystem' }, payload));
  }

  /**
   * Get ecosystem by ID
   */
  async getEcosystemById(ecosystemId: string): Promise<ecosystem> {
    const payload = { ecosystemId };
    return firstValueFrom(this.natsClient.send({ cmd: 'get-ecosystem-by-id' }, payload));
  }

  /**
   * Get all ecosystems
   */
  async getAllEcosystems(pageNumber: number, pageSize: number, search: string): Promise<object> {
    const payload = { pageNumber, pageSize, search };
    return firstValueFrom(this.natsClient.send({ cmd: 'get-all-ecosystems' }, payload));
  }

  /**
   * Update ecosystem
   */
  async updateEcosystem(updateEcosystemDto: object, ecosystemId: string, userId: string): Promise<ecosystem> {
    const payload = { updateEcosystemDto, ecosystemId, userId };
    return firstValueFrom(this.natsClient.send({ cmd: 'update-ecosystem' }, payload));
  }

  /**
   * Delete ecosystem
   */
  async deleteEcosystem(ecosystemId: string, userId: string): Promise<object> {
    const payload = { ecosystemId, userId };
    return firstValueFrom(this.natsClient.send({ cmd: 'delete-ecosystem' }, payload));
  }

  /**
   * Add organization to ecosystem
   */
  async addOrganizationToEcosystem(addOrgDto: object, ecosystemId: string, userId: string): Promise<object> {
    const payload = { addOrgDto, ecosystemId, userId };
    return firstValueFrom(this.natsClient.send({ cmd: 'add-org-to-ecosystem' }, payload));
  }

  /**
   * Remove organization from ecosystem
   */
  async removeOrganizationFromEcosystem(ecosystemId: string, orgId: string, userId: string): Promise<object> {
    const payload = { ecosystemId, orgId, userId };
    return firstValueFrom(this.natsClient.send({ cmd: 'remove-org-from-ecosystem' }, payload));
  }

  /**
   * Get ecosystem organizations
   */
  async getEcosystemOrganizations(
    ecosystemId: string,
    pageNumber: number,
    pageSize: number,
    search: string
  ): Promise<object> {
    const payload = { ecosystemId, pageNumber, pageSize, search };
    return firstValueFrom(this.natsClient.send({ cmd: 'get-ecosystem-orgs' }, payload));
  }

  /**
   * Add schema to ecosystem
   */
  async addSchemaToEcosystem(addSchemaDto: object, ecosystemId: string, userId: string): Promise<object> {
    const payload = { addSchemaDto, ecosystemId, userId };
    return firstValueFrom(this.natsClient.send({ cmd: 'add-schema-to-ecosystem' }, payload));
  }

  /**
   * Update schema pricing
   */
  async updateSchemaPricing(
    updatePricingDto: object,
    ecosystemId: string,
    schemaId: string,
    userId: string
  ): Promise<object> {
    const payload = { updatePricingDto, ecosystemId, schemaId, userId };
    return firstValueFrom(this.natsClient.send({ cmd: 'update-schema-pricing' }, payload));
  }

  /**
   * Get ecosystem schemas
   */
  async getEcosystemSchemas(
    ecosystemId: string,
    pageNumber: number,
    pageSize: number,
    search: string
  ): Promise<object> {
    const payload = { ecosystemId, pageNumber, pageSize, search };
    return firstValueFrom(this.natsClient.send({ cmd: 'get-ecosystem-schemas' }, payload));
  }

  /**
   * Create ecosystem invitation
   */
  async createEcosystemInvitation(invitationDto: object, ecosystemId: string, userId: string): Promise<object> {
    const payload = { invitationDto, ecosystemId, userId };
    return firstValueFrom(this.natsClient.send({ cmd: 'create-ecosystem-invitation' }, payload));
  }

  /**
   * Get ecosystem invitations
   */
  async getEcosystemInvitations(
    ecosystemId: string,
    pageNumber: number,
    pageSize: number,
    search: string
  ): Promise<object> {
    const payload = { ecosystemId, pageNumber, pageSize, search };
    return firstValueFrom(this.natsClient.send({ cmd: 'get-ecosystem-invitations' }, payload));
  }
}
