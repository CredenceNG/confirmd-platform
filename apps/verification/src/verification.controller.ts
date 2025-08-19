import {
  IProofPresentation,
  IProofPresentationData,
  IProofRequestData,
  IProofRequests,
  ISendProofRequestPayload
} from './interfaces/verification.interface';
import {
  IProofPresentationDetails,
  IProofPresentationList,
  IVerificationRecords
} from '@credebl/common/interfaces/verification.interface';
import { presentations, user } from '@prisma/client';

import { Controller, Logger } from '@nestjs/common';
import { IUserRequest } from '@credebl/user-request/user-request.interface';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { VerificationService } from './verification.service';

@Controller()
export class VerificationController {
  private readonly logger = new Logger(VerificationController.name);

  constructor(private readonly verificationService: VerificationService) {}

  /**
   * Get all proof presentations
   * @param payload
   * @returns Get all proof presentation
   */
  @MessagePattern({ cmd: 'get-all-proof-presentations' })
  async getProofPresentations(
    payload: IProofRequests
  ): Promise<IProofPresentationList> {
    const { user, orgId, proofRequestsSearchCriteria } = payload;
    return this.verificationService.getProofPresentations(
      user,
      orgId,
      proofRequestsSearchCriteria
    );
  }

  @MessagePattern({ cmd: 'get-verification-records' })
  async getVerificationRecordsByOrgId(payload: {
    orgId: string;
    userId: string;
  }): Promise<number> {
    const { orgId } = payload;
    return this.verificationService.getVerificationRecords(orgId);
  }

  /**
   * Get proof presentation by proofId
   * @param orgId
   * @param proofId
   * @returns Proof presentation details by proofId
   */
  @MessagePattern({ cmd: 'get-proof-presentations-by-proofId' })
  async getProofPresentationById(payload: {
    proofId: string;
    orgId: string;
    user: IUserRequest;
  }): Promise<string> {
    return this.verificationService.getProofPresentationById(
      payload.proofId,
      payload.orgId
    );
  }

  /**
   * Get verified proof presentation by issuerId
   * @param issuerId
   * @returns Proof presentation details by issuerId
   */
  @MessagePattern({ cmd: 'get-proof-presentation-details-by-issuerId' })
  async getProofPresentationByIssuerId(payload: {
    issuerId: string;
    user: IUserRequest;
  }): Promise<number> {
    return this.verificationService.getProofPresentationByIssuerId(
      payload.issuerId
    );
  }

  /**
   * Send proof request
   * @param orgId
   * @returns Requested proof presentation details
   */
  @MessagePattern({ cmd: 'send-proof-request' })
  async sendProofRequest(payload: {
    requestProofDto: IProofRequestData;
    user: IUserRequest;
  }): Promise<string | string[]> {
    return this.verificationService.sendProofRequest(payload.requestProofDto);
  }

  /**
   * Verify proof presentation
   * @param proofId
   * @param orgId
   * @returns Verified proof presentation details
   */
  @MessagePattern({ cmd: 'verify-presentation' })
  async verifyPresentation(payload: {
    proofId: string;
    orgId: string;
    user: IUserRequest;
  }): Promise<string> {
    return this.verificationService.verifyPresentation(
      payload.proofId,
      payload.orgId
    );
  }

  /**
   * @param orgId
   * @returns proof presentation details
   */
  @MessagePattern({ cmd: 'webhook-proof-presentation' })
  async webhookProofPresentation(
    payload: IProofPresentation
  ): Promise<presentations> {
    return this.verificationService.webhookProofPresentation(payload);
  }

  @MessagePattern({ cmd: 'webhook-proof-received' })
  async processProofWebhook(@Payload() webhookData: any): Promise<presentations> {
    this.logger.log('🔍 Processing proof webhook event');
    this.logger.log(`📦 Raw webhook data: ${JSON.stringify(webhookData, null, 2)}`);
    
    // Transform raw webhook data to IProofPresentation format
    const proofPresentationPayload: IProofPresentation = {
      proofPresentationPayload: webhookData,
      orgId: webhookData.orgId || 'unknown' // Extract orgId if available
    };
    
    return this.verificationService.webhookProofPresentation(proofPresentationPayload);
  }

  @MessagePattern({ cmd: 'send-out-of-band-proof-request' })
  async sendOutOfBandPresentationRequest(payload: {
    outOfBandRequestProof: ISendProofRequestPayload;
    user: IUserRequest;
  }): Promise<boolean | object> {
    return this.verificationService.sendOutOfBandPresentationRequest(
      payload.outOfBandRequestProof,
      payload.user
    );
  }

  @MessagePattern({ cmd: 'get-verified-proof-details' })
  async getVerifiedProofdetails(
    payload: IProofPresentationData
  ): Promise<IProofPresentationDetails[]> {
    const { proofId, orgId } = payload;
    return this.verificationService.getVerifiedProofdetails(proofId, orgId);
  }

  @MessagePattern({ cmd: 'delete-verification-records' })
  async deleteVerificationRecord(payload: {
    orgId: string;
    userDetails: user;
  }): Promise<IVerificationRecords> {
    const { orgId, userDetails } = payload;
    return this.verificationService.deleteVerificationRecords(
      orgId,
      userDetails
    );
  }
}
