import { Inject } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { BaseService } from 'libs/service/base.service';
import { CreateOrganizationDto } from './dtos/create-organization-dto';
import { OrganizationRegistrationDto } from './dtos/organization-registration.dto';
import { BulkSendInvitationDto } from './dtos/send-invitation.dto';
import { UpdateUserRolesDto } from './dtos/update-user-roles.dto';
import { UpdateOrganizationDto } from './dtos/update-organization-dto';
import { organisation, user } from '@prisma/client';
import {
  IDidList,
  IGetOrgById,
  IGetOrganization
} from 'apps/organization/interfaces/organization.interface';
import { IOrgUsers } from 'apps/user/interfaces/user.interface';
import {
  IOrgCredentials,
  IOrganization,
  IOrganizationInvitations,
  IOrganizationDashboard,
  IDeleteOrganization,
  IOrgActivityCount
} from '@credebl/common/interfaces/organization.interface';
import { ClientCredentialsDto } from './dtos/client-credentials.dto';
import { IAccessTokenData } from '@credebl/common/interfaces/interface';
import { PaginationDto } from '@credebl/common/dtos/pagination.dto';
import { IClientRoles } from '@credebl/client-registration/interfaces/client.interface';
import { GetAllOrganizationsDto } from './dtos/get-organizations.dto';
import { PrimaryDid } from './dtos/set-primary-did.dto';

@Injectable()
export class OrganizationService extends BaseService {
  constructor(@Inject('NATS_CLIENT') private readonly natsClient: ClientProxy) {
    super('OrganizationService');
  }

  /**
   *
   * @param createOrgDto
   * @returns Organization creation Success
   */
  async createOrganization(
    createOrgDto: CreateOrganizationDto,
    userId: string,
    keycloakUserId: string
  ): Promise<organisation> {
    const payload = { createOrgDto, userId, keycloakUserId };
    return firstValueFrom(
      this.natsClient.send({ cmd: 'create-organization' }, payload)
    );
  }

  /**
   *
   * @param orgRegistrationDto
   * @param userId
   * @returns Organization registration submission
   */
  async registerOrganization(
    orgRegistrationDto: OrganizationRegistrationDto,
    userId: string
  ): Promise<organisation> {
    const payload = { orgRegistrationDto, userId };
    return firstValueFrom(
      this.natsClient.send({ cmd: 'register-organization' }, payload)
    );
  }

  /**
   *
   * @param userId
   * @returns User's organization status
   */
  async getMyOrganization(userId: string): Promise<organisation | null> {
    const payload = { userId };
    return firstValueFrom(
      this.natsClient.send({ cmd: 'get-my-organization' }, payload)
    );
  }

  /**
   *
   * @param primaryDidPayload
   * @returns Set Primary Did for organization
   */
  async setPrimaryDid(
    primaryDidPayload: PrimaryDid,
    orgId: string
  ): Promise<organisation> {
    const { did, id } = primaryDidPayload;
    const payload = { did, orgId, id };
    return firstValueFrom(
      this.natsClient.send({ cmd: 'set-primary-did' }, payload)
    );
  }

  /**
   *
   * @param orgId
   * @param userId
   * @returns Orgnization client credentials
   */
  async createOrgCredentials(
    orgId: string,
    userId: string,
    keycloakUserId: string
  ): Promise<IOrgCredentials> {
    const payload = { orgId, userId, keycloakUserId };
    return firstValueFrom(
      this.natsClient.send({ cmd: 'create-org-credentials' }, payload)
    );
  }

  /**
   *
   * @param updateOrgDto
   * @returns Organization update Success
   */
  async updateOrganization(
    updateOrgDto: UpdateOrganizationDto,
    userId: string,
    orgId: string
  ): Promise<organisation> {
    const payload = { updateOrgDto, userId, orgId };
    return firstValueFrom(
      this.natsClient.send({ cmd: 'update-organization' }, payload)
    );
  }

  /**
   *
   * @param orgId
   * @returns Organization details with owner
   */
  async findOrganizationOwner(orgId: string): Promise<IOrganization> {
    return firstValueFrom(
      this.natsClient.send({ cmd: 'get-organization-owner' }, orgId)
    );
  }

  /**
   *
   * @param
   * @returns Organizations details
   */

  async getOrganizations(
    organizationDto: GetAllOrganizationsDto,
    userId: string
  ): Promise<IGetOrganization> {
    const payload = { userId, ...organizationDto };
    const fetchOrgs = await firstValueFrom(
      this.natsClient.send({ cmd: 'get-organizations' }, payload)
    );
    return fetchOrgs;
  }

  /**
   *
   * @param
   * @returns Public organizations list
   */
  async getPublicOrganizations(
    paginationDto: PaginationDto
  ): Promise<IGetOrganization> {
    const payload = { ...paginationDto };
    const PublicOrg = await firstValueFrom(
      this.natsClient.send({ cmd: 'get-public-organizations' }, payload)
    );
    return PublicOrg;
  }

  async getPublicProfile(orgSlug: string): Promise<IGetOrgById> {
    const payload = { orgSlug };
    try {
      return firstValueFrom(
        this.natsClient.send(
          { cmd: 'get-organization-public-profile' },
          payload
        )
      );
    } catch (error) {
      this.logger.error(`Error in getPublicProfile for orgSlug '${orgSlug}': ${JSON.stringify(error)}`);
    }
  }

  /**
   *
   * @param orgId
   * @returns Organization get Success
   */
  async getOrganization(orgId: string, userId: string): Promise<IGetOrgById> {
    const payload = { orgId, userId };
    return firstValueFrom(
      this.natsClient.send({ cmd: 'get-organization-by-id' }, payload)
    );
  }

  async fetchOrgCredentials(
    orgId: string,
    userId: string
  ): Promise<IOrgCredentials> {
    const payload = { orgId, userId };
    return firstValueFrom(
      this.natsClient.send({ cmd: 'fetch-org-client-credentials' }, payload)
    );
  }

  /**
   *
   * @param orgId
   * @returns Invitations details
   */
  async getInvitationsByOrgId(
    orgId: string,
    pagination: PaginationDto
  ): Promise<IOrganizationInvitations> {
    const { pageNumber, pageSize, search } = pagination;
    const payload = { orgId, pageNumber, pageSize, search };
    return firstValueFrom(
      this.natsClient.send({ cmd: 'get-invitations-by-orgId' }, payload)
    );
  }

  async getOrganizationDashboard(
    orgId: string,
    userId: string
  ): Promise<IOrganizationDashboard> {
    const payload = { orgId, userId };
    return firstValueFrom(
      this.natsClient.send({ cmd: 'get-organization-dashboard' }, payload)
    );
  }

  async getOrganizationActivityCount(
    orgId: string,
    userId: string
  ): Promise<IOrgActivityCount> {
    const payload = { orgId, userId };
    return firstValueFrom(
      this.natsClient.send({ cmd: 'get-organization-activity-count' }, payload)
    );
  }

  /**
   *
   * @param
   * @returns get organization roles
   */

  async getOrgRoles(orgId: string, user: user): Promise<IClientRoles[]> {
    const payload = { orgId, user };
    return firstValueFrom(
      this.natsClient.send({ cmd: 'get-org-roles' }, payload)
    );
  }

  /**
   *
   * @param sendInvitationDto
   * @returns Organization invitation creation Success
   */
  async createInvitation(
    bulkInvitationDto: BulkSendInvitationDto,
    userId: string,
    userEmail: string
  ): Promise<string> {
    const payload = { bulkInvitationDto, userId, userEmail };
    return firstValueFrom(
      this.natsClient.send({ cmd: 'send-invitation' }, payload)
    );
  }

  async registerOrgsMapUsers(): Promise<string> {
    const payload = {};
    return firstValueFrom(
      this.natsClient.send({ cmd: 'register-orgs-users-map' }, payload)
    );
  }

  /**
   *
   * @param updateUserDto
   * @param userId
   * @param user JWT user context for platform admin detection
   * @returns User roles update response
   */
  async updateUserRoles(
    updateUserDto: UpdateUserRolesDto,
    userId: string,
    user: user
  ): Promise<boolean> {
    // Role update operation - ALWAYS using platform admin credentials
    // Fix for 500 error: Ensure we always use platform admin credentials for role operations
    // regardless of the organization's client credentials status
    const payload = {
      orgId: updateUserDto.orgId,
      roleIds: updateUserDto.orgRoleId,
      userId,
      user: null, // No user object needed since we're using platform admin
      usePlatformAdmin: true // CRITICAL: Always use platform admin credentials for role operations
    };

    console.log('🚀 === API GATEWAY: SENDING NATS MESSAGE ===');
    console.log('📦 Message pattern: "update-user-roles"');
    console.log('📋 Payload:', JSON.stringify(payload, null, 2));

    const pattern = { cmd: 'update-user-roles' };
    return firstValueFrom(this.natsClient.send(pattern, payload));
  }

  async getOrgUsers(
    orgId: string,
    paginationDto: PaginationDto
  ): Promise<IOrgUsers> {
    const { pageNumber, pageSize, search } = paginationDto;
    const payload = { orgId, pageNumber, pageSize, search };

    return firstValueFrom(
      this.natsClient.send({ cmd: 'fetch-organization-user' }, payload)
    );
  }

  async getDidList(orgId: string): Promise<IDidList[]> {
    const payload = { orgId };
    return firstValueFrom(
      this.natsClient.send({ cmd: 'fetch-organization-dids' }, payload)
    );
  }

  async getOrgPofile(orgId: string): Promise<organisation> {
    const payload = { orgId };

    return firstValueFrom(
      this.natsClient.send({ cmd: 'fetch-organization-profile' }, payload)
    );
  }

  async deleteOrganization(
    orgId: string,
    user: user
  ): Promise<IDeleteOrganization> {
    const payload = { orgId, user };

    return firstValueFrom(
      this.natsClient.send({ cmd: 'delete-organization' }, payload)
    );
  }

  async deleteOrgClientCredentials(orgId: string, user: user): Promise<string> {
    const payload = { orgId, user };

    return firstValueFrom(
      this.natsClient.send({ cmd: 'delete-org-client-credentials' }, payload)
    );
  }

  async deleteOrganizationInvitation(
    orgId: string,
    invitationId: string
  ): Promise<boolean> {
    const payload = { orgId, invitationId };
    return firstValueFrom(
      this.natsClient.send({ cmd: 'delete-organization-invitation' }, payload)
    );
  }

  async clientLoginCredentials(
    clientCredentialsDto: ClientCredentialsDto
  ): Promise<IAccessTokenData> {
    return firstValueFrom(
      this.natsClient.send(
        { cmd: 'authenticate-client-credentials' },
        clientCredentialsDto
      )
    );
  }

  getBase64Image(base64Image: string): Buffer {
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');
    return imageBuffer;
  }
}
