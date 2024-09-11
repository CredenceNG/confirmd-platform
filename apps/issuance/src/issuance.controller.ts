import { Controller, Logger } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { IIssuance, IIssuanceWebhookInterface, IIssueCredentials, IIssueCredentialsDefinitions, OutOfBandCredentialOffer } from '../interfaces/issuance.interfaces';
import { IssuanceService } from './issuance.service';

@Controller()
export class IssuanceController {
  private readonly logger = new Logger('issuanceService');
  constructor(private readonly issuanceService: IssuanceService) { }

  @MessagePattern({ cmd: 'send-credential-create-offer' })
  async sendCredentialCreateOffer(payload: IIssuance): Promise<string> {
   
    const { orgId, user, credentialDefinitionId, comment, connectionId, attributes } = payload;
    return this.issuanceService.sendCredentialCreateOffer(orgId, user, credentialDefinitionId, comment, connectionId, attributes);
  }

  @MessagePattern({ cmd: 'send-credential-create-offer-oob' })
  async sendCredentialOutOfBand(payload: IIssuance): Promise<string> {
    const { orgId, user, credentialDefinitionId, comment, connectionId, attributes } = payload;
   
    return this.issuanceService.sendCredentialOutOfBand(orgId, user, credentialDefinitionId, comment, connectionId, attributes);
  }

  @MessagePattern({ cmd: 'get-all-issued-credentials' })
  async getIssueCredentials(payload: IIssueCredentials): Promise<object> {
    const { user, orgId, issuedCredentialsSearchCriteria} = payload;
    return this.issuanceService.getIssueCredentials(user, orgId, issuedCredentialsSearchCriteria);
  }

  @MessagePattern({ cmd: 'get-issued-credentials-by-credentialDefinitionId' })
  async getIssueCredentialsbyCredentialRecordId(payload: IIssueCredentialsDefinitions): Promise<string> {
    const { user, credentialRecordId, orgId } = payload;
    return this.issuanceService.getIssueCredentialsbyCredentialRecordId(user, credentialRecordId, orgId);
  }
  @MessagePattern({ cmd: 'webhook-get-issue-credential' })
  async getIssueCredentialWebhook(payload: IssueCredentialWebhookPayload): Promise<object> { 
    return this.issuanceService.getIssueCredentialWebhook(payload);
  }

  @MessagePattern({ cmd: 'out-of-band-credential-offer' })
  async outOfBandCredentialOffer(payload: OutOfBandCredentialOffer): Promise<boolean | object[]> {
    const { outOfBandCredentialDto } = payload;
    return this.issuanceService.outOfBandCredentialOffer(outOfBandCredentialDto);
  }

}
