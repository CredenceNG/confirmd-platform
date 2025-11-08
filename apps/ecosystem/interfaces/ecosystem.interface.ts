import { EcosystemRole, InvitationStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface IEcosystem {
  id: string;
  name: string;
  logo?: string;
  description?: string;
  createdBy: string;
  lastChangedBy: string;
  createDateTime: Date;
  lastChangedDateTime: Date;
  deletedAt?: Date;
}

export interface ICreateEcosystem {
  name: string;
  logo?: string;
  description?: string;
  userId: string;
}

export interface IUpdateEcosystem {
  name?: string;
  logo?: string;
  description?: string;
  userId: string;
  ecosystemId: string;
}

export interface IEcosystemOrg {
  id: string;
  ecosystemId: string;
  orgId: string;
  ecosystemRole: EcosystemRole[];
  createDateTime: Date;
  createdBy: string;
  deletedAt?: Date;
}

export interface IAddOrgToEcosystem {
  ecosystemId: string;
  orgId: string;
  ecosystemRole: EcosystemRole[];
  userId: string;
}

export interface IRemoveOrgFromEcosystem {
  ecosystemId: string;
  orgId: string;
  userId: string;
}

export interface IEcosystemSchema {
  id: string;
  ecosystemId: string;
  schemaLedgerId: string;

  // Pricing
  issuancePrice: Decimal;
  verificationPrice: Decimal;
  revocationPrice: Decimal;
  currency: string;

  // Issuance Revenue Sharing
  issuancePlatformShare: Decimal;
  issuanceEcosystemShare: Decimal;
  issuanceIssuerShare: Decimal;

  // Verification Revenue Sharing
  verificationPlatformShare: Decimal;
  verificationEcosystemShare: Decimal;
  verificationVerifierShare: Decimal;

  // Revocation Revenue Sharing
  revocationPlatformShare: Decimal;
  revocationEcosystemShare: Decimal;
  revocationIssuerShare: Decimal;

  createDateTime: Date;
  createdBy: string;
  lastChangedDateTime: Date;
  lastChangedBy: string;
  deletedAt?: Date;
}

export interface IAddSchemaToEcosystem {
  ecosystemId: string;
  schemaLedgerId: string;

  // Pricing
  issuancePrice: number;
  verificationPrice: number;
  revocationPrice: number;
  currency: string;

  // Issuance Revenue Sharing
  issuancePlatformShare: number;
  issuanceEcosystemShare: number;
  issuanceIssuerShare: number;

  // Verification Revenue Sharing
  verificationPlatformShare: number;
  verificationEcosystemShare: number;
  verificationVerifierShare: number;

  // Revocation Revenue Sharing
  revocationPlatformShare: number;
  revocationEcosystemShare: number;
  revocationIssuerShare: number;

  userId: string;
}

export interface IUpdateSchemaPricing {
  ecosystemId: string;
  schemaId: string;

  // Pricing
  issuancePrice?: number;
  verificationPrice?: number;
  revocationPrice?: number;
  currency?: string;

  // Issuance Revenue Sharing
  issuancePlatformShare?: number;
  issuanceEcosystemShare?: number;
  issuanceIssuerShare?: number;

  // Verification Revenue Sharing
  verificationPlatformShare?: number;
  verificationEcosystemShare?: number;
  verificationVerifierShare?: number;

  // Revocation Revenue Sharing
  revocationPlatformShare?: number;
  revocationEcosystemShare?: number;
  revocationIssuerShare?: number;

  userId: string;
}

export interface IEcosystemTransaction {
  id: string;
  ecosystemId: string;
  orgId: string;
  schemaLedgerId: string;
  transactionType: string;
  amount: number;
  issuerShare?: number;
  platformShare?: number;
  credentialId?: string;
  createDateTime: Date;
}

export interface ICreateTransaction {
  ecosystemId: string;
  orgId: string;
  schemaLedgerId: string;
  transactionType: string;
  amount: number;
  issuerShare?: number;
  platformShare?: number;
  credentialId?: string;
}

export interface IEcosystemInvitation {
  id: string;
  ecosystemId: string;
  email: string;
  orgId?: string;
  ecosystemRole: EcosystemRole[];
  status: InvitationStatus;
  createDateTime: Date;
  createdBy: string;
  deletedAt?: Date;
}

export interface ICreateEcosystemInvitation {
  ecosystemId: string;
  email: string;
  orgId?: string;
  ecosystemRole: EcosystemRole[];
  userId: string;
}

export interface IGetEcosystems {
  totalCount: number;
  totalPages: number;
  ecosystems: IEcosystem[];
}

export interface IGetEcosystemOrgs {
  totalCount: number;
  organizations: IEcosystemOrg[];
}

export interface IGetEcosystemSchemas {
  totalCount: number;
  schemas: IEcosystemSchema[];
}

export interface IGetEcosystemInvitations {
  totalCount: number;
  invitations: IEcosystemInvitation[];
}

export interface IEcosystemPagination {
  pageNumber: number;
  pageSize: number;
  search: string;
}
