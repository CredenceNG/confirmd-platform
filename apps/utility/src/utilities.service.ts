import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { UtilitiesRepository } from './utilities.repository';
import { AwsService } from '@credebl/aws';
import { S3 } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UtilitiesService {
  constructor(
    private readonly logger: Logger,
    private readonly utilitiesRepository: UtilitiesRepository,
    private readonly awsService: AwsService
  ) {}

  async createAndStoreShorteningUrl(payload): Promise<string> {
    try {
      const { credentialId, schemaId, credDefId, invitationUrl, attributes } =
        payload;
      const invitationPayload = {
        referenceId: credentialId,
        invitationPayload: {
          schemaId,
          credDefId,
          invitationUrl,
          attributes
        }
      };
      await this.utilitiesRepository.saveShorteningUrl(invitationPayload);
      return `${process.env.API_GATEWAY_PROTOCOL}://${process.env.API_ENDPOINT}/invitation/qr-code/${credentialId}`;
    } catch (error) {
      this.logger.error(
        `[createAndStoreShorteningUrl] - error in create shortening url: ${JSON.stringify(
          error
        )}`
      );
      throw new RpcException(error);
    }
  }

  async getShorteningUrl(referenceId: string): Promise<object> {
    try {
      const getShorteningUrl = await this.utilitiesRepository.getShorteningUrl(
        referenceId
      );

      let { invitationPayload } = getShorteningUrl;

      // If invitationPayload contains a Minio URL, fetch the actual invitation
      if (
        invitationPayload &&
        'object' === typeof invitationPayload &&
        !Array.isArray(invitationPayload)
      ) {
        const payload = invitationPayload as {
          invitationUrl?: string;
          [key: string]: unknown;
        };

        // Check if it's a Minio URL and fetch the actual content
        if (
          payload.invitationUrl &&
          'string' === typeof payload.invitationUrl &&
          payload.invitationUrl.includes('minio.confamd.com')
        ) {
          try {
            const actualInvitation = await this.fetchUrlContent(
              payload.invitationUrl
            );
            // Remove quotes if present and update the invitation URL
            const cleanedUrl = actualInvitation.replace(/^"(.*)"$/, '$1');
            invitationPayload = {
              ...payload,
              invitationUrl: cleanedUrl
            };
          } catch (fetchError) {
            this.logger.error(
              `[getShorteningUrl] - error fetching invitation from Minio: ${fetchError}`
            );
            // Keep original if fetch fails
          }
        }
      }

      const getInvitationUrl = {
        referenceId: getShorteningUrl.referenceId,
        invitationPayload
      };

      return getInvitationUrl;
    } catch (error) {
      this.logger.error(
        `[getShorteningUrl] - error in get shortening url: ${JSON.stringify(
          error
        )}`
      );
      throw new RpcException(error);
    }
  }

  /**
   * Fetch content from a URL using a Promise-based approach
   */
  private async fetchUrlContent(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https')
        ? require('https')
        : require('http');

      protocol
        .get(url, (res: any) => {
          let data = '';
          res.on('data', (chunk: any) => {
            data += chunk;
          });
          res.on('end', () => {
            if (200 === res.statusCode) {
              resolve(data);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
            }
          });
        })
        .on('error', (err: any) => {
          reject(err);
        });
    });
  }

  async storeObject(payload: {
    persistent: boolean;
    storeObj: unknown;
  }): Promise<string> {
    try {
      const uuid = uuidv4();
      const uploadResult: S3.ManagedUpload.SendData =
        await this.awsService.storeObject(
          payload.persistent,
          uuid,
          payload.storeObj
        );
      const url: string = `${process.env.SHORTENED_URL_DOMAIN}/${uploadResult.Key}`;
      return url;
    } catch (error) {
      this.logger.error(error);
      throw new Error(
        'An error occurred while uploading data to S3. Error::::::'
      );
    }
  }
}
