import { ApiExtraModels } from '@nestjs/swagger';

@ApiExtraModels()
export class CreateOrganizationDto {
  // Basic organization fields
  name?: string;
  description?: string;
  logo?: string;
  logoUrl?: string;
  website?: string;
  publicProfile?: boolean;

  // DID fields
  ownDid?: string;
  did?: string;
  verkey?: string;

  // Location fields (backward compatibility)
  countryCode?: string;
  stateCode?: string;
  cityCode?: string;

  // Enhanced registration fields
  legalName?: string;
  publicName?: string;
  companyRegistrationNumber?: string;
  regulatorId?: string;
  regulatoryRegistrationNumber?: string;
  status?: string;

  // Location codes (matching database schema)
  address?: string;

  // Official contact information
  officialContactFirstName?: string;
  officialContactLastName?: string;
  officialContactPhoneNumber?: string;

  // Organization slug
  orgSlug?: string;

  // Keycloak integration fields
  idpId?: string;
  clientId?: string;
  clientSecret?: string;

  // Audit fields
  createdBy?: string;
  updatedBy?: string;
  lastChangedBy?: string;

  // Notification
  notificationWebhook?: string;
}

export class CreateUserRoleOrgDto {
  orgRoleId: string;
  userId: string;
  organisationId: string;
}
