export interface MobileInvitationData {
  type: string;
  id: string;
  url?: string;
  label?: string;
  imageUrl?: string;
  accept?: string[];
  services?: any[];
  handshake_protocols?: string[];
  request_attach?: any[];
}

export interface MobileConnectionDto {
  connectionId: string;
  state: string;
  orgId?: string;
  theirDid?: string;
  theirLabel?: string;
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface MobileCredentialDto {
  credentialId: string;
  state: string;
  credentialType?: string;
  attributes?: Record<string, any>;
  issuerDid?: string;
  holderDid?: string;
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface MobileCallbackParams {
  connectionId?: string;
  state?: string;
  credentialId?: string;
  error?: string;
  [key: string]: string | undefined;
}
