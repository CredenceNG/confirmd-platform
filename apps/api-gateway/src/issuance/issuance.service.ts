/* eslint-disable camelcase */
import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { BaseService } from 'libs/service/base.service';
import { IUserRequest } from '@credebl/user-request/user-request.interface';
import { IssuanceDto, IssueCredentialDto, OutOfBandCredentialDto, PreviewFileDetails } from './dtos/issuance.dto';
import { FileExportResponse, RequestPayload } from './interfaces';

@Injectable()
export class IssuanceService extends BaseService {


    constructor(
        @Inject('NATS_CLIENT') private readonly issuanceProxy: ClientProxy
    ) {
        super('IssuanceService');
    }

    sendCredentialCreateOffer(issueCredentialDto: IssueCredentialDto, user: IUserRequest): Promise<{
        response: object;
    }> {
       
        const payload = { attributes: issueCredentialDto.attributes, comment: issueCredentialDto.comment, credentialDefinitionId: issueCredentialDto.credentialDefinitionId, connectionId: issueCredentialDto.connectionId, orgId: issueCredentialDto.orgId, protocolVersion: issueCredentialDto.protocolVersion, user };
    
        return this.sendNats(this.issuanceProxy, 'send-credential-create-offer', payload);
    }

    sendCredentialOutOfBand(issueCredentialDto: IssueCredentialDto, user: IUserRequest): Promise<{
        response: object;
    }> {
        const payload = { attributes: issueCredentialDto.attributes, comment: issueCredentialDto.comment, credentialDefinitionId: issueCredentialDto.credentialDefinitionId, connectionId: issueCredentialDto.connectionId, orgId: issueCredentialDto.orgId, user };
        return this.sendNats(this.issuanceProxy, 'send-credential-create-offer-oob', payload);
    }


    getIssueCredentials(user: IUserRequest, threadId: string, connectionId: string, state: string, orgId: string): Promise<{
        response: object;
    }> {
        const payload = { user, threadId, connectionId, state, orgId };
        return this.sendNats(this.issuanceProxy, 'get-all-issued-credentials', payload);
    }

    getIssueCredentialsbyCredentialRecordId(user: IUserRequest, credentialRecordId: string, orgId: string): Promise<{
        response: object;
    }> {
        const payload = { user, credentialRecordId, orgId };
        return this.sendNats(this.issuanceProxy, 'get-issued-credentials-by-credentialDefinitionId', payload);
    }

    getIssueCredentialWebhook(issueCredentialDto: IssuanceDto, id: string): Promise<{
        response: object;
    }> {
        const payload = { createDateTime: issueCredentialDto.createdAt, connectionId: issueCredentialDto.connectionId, threadId: issueCredentialDto.threadId, protocolVersion: issueCredentialDto.protocolVersion, credentialAttributes: issueCredentialDto.credentialAttributes, orgId: id };
        return this.sendNats(this.issuanceProxy, 'webhook-get-issue-credential', payload);
    }

    outOfBandCredentialOffer(user: IUserRequest, outOfBandCredentialDto: OutOfBandCredentialDto): Promise<{
        response: object;
    }> {
        const payload = { user, outOfBandCredentialDto };
        return this.sendNats(this.issuanceProxy, 'out-of-band-credential-offer', payload);
    }

    async exportSchemaToCSV(credentialDefinitionId: string
    ): Promise<FileExportResponse> {
        const payload = { credentialDefinitionId };
        return (await this.sendNats(this.issuanceProxy, 'export-schema-to-csv-by-credDefId', payload)).response;
    }

    async importCsv(importFileDetails: RequestPayload
    ): Promise<{ response: object }> {
        const payload = { importFileDetails };
        return this.sendNats(this.issuanceProxy, 'import-and-preview-data-for-issuance', payload);
    }

    async previewCSVDetails(requestId: string,
        orgId: string,
        previewFileDetails: PreviewFileDetails
    ): Promise<string> {
        const payload = {
            requestId,
            orgId,
            previewFileDetails
        };
        return this.sendNats(this.issuanceProxy, 'preview-csv-details', payload);
    }

    async issueBulkCredential(requestId: string, orgId: string): Promise<{ response: object }> {
        const payload = { requestId, orgId };
        return this.sendNats(this.issuanceProxy, 'issue-bulk-credentials', payload);
    }
}
