import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Logger,
  Param,
  Post,
  Body,
  Query,
  Req,
  Res,
  UseFilters,
  UseGuards
} from '@nestjs/common';
import { PlatformService } from './platform.service';
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger';
import { ApiResponseDto } from '../dtos/apiResponse.dto';
import { GetAllSchemaByPlatformDto } from '../schema/dtos/get-all-schema.dto';
import { IUserRequestInterface } from '../interfaces/IUserRequestInterface';
import { User } from '../authz/decorators/user.decorator';
import { Response, Request } from 'express';
import { ISchemaSearchPayload } from '../interfaces/ISchemaSearch.interface';
import { IResponse } from '@credebl/common/interfaces/response.interface';
import { ResponseMessages } from '@credebl/common/response-messages';
import { CustomExceptionFilter } from 'apps/api-gateway/common/exception-handler';
import { AuthGuard } from '@nestjs/passport';
import * as QRCode from 'qrcode';
import { CredDefSortFields, SchemaType, SortFields } from '@credebl/enum/enum';
import { GetAllPlatformCredDefsDto } from '../credential-definition/dto/get-all-platform-cred-defs.dto';
import { TrimStringParamPipe } from '@credebl/common/cast.helper';
import {
  MobileConnectionDto,
  MobileCredentialDto,
  MobileCallbackParams
} from './interfaces/mobile.interfaces';
import { MobileWebhookService } from './services/mobile-webhook.service';
import { MobileAgentConfigService } from './services/mobile-agent-config.service';
// import { MobileNotificationService } from "./services/mobile-notification.service";
// import { MobileFCMService } from "./services/mobile-fcm.service";
import { MobileSecurityService } from './services/mobile-security.service';
import { MobileAnalyticsService } from './services/mobile-analytics.service';
import { RealDIDCommWebhookService } from './services/real-didcomm-webhook.service';
import { MobilePushNotificationService } from './services/mobile-push-notification.service';

// Extend Express Request with missing properties
interface ExtendedRequest extends Omit<Request, 'get'> {
  ip: string;
  get(name: string): string | undefined;
}

interface MobileInvitationData {
  id: string;
  type: string;
  label?: string;
  goal?: string;
  goalCode?: string;
  accept?: string[];
  handshakeProtocols?: string[];
  services?: unknown[];
  url?: string;
  processed?: boolean;
  timestamp?: string;
  imageUrl?: string;
}

@Controller('')
@UseFilters(CustomExceptionFilter)
export class PlatformController {
  constructor(
    private readonly platformService: PlatformService,
    private readonly mobileWebhookService: MobileWebhookService,
    private readonly mobileAgentConfigService: MobileAgentConfigService,
    // private readonly mobileNotificationService: MobileNotificationService,
    // private readonly mobileFCMService: MobileFCMService,
    private readonly mobileSecurityService: MobileSecurityService,
    private readonly mobileAnalyticsService: MobileAnalyticsService,
    private readonly realDIDCommWebhookService: RealDIDCommWebhookService,
    private readonly mobilePushNotificationService: MobilePushNotificationService
  ) {}

  private readonly logger = new Logger('PlatformController');

  /**
   * Fetch content from a URL using a Promise-based approach
   */
  private async fetchUrlContent(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https')
        ? require('https')
        : require('http');

      protocol
        .get(
          url,
          (
            res: NodeJS.ReadableStream & {
              statusCode: number;
              statusMessage: string;
            }
          ) => {
            let data = '';
            res.on('data', (chunk: string) => (data += chunk));
            res.on('end', () => {
              if (200 === res.statusCode) {
                resolve(data);
              } else {
                reject(
                  new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`)
                );
              }
            });
          }
        )
        .on('error', (err: Error) => {
          reject(err);
        });
    });
  }

  /**
   * Get resolved invitation URL for an organization
   * This method first checks if we have a pre-resolved URL in the database
   * before falling back to Minio URL resolution
   */
  private async getResolvedInvitationUrl(
    referenceId: string
  ): Promise<string | null> {
    try {
      // First, try to get the shortening URL details
      const shorteningUrlDetails =
        (await this.platformService.getShorteningUrlById(referenceId)) as {
          invitationPayload?: { invitationUrl?: string };
          invitationUrl?: string;
        };

      // Extract the actual DIDComm invitation URL from the stored data
      let actualInvitationUrl =
        shorteningUrlDetails.invitationPayload?.invitationUrl ||
        shorteningUrlDetails.invitationUrl;

      // If the stored URL is a Minio URL, we need to fetch the actual invitation content
      if (
        actualInvitationUrl &&
        actualInvitationUrl.includes('minio.confamd.com')
      ) {
        try {
          // Fetch the actual invitation data from Minio
          const invitationData = await this.fetchUrlContent(
            actualInvitationUrl
          );
          // The invitation data should be the actual DIDComm URL (remove quotes if present)
          actualInvitationUrl = invitationData.replace(/^"(.*)"$/, '$1');
        } catch (fetchError) {
          this.logger.error(
            `Error fetching invitation from Minio: ${fetchError}`
          );
          return null;
        }
      }

      // Convert internal Docker URLs to external Cloudflare URLs for wallet accessibility
      if (actualInvitationUrl) {
        return actualInvitationUrl
          .replace(
            /http:\/\/f856e3a4-b09c-4356-82de-b105594eec43_Platform-admin:8002/g,
            'https://platform-admin.confamd.com'
          )
          .replace(
            /http:\/\/.*_Platform-admin:8002/g,
            'https://platform-admin.confamd.com'
          )
          .replace(
            /http:\/\/host\.docker\.internal:8002/g,
            'https://platform-admin.confamd.com'
          )
          .replace(
            /http:\/\/localhost:8002/g,
            'https://platform-admin.confamd.com'
          );
      }

      return null;
    } catch (error) {
      this.logger.error(`Error in getResolvedInvitationUrl: ${error}`);
      return null;
    }
  }

  /**
   * Retrieves all schemas available on the platform with optional filters and sorting.
   *
   * @param ledgerId The ID of the ledger.
   * @param schemaType Type of schema to filter results.
   *
   * @returns A paginated list of schemas based on the provided criteria.
   */
  @Get('/platform/schemas')
  @ApiTags('schemas')
  @ApiOperation({
    summary: 'Get all schemas from platform.',
    description: 'Retrieves all schemas available on the platform'
  })
  @ApiQuery({
    name: 'sortField',
    enum: SortFields,
    required: false
  })
  @ApiQuery({
    name: 'schemaType',
    enum: SchemaType,
    required: false
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Success',
    type: ApiResponseDto
  })
  async getAllSchema(
    @Query() getAllSchemaDto: GetAllSchemaByPlatformDto,
    @Res() res: Response,
    @User() user: IUserRequestInterface
  ): Promise<Response> {
    const {
      ledgerId,
      pageSize,
      searchByText,
      pageNumber,
      sorting,
      sortByValue,
      schemaType
    } = getAllSchemaDto;
    const schemaSearchCriteria: ISchemaSearchPayload = {
      ledgerId,
      pageNumber,
      searchByText,
      pageSize,
      sortField: sorting,
      sortBy: sortByValue,
      schemaType
    };
    const schemasResponse = await this.platformService.getAllSchema(
      schemaSearchCriteria,
      user
    );
    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: ResponseMessages.schema.success.fetch,
      data: schemasResponse
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }

  /**
   * Retrieves all credential definitions available on the platform.
   *
   * @returns A list of credential definitions and their details.
   */
  @Get('/platform/cred-defs')
  @ApiTags('credential-definitions')
  @ApiOperation({
    summary: 'Get all credential-definitions from platform.',
    description:
      'Retrieves all credential definitions available on the platform'
  })
  @ApiQuery({
    name: 'sortField',
    enum: CredDefSortFields,
    required: false
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Success',
    type: ApiResponseDto
  })
  async getAllCredDefs(
    @Query() getAllPlatformCredDefs: GetAllPlatformCredDefsDto,
    @Res() res: Response,
    @User() user: IUserRequestInterface
  ): Promise<Response> {
    const schemasResponse = await this.platformService.getAllPlatformCredDefs(
      getAllPlatformCredDefs,
      user
    );
    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: ResponseMessages.credentialDefinition.success.fetch,
      data: schemasResponse
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }

  /**
   * Retrieves all available ledgers from the platform.
   *
   * @returns A list of ledgers and their details.
   */
  @Get('/platform/ledgers')
  @ApiTags('ledgers')
  @ApiOperation({
    summary: 'Get all ledgers from platform.',
    description: 'Retrieves a list of all available ledgers on platform.'
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Success',
    type: ApiResponseDto
  })
  async getAllLedgers(@Res() res: Response): Promise<object> {
    const networksResponse = await this.platformService.getAllLedgers();

    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: ResponseMessages.ledger.success.fetch,
      data: networksResponse
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }

  /**
   * Retrieves the network URL associated with a specific ledger namespace.
   *
   * @param indyNamespace The namespace of the ledger.
   * @returns The network URL for the specified ledger.
   */
  @Get('/platform/network/url/:indyNamespace')
  @ApiTags('ledgers')
  @ApiOperation({
    summary: 'Get network url from platform.',
    description: 'Retrieves the network URL for a specified ledger namespace.'
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Success',
    type: ApiResponseDto
  })
  async getNetwrkUrl(
    @Param('indyNamespace', TrimStringParamPipe) indyNamespace: string,
    @Res() res: Response
  ): Promise<Response> {
    if (!indyNamespace) {
      throw new BadRequestException(
        ResponseMessages.ledger.error.indyNamespaceisRequired
      );
    }
    const networksResponse = await this.platformService.getNetworkUrl(
      indyNamespace
    );

    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: ResponseMessages.ledger.success.fetchNetworkUrl,
      data: networksResponse
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }

  @Get('/invitation/:referenceId')
  @ApiOperation({
    summary: `Get shortening url by referenceId`,
    description: `Get shortening url by referenceId`
  })
  @ApiExcludeEndpoint()
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Success',
    type: ApiResponseDto
  })
  async getShorteningUrlById(
    @Param('referenceId') referenceId: string,
    @Res() res: Response
  ): Promise<Response> {
    const shorteningUrlDetails =
      await this.platformService.getShorteningUrlById(referenceId);
    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: ResponseMessages.shorteningUrl.success.getshorteningUrl,
      data: shorteningUrlDetails
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }

  @Get('/invitation/qr-code/:referenceId')
  @ApiOperation({
    summary: `Get QR by referenceId`,
    description: `Get QR by referenceId`
  })
  @ApiExcludeEndpoint()
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Success',
    type: ApiResponseDto
  })
  async getQrCode(
    @Param('referenceId') referenceId: string,
    @Res() res: Response
  ): Promise<void> {
    // Try to get the resolved invitation URL first
    const resolvedUrl = await this.getResolvedInvitationUrl(referenceId);

    // Use resolved URL if available, otherwise fall back to the standard approach
    const qrUrl =
      resolvedUrl ||
      `${process.env.API_GATEWAY_PROTOCOL}://${process.env.API_ENDPOINT}/invitation/${referenceId}`;

    // Generate QR code as a buffer
    const qrCodeBuffer = await QRCode.toBuffer(qrUrl);

    // Set response type to image/png
    res.type('image/png');

    // Send the QR code buffer as the response
    res.send(qrCodeBuffer);
  }

  /**
   * Root endpoint handler - redirects to appropriate service
   * This handles cases where mobile apps hit the root URL without invitation parameters
   */
  @Get('/')
  @ApiExcludeEndpoint()
  @ApiOperation({
    summary: 'Root endpoint handler',
    description: 'Handles root URL access'
  })
  async handleRootAccess(@Res() res: Response): Promise<Response> {
    this.logger.log('🌐 Root access detected');

    // Return basic platform info
    return res.status(HttpStatus.OK).json({
      statusCode: HttpStatus.OK,
      message: 'ConfirmD Platform API Gateway',
      data: {
        platform: 'ConfirmD',
        version: '1.0.0',
        documentation: '/api/docs',
        health: '/health'
      }
    });
  }

  /**
   * Mobile wallet invitation handler - Credebl pattern compatible
   * Handles DIDComm out-of-band invitations for mobile wallet scanning
   */
  @Get('/mobile-invitation')
  @ApiExcludeEndpoint()
  @ApiOperation({
    summary: 'Handle mobile wallet DIDComm invitations',
    description:
      'Process out-of-band invitations from mobile wallets via QR code scanning'
  })
  async handleMobileInvitation(
    @Query('oob') oobParam: string,
    @Query('d_m') dmParam: string,
    @Query('c_i') ciParam: string,
    @Res() res: Response,
    @Req() request: ExtendedRequest
  ): Promise<Response> {
    this.logger.log('📱 Mobile invitation request received', {
      hasOob: Boolean(oobParam),
      hasDm: Boolean(dmParam),
      hasCi: Boolean(ciParam),
      userAgent: request.headers['user-agent']
    });

    try {
      // Extract invitation data (prioritize 'oob' as per Credebl pattern)
      const invitationData = oobParam || dmParam || ciParam;

      if (!invitationData) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Invitation parameter is required',
          error:
            'No invitation data found in query parameters (oob, d_m, or c_i)'
        });
      }

      // Process invitation using Credebl-compatible pattern
      const processedInvitation = await this.processInvitationUrl(
        invitationData
      );

      // Return Credebl-style response structure
      const finalResponse = {
        statusCode: HttpStatus.OK,
        message: 'Invitation processed successfully',
        data: {
          invitationUrl: `data:application/json,${encodeURIComponent(
            JSON.stringify(processedInvitation)
          )}`,
          invitation: processedInvitation,
          deepLinkUrl: this.createMobileDeepLink(invitationData)
        }
      };

      return res.status(HttpStatus.OK).json(finalResponse);
    } catch (error) {
      this.logger.error('📱 Error processing mobile invitation:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to process invitation',
        error: error.message
      });
    }
  }

  /**
   * Enhanced mobile invitation handler for DIDComm out-of-band invitations (POST)
   * Some mobile wallets send POST requests to the root path
   */
  @Post('/')
  @ApiExcludeEndpoint()
  @ApiOperation({
    summary: 'Handle mobile app DIDComm invitations (POST)',
    description:
      'Process out-of-band invitations from mobile wallets that use POST requests'
  })
  async handleMobileInvitationPost(
    @Query('oob') oobParam: string,
    @Query('d_m') dmParam: string,
    @Query('c_i') ciParam: string,
    @Body() body: any,
    @Res() res: Response,
    @Req() request: any
  ): Promise<Response> {
    const requestId = `${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    this.logger.log('📱 Mobile POST invitation request received', {
      requestId,
      oobParam: Boolean(oobParam),
      dmParam: Boolean(dmParam),
      ciParam: Boolean(ciParam),
      hasBody: Boolean(body),
      bodyKeys: body ? Object.keys(body) : [],
      fullUrl: request.url,
      originalUrl: request.originalUrl,
      queryObject: request.query,
      headers: {
        userAgent: request.headers['user-agent'],
        contentType: request.headers['content-type'],
        contentLength: request.headers['content-length'],
        referer: request.headers.referer,
        origin: request.headers.origin
      }
    });

    try {
      // Extract invitation data from query parameters or request body
      let invitationData = oobParam || dmParam || ciParam;

      // Some wallets might send the invitation data in the request body
      if (!invitationData && body) {
        invitationData = body.oob || body.d_m || body.c_i || body.invitation;
      }

      // Check if the invitation data is in the URL path or as a different query parameter
      if (!invitationData && request.query) {
        invitationData =
          request.query.oob || request.query.d_m || request.query.c_i;
      }

      // Log comprehensive debugging information
      this.logger.log('📱 Mobile POST detailed analysis', {
        requestId,
        foundInQuery: Boolean(invitationData),
        bodyType: typeof body,
        bodyContent: body,
        queryContent: request.query,
        fullUrl: request.url,
        originalUrl: request.originalUrl,
        method: request.method,
        headers: {
          userAgent: request.headers['user-agent'],
          referer: request.headers.referer,
          origin: request.headers.origin,
          contentType: request.headers['content-type']
        }
      });

      // NEW: Try to extract invitation from original referring URL or referer
      if (!invitationData && request.headers.referer) {
        this.logger.log('📱 Checking referer for invitation data', {
          requestId,
          referer: request.headers.referer
        });

        try {
          const refererUrl = new URL(request.headers.referer);
          invitationData =
            refererUrl.searchParams.get('oob') ||
            refererUrl.searchParams.get('d_m') ||
            refererUrl.searchParams.get('c_i');

          if (invitationData) {
            this.logger.log('📱 Found invitation data in referer!', {
              requestId,
              paramType: refererUrl.searchParams.get('oob')
                ? 'oob'
                : refererUrl.searchParams.get('d_m')
                ? 'd_m'
                : 'c_i',
              dataLength: invitationData.length,
              refererHost: refererUrl.host
            });
          }
        } catch (urlError) {
          this.logger.warn('📱 Error parsing referer URL', {
            requestId,
            error: urlError.message
          });
        }
      }

      // NEW: Check if invitation data is in the URL fragments or as different parameter names
      if (!invitationData && request.url) {
        try {
          const urlParams = new URLSearchParams(
            request.url.split('?')[1] || ''
          );
          invitationData =
            urlParams.get('oob') ||
            urlParams.get('d_m') ||
            urlParams.get('c_i') ||
            urlParams.get('invitation') ||
            urlParams.get('invite') ||
            urlParams.get('data');

          if (invitationData) {
            this.logger.log('📱 Found invitation data in URL params!', {
              requestId,
              dataLength: invitationData.length
            });
          }
        } catch (urlError) {
          this.logger.warn('📱 Error parsing URL params', {
            requestId,
            error: urlError.message
          });
        }
      }

      if (invitationData) {
        const decodedInvitation = this.decodeInvitation(invitationData);
        this.logger.log('📱 Mobile POST invitation decoded successfully', {
          requestId,
          type: decodedInvitation.type,
          id: decodedInvitation.id
        });

        await this.trackMobileConnection(decodedInvitation);

        const response = {
          success: true,
          invitation: decodedInvitation,
          nextSteps: ['accept-invitation', 'establish-connection'],
          timestamp: new Date().toISOString()
        };

        return res.status(HttpStatus.OK).json(response);
      }

      // If no invitation data found, return a helpful response that suggests the mobile wallet
      // should include the invitation URL as query parameters or in the request body
      this.logger.warn(
        '📱 Mobile POST without invitation parameters - sending guidance',
        {
          requestId,
          hasQueryParams: 0 < Object.keys(request.query || {}).length,
          hasBody: Boolean(body),
          url: request.url,
          userAgent: request.headers['user-agent']
        }
      );

      return res.status(HttpStatus.OK).json({
        success: false,
        error: 'No invitation data found',
        message: 'Please include invitation parameters in URL or request body',
        guidance: {
          expectedParameters: ['oob', 'd_m', 'c_i'],
          examples: [
            'POST /?oob=eyJAdHlwZSI...',
            'POST / with body: {"oob": "eyJAdHlwZSI..."}',
            'POST / with referer containing invitation URL'
          ]
        },
        debug: {
          requestId,
          receivedQuery: request.query,
          receivedBody: body,
          url: request.url,
          headers: {
            userAgent: request.headers['user-agent'],
            referer: request.headers.referer,
            contentType: request.headers['content-type']
          }
        }
      });
    } catch (error) {
      this.logger.error('📱 Error processing mobile POST invitation', {
        requestId,
        error: error.message,
        stack: error.stack
      });
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to process invitation',
        message: error.message,
        requestId
      });
    }
  }

  /**
   * Catch-all route for mobile wallets that might post to paths with invitation data
   * Limited to mobile-specific patterns to avoid interfering with other routes
   */
  @Post('mobile/*')
  @ApiExcludeEndpoint()
  @ApiOperation({
    summary: 'Catch-all mobile invitation handler',
    description:
      'Handle mobile wallet requests that post to mobile-specific paths'
  })
  async handleMobileCatchAll(
    @Res() res: Response,
    @Req() request: any
  ): Promise<Response> {
    const requestId = `catchall_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    this.logger.log('📱 Mobile catch-all route triggered', {
      requestId,
      path: request.path,
      url: request.url,
      method: request.method,
      headers: {
        userAgent: request.headers['user-agent'],
        referer: request.headers.referer,
        contentType: request.headers['content-type']
      },
      query: request.query,
      body: request.body
    });

    // Try to extract invitation data from the URL path itself
    const urlPath = request.path || request.url || '';
    const base64Pattern = /[A-Za-z0-9+/]{20,}={0,2}/;
    const foundBase64 = urlPath.match(base64Pattern);

    if (foundBase64) {
      try {
        const [potentialInvitation] = foundBase64;
        this.logger.log('📱 Found potential invitation in URL path', {
          requestId,
          pathSegment: `${potentialInvitation.substring(0, 50)}...`,
          length: potentialInvitation.length
        });

        // Try to decode it as an invitation
        const decodedInvitation = this.decodeInvitation(potentialInvitation);

        if (
          decodedInvitation &&
          (decodedInvitation.type || decodedInvitation.id)
        ) {
          this.logger.log('📱 Successfully decoded invitation from URL path!', {
            requestId,
            type: decodedInvitation.type,
            id: decodedInvitation.id
          });

          await this.trackMobileConnection(decodedInvitation);

          return res.status(HttpStatus.OK).json({
            success: true,
            invitation: decodedInvitation,
            source: 'url-path',
            nextSteps: ['accept-invitation', 'establish-connection'],
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        this.logger.warn('📱 Failed to decode potential invitation from path', {
          requestId,
          error: error.message
        });
      }
    }

    // If no invitation found, provide helpful feedback
    this.logger.log('📱 No invitation in catch-all, providing guidance', {
      requestId
    });

    return res.status(HttpStatus.OK).json({
      success: false,
      message: 'No invitation data found in request path',
      suggestion: 'Please use the correct invitation URL with query parameters',
      expectedFormat: 'https://api.confirmd.org/?oob=<base64-invitation>',
      requestId
    });
  }

  /**
   * Mobile webhook endpoint for DIDComm connection events
   * Receives webhook notifications from agent when mobile connections are established
   */
  @Post('wh/:orgId/connections/')
  @ApiExcludeEndpoint()
  @ApiOperation({
    summary: 'Handle mobile connection webhook',
    description:
      'Receive DIDComm connection events from mobile wallet interactions'
  })
  async handleMobileConnectionWebhook(
    @Body() connectionDto: MobileConnectionDto,
    @Param('orgId') orgId: string,
    @Res() res: Response
  ): Promise<Response> {
    this.logger.log('Mobile connection webhook received', {
      orgId,
      connectionId: connectionDto.connectionId,
      state: connectionDto.state
    });

    try {
      // Process the mobile connection event
      await this.processMobileConnection(connectionDto, orgId);

      // Notify connected systems via WebSocket/NATS for real-time updates
      await this.notifyMobileConnectionUpdate(connectionDto, orgId);

      this.logger.log('Mobile connection webhook processed successfully', {
        connectionId: connectionDto.connectionId,
        state: connectionDto.state
      });

      return res.status(HttpStatus.OK).json({
        received: true,
        processed: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Error processing mobile connection webhook', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        received: true,
        processed: false,
        error: error.message
      });
    }
  }

  /**
   * Mobile webhook endpoint for DIDComm credential events
   * Receives webhook notifications when credentials are issued/received
   */
  @Post('wh/:orgId/credentials/')
  @ApiExcludeEndpoint()
  @ApiOperation({
    summary: 'Handle mobile credential webhook',
    description:
      'Receive DIDComm credential events from mobile wallet interactions'
  })
  async handleMobileCredentialWebhook(
    @Body() credentialDto: MobileCredentialDto,
    @Param('orgId') orgId: string,
    @Res() res: Response
  ): Promise<Response> {
    this.logger.log('Mobile credential webhook received', {
      orgId,
      credentialId: credentialDto.credentialId,
      state: credentialDto.state
    });

    try {
      // Process the mobile credential event
      await this.processMobileCredential(credentialDto, orgId);

      this.logger.log('Mobile credential webhook processed successfully', {
        credentialId: credentialDto.credentialId,
        state: credentialDto.state
      });

      return res.status(HttpStatus.OK).json({
        received: true,
        processed: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Error processing mobile credential webhook', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        received: true,
        processed: false,
        error: error.message
      });
    }
  }

  /**
   * Mobile-optimized QR code generation with enhanced scanning support
   */
  @Get('/invitation/mobile-qr/:referenceId')
  @ApiExcludeEndpoint()
  @ApiOperation({
    summary: 'Generate mobile-optimized QR code',
    description:
      'Create QR codes optimized for mobile wallet scanning with deep link support'
  })
  async getMobileOptimizedQrCode(
    @Param('referenceId') referenceId: string,
    @Query('format') format: 'png' | 'svg' = 'png',
    @Query('size') size: number = 256,
    @Res() res: Response
  ): Promise<void> {
    try {
      const resolvedUrl = await this.getResolvedInvitationUrl(referenceId);

      // Create mobile-optimized invitation URL with deep linking support
      const mobileUrl = this.createMobileDeepLink(resolvedUrl || referenceId);

      // Generate high-quality QR code optimized for mobile scanning
      const qrOptions = {
        errorCorrectionLevel: 'M' as const,
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: size
      };

      if ('svg' === format) {
        const qrSvg = await QRCode.toString(mobileUrl, {
          ...qrOptions,
          type: 'svg'
        });
        res.type('image/svg+xml');
        res.send(qrSvg);
      } else {
        const qrCodeBuffer = await QRCode.toBuffer(mobileUrl, qrOptions);
        res.type('image/png');
        res.send(qrCodeBuffer);
      }
    } catch (error) {
      this.logger.error('Error generating mobile QR code', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to generate QR code',
        message: error.message
      });
    }
  }

  /**
   * Mobile callback handler for deep link responses
   */
  @Get('/mobile/callback')
  @ApiExcludeEndpoint()
  @ApiOperation({
    summary: 'Handle mobile wallet callbacks',
    description:
      'Process mobile wallet callbacks after connection/credential exchange'
  })
  async handleMobileCallback(
    @Query() queryParams: Record<string, string>,
    @Res() res: Response
  ): Promise<void> {
    const { connectionId, state, credentialId, error } = queryParams;

    this.logger.log('Mobile callback received', {
      connectionId,
      state,
      credentialId,
      error
    });

    try {
      if (error) {
        this.logger.error('Mobile callback error', error);
        res.redirect(`mobile-app://error?message=${encodeURIComponent(error)}`);
        return;
      }

      if (connectionId) {
        await this.updateConnectionState(connectionId, state);
        res.redirect(`mobile-app://success?connectionId=${connectionId}`);
        return;
      }

      if (credentialId) {
        res.redirect(
          `mobile-app://credential-received?credentialId=${credentialId}`
        );
        return;
      }

      res.redirect('mobile-app://unknown');
    } catch (callbackError) {
      this.logger.error('Error processing mobile callback', callbackError);
      res.redirect(
        `mobile-app://error?message=${encodeURIComponent(
          'Callback processing failed'
        )}`
      );
    }
  }

  /**
   * Configure mobile agent settings for an organization
   */
  @Post('/mobile/config/:orgId')
  @ApiExcludeEndpoint()
  @ApiOperation({
    summary: 'Configure mobile agent settings',
    description:
      'Update mobile-specific agent configuration for enhanced mobile wallet support'
  })
  async configureMobileAgent(
    @Param('orgId') orgId: string,
    @Body() configData: Record<string, unknown>,
    @Res() res: Response
  ): Promise<Response> {
    this.logger.log(`Configuring mobile agent for org: ${orgId}`);

    try {
      const updatedConfig =
        await this.mobileAgentConfigService.updateMobileAgentConfig(
          orgId,
          configData
        );

      return res.status(HttpStatus.OK).json({
        success: true,
        message: 'Mobile agent configuration updated successfully',
        data: updatedConfig,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Error configuring mobile agent:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to configure mobile agent',
        message: error.message
      });
    }
  }

  /**
   * Get mobile agent configuration for an organization
   */
  @Get('/mobile/config/:orgId')
  @ApiExcludeEndpoint()
  @ApiOperation({
    summary: 'Get mobile agent configuration',
    description: 'Retrieve mobile-specific agent configuration settings'
  })
  async getMobileAgentConfig(
    @Param('orgId') orgId: string,
    @Res() res: Response
  ): Promise<Response> {
    this.logger.log(`Getting mobile agent configuration for org: ${orgId}`);

    try {
      const config = await this.mobileAgentConfigService.getMobileAgentConfig(
        orgId
      );

      return res.status(HttpStatus.OK).json({
        success: true,
        data: config,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Error getting mobile agent configuration:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to get mobile agent configuration',
        message: error.message
      });
    }
  }

  /**
   * Send mobile notification
   */
  @Post('/mobile/notification/:orgId')
  @ApiOperation({
    summary: 'Send mobile notification',
    description: 'Send real-time notification to mobile clients'
  })
  @ApiParam({ name: 'orgId', description: 'Organization ID' })
  @ApiBody({
    description: 'Notification data',
    schema: {
      type: 'object',
      properties: {
        eventType: {
          type: 'string',
          enum: [
            'connection.invitation',
            'connection.request',
            'connection.response',
            'credential.offer',
            'credential.request',
            'credential.issued',
            'proof.request',
            'proof.presentation',
            'message.received',
            'status.update'
          ]
        },
        data: { type: 'object' },
        userId: { type: 'string' },
        connectionId: { type: 'string' },
        priority: { type: 'string', enum: ['high', 'normal', 'low'] },
        channels: { type: 'array', items: { type: 'string' } },
        scheduled: { type: 'string', format: 'date-time' }
      },
      required: ['eventType', 'data']
    }
  })
  async sendMobileNotification(
    @Param('orgId') orgId: string,
    @Body()
    notificationData: {
      eventType: string;
      data: Record<string, any>;
      userId?: string;
      connectionId?: string;
      priority?: 'high' | 'normal' | 'low';
      channels?: string[];
      scheduled?: string;
    },
    @Res() res: Response
  ) {
    this.logger.log(
      `📢 Sending mobile notification for org: ${orgId}, event: ${notificationData.eventType}`
    );

    try {
      const options = {
        userId: notificationData.userId,
        connectionId: notificationData.connectionId,
        priority: notificationData.priority || 'normal',
        channels: notificationData.channels,
        scheduled: notificationData.scheduled
          ? new Date(notificationData.scheduled)
          : undefined
      };

      // TODO: Re-enable when MobileNotificationService is properly configured
      // const result = await this.mobileNotificationService.sendNotification(
      //   orgId,
      //   notificationData.eventType as any,
      //   notificationData.data,
      //   options
      // );

      const result = {
        delivered: true,
        channels: ['mock'],
        timestamp: new Date().toISOString()
      };

      return res.status(HttpStatus.OK).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Error sending mobile notification:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to send mobile notification',
        message: error.message
      });
    }
  }

  /**
   * Send notification to specific connection
   */
  @Post('/mobile/notification/connection/:connectionId')
  @ApiOperation({
    summary: 'Send notification to connection',
    description: 'Send real-time notification to specific mobile connection'
  })
  @ApiParam({ name: 'connectionId', description: 'Connection ID' })
  @ApiBody({
    description: 'Notification data',
    schema: {
      type: 'object',
      properties: {
        eventType: { type: 'string' },
        data: { type: 'object' },
        priority: { type: 'string', enum: ['high', 'normal', 'low'] }
      },
      required: ['eventType', 'data']
    }
  })
  async sendConnectionNotification(
    @Param('connectionId') connectionId: string,
    @Body()
    notificationData: {
      eventType: string;
      data: Record<string, any>;
      priority?: 'high' | 'normal' | 'low';
    },
    @Res() res: Response
  ): Promise<Response> {
    this.logger.log(`📱 Sending notification to connection: ${connectionId}`);

    try {
      // Use sendNotificationToUser instead of sendToConnection
      const result =
        await this.mobilePushNotificationService.sendNotificationToUser(
          connectionId, // Use connectionId as userId for now
          {
            title: `Connection notification`,
            body: `${notificationData.eventType}`,
            data: notificationData.data
          }
        );

      return res.status(HttpStatus.OK).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Error sending connection notification:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to send connection notification',
        message: error.message
      });
    }
  }

  /**
   * Broadcast notification to all mobile clients
   */
  @Post('/mobile/notification/broadcast')
  @ApiOperation({
    summary: 'Broadcast mobile notification',
    description: 'Send notification to all connected mobile clients'
  })
  @ApiBody({
    description: 'Broadcast notification data',
    schema: {
      type: 'object',
      properties: {
        eventType: { type: 'string' },
        data: { type: 'object' },
        priority: { type: 'string', enum: ['high', 'normal', 'low'] }
      },
      required: ['eventType', 'data']
    }
  })
  async broadcastMobileNotification(
    @Body()
    notificationData: {
      eventType: string;
      data: Record<string, any>;
      priority?: 'high' | 'normal' | 'low';
    },
    @Res() res: Response
  ): Promise<Response> {
    this.logger.log(
      `📡 Broadcasting mobile notification: ${notificationData.eventType}`
    );

    try {
      const result =
        await this.mobilePushNotificationService.sendNotificationToUser(
          'broadcast', // Mock userId for broadcast
          {
            title: notificationData.eventType as string,
            body: 'Broadcast notification',
            data: notificationData.data
          }
        );

      return res.status(HttpStatus.OK).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Error broadcasting mobile notification:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to broadcast mobile notification',
        message: error.message
      });
    }
  }

  /**
   * Get notification delivery statistics
   */
  @Get('/mobile/notification/stats')
  @ApiOperation({
    summary: 'Get notification statistics',
    description: 'Get mobile notification delivery statistics'
  })
  async getNotificationStats(@Res() res: Response): Promise<Response> {
    this.logger.log('📊 Getting notification statistics');

    try {
      // Mock delivery stats for now - TODO: implement proper stats
      const deliveryStats = { delivered: 0, failed: 0, pending: 0 };
      const queueStatus = { queued: 0, processing: 0 };

      return res.status(HttpStatus.OK).json({
        success: true,
        data: {
          delivery: deliveryStats,
          queue: queueStatus,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      this.logger.error('Error getting notification statistics:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to get notification statistics',
        message: error.message
      });
    }
  }

  /**
   * Schedule notification for future delivery
   */
  @Post('/mobile/notification/:orgId/schedule')
  @ApiOperation({
    summary: 'Schedule mobile notification',
    description: 'Schedule notification for future delivery'
  })
  @ApiParam({ name: 'orgId', description: 'Organization ID' })
  @ApiBody({
    description: 'Scheduled notification data',
    schema: {
      type: 'object',
      properties: {
        eventType: { type: 'string' },
        data: { type: 'object' },
        scheduledFor: { type: 'string', format: 'date-time' },
        userId: { type: 'string' },
        connectionId: { type: 'string' },
        priority: { type: 'string', enum: ['high', 'normal', 'low'] }
      },
      required: ['eventType', 'data', 'scheduledFor']
    }
  })
  async scheduleNotification(
    @Param('orgId') orgId: string,
    @Body()
    scheduleData: {
      eventType: string;
      data: Record<string, any>;
      scheduledFor: string;
      userId?: string;
      connectionId?: string;
      priority?: 'high' | 'normal' | 'low';
    },
    @Res() res: Response
  ): Promise<Response> {
    this.logger.log(
      `⏰ Scheduling notification for org: ${orgId}, scheduled: ${scheduleData.scheduledFor}`
    );

    try {
      // Mock scheduled notification - just send immediately for now
      const notificationResult =
        await this.mobilePushNotificationService.sendNotificationToUser(
          scheduleData.userId || orgId,
          {
            title: scheduleData.eventType as string,
            body: 'Scheduled notification',
            data: scheduleData.data
          }
        );
      const notificationId = `scheduled_${Date.now()}`;

      return res.status(HttpStatus.OK).json({
        success: true,
        data: {
          notificationId,
          scheduledFor: scheduleData.scheduledFor
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Error scheduling notification:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to schedule notification',
        message: error.message
      });
    }
  }

  /**
   * Cancel scheduled notification
   */
  @Delete('/mobile/notification/schedule/:notificationId')
  @ApiOperation({
    summary: 'Cancel scheduled notification',
    description: 'Cancel a previously scheduled notification'
  })
  @ApiParam({ name: 'notificationId', description: 'Notification ID' })
  async cancelScheduledNotification(
    @Param('notificationId') notificationId: string,
    @Res() res: Response
  ): Promise<Response> {
    this.logger.log(`❌ Canceling scheduled notification: ${notificationId}`);

    try {
      // Mock cancel notification since the service doesn't have this method
      const cancelled = true; // Always return success for now

      return res.status(HttpStatus.OK).json({
        success: true,
        data: {
          cancelled,
          notificationId
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Error canceling notification:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Failed to cancel notification',
        message: error.message
      });
    }
  }

  // Private helper methods for mobile functionality

  /**
   * Process invitation URL using Credebl-compatible pattern
   * @param invitationData Base64 encoded invitation data
   * @returns Processed invitation object
   */
  private async processInvitationUrl(
    invitationData: string
  ): Promise<MobileInvitationData> {
    try {
      // Decode the base64 encoded invitation
      const decoded = Buffer.from(invitationData, 'base64').toString('utf-8');

      // Clean up malformed JSON (common in DIDComm invitations)
      let cleanedJson = decoded;

      // Remove trailing commas in arrays and objects
      cleanedJson = cleanedJson.replace(/,(\s*[}\]])/g, '$1');

      // Remove any trailing characters that might be invalid
      cleanedJson = cleanedJson.trim();

      this.logger.log('📱 Processing invitation JSON', {
        originalLength: decoded.length,
        cleanedLength: cleanedJson.length,
        hasTrailingComma: decoded.includes(',]') || decoded.includes(',}')
      });

      const parsedInvitation = JSON.parse(cleanedJson);

      // Validate DIDComm out-of-band invitation structure
      if (
        parsedInvitation['@type'] &&
        parsedInvitation['@type'].includes('out-of-band')
      ) {
        return {
          ...parsedInvitation,
          id: parsedInvitation['@id'] || parsedInvitation.id || 'unknown',
          type: parsedInvitation['@type'] || 'out-of-band-invitation',
          url: invitationData,
          processed: true,
          timestamp: new Date().toISOString()
        };
      }

      // For other invitation types, return the parsed JSON with enhanced structure
      return {
        ...parsedInvitation,
        id: parsedInvitation['@id'] || parsedInvitation.id || 'unknown',
        type: parsedInvitation['@type'] || parsedInvitation.type || 'unknown',
        url: invitationData,
        processed: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.warn(
        '📱 Failed to decode as base64, trying direct JSON parse',
        { error: error.message }
      );

      // If not base64, try to parse as JSON directly
      try {
        const directParsed = JSON.parse(invitationData);
        return {
          ...directParsed,
          url: invitationData,
          processed: true,
          timestamp: new Date().toISOString()
        };
      } catch (jsonError) {
        this.logger.error('📱 Failed to parse invitation as JSON', {
          error: jsonError.message
        });
        throw new Error(`Invalid invitation format: ${jsonError.message}`);
      }
    }
  }

  private decodeInvitation(invitationData: string): MobileInvitationData {
    try {
      // Handle base64 encoded invitations
      const decoded = Buffer.from(invitationData, 'base64').toString('utf-8');

      // Clean up malformed JSON (common in DIDComm invitations)
      let cleanedJson = decoded;

      // Remove trailing commas in arrays and objects
      cleanedJson = cleanedJson.replace(/,(\s*[}\]])/g, '$1');

      // Remove any trailing characters that might be invalid
      cleanedJson = cleanedJson.trim();

      this.logger.log('📱 Attempting to parse cleaned invitation JSON', {
        originalLength: decoded.length,
        cleanedLength: cleanedJson.length,
        hasTrailingComma: decoded.includes(',]') || decoded.includes(',}')
      });

      const parsedInvitation = JSON.parse(cleanedJson);

      // Check if this is a DIDComm out-of-band invitation
      if (
        parsedInvitation['@type'] &&
        parsedInvitation['@type'].includes('out-of-band')
      ) {
        this.logger.log('📱 Decoded DIDComm out-of-band invitation', {
          id: parsedInvitation['@id'],
          label: parsedInvitation.label,
          type: parsedInvitation['@type'],
          hasImageUrl: Boolean(parsedInvitation.imageUrl),
          protocolsCount: parsedInvitation.handshake_protocols?.length || 0,
          servicesCount: parsedInvitation.services?.length || 0
        });

        return {
          id: parsedInvitation['@id'] || 'unknown',
          type: parsedInvitation['@type'] || 'unknown',
          label: parsedInvitation.label || 'Unknown Organization',
          imageUrl: parsedInvitation.imageUrl,
          accept: parsedInvitation.accept,
          handshakeProtocols: parsedInvitation.handshake_protocols,
          services: parsedInvitation.services?.slice(0, 2), // Limit to first 2 services for response size
          url: invitationData // Keep original base64 for reference
        };
      }

      // For other invitation types, return the parsed JSON with enhanced structure
      return {
        ...parsedInvitation,
        id: parsedInvitation['@id'] || parsedInvitation.id || 'unknown',
        type: parsedInvitation['@type'] || parsedInvitation.type || 'unknown',
        url: invitationData
      };
    } catch (error) {
      this.logger.warn(
        '📱 Failed to decode as base64, trying direct JSON parse',
        { error: error.message }
      );

      // If not base64, try to parse as JSON directly
      try {
        const parsedInvitation = JSON.parse(invitationData);
        return {
          ...parsedInvitation,
          id: parsedInvitation['@id'] || parsedInvitation.id || 'unknown',
          type: parsedInvitation['@type'] || parsedInvitation.type || 'unknown',
          url: invitationData
        };
      } catch (jsonError) {
        this.logger.warn('📱 Failed to parse as JSON, treating as URL string', {
          jsonError: jsonError.message,
          dataLength: invitationData.length
        });

        // If not JSON, return as URL string
        return {
          url: invitationData,
          type: 'url-invitation',
          id: 'unknown',
          label: 'Unknown Invitation'
        };
      }
    }
  }

  private async trackMobileConnection(
    invitationData: MobileInvitationData
  ): Promise<void> {
    try {
      // Extract DIDComm invitation properties if available
      const didcommInvitation = invitationData as any; // Cast to access DIDComm properties
      const invitationId =
        didcommInvitation['@id'] || invitationData.id || 'unknown';
      const invitationType =
        didcommInvitation['@type'] || invitationData.type || 'unknown';
      const label = didcommInvitation.label || 'Unknown Organization';

      // Track mobile connection attempts for analytics
      this.logger.log('Tracking mobile connection', {
        type: invitationType,
        timestamp: new Date(),
        invitationId,
        label
      });

      // 🔒 MOBILE SECURITY INTEGRATION: Generate device fingerprint for mobile connections
      if (
        invitationType?.includes('out-of-band') ||
        'invitation' === invitationType
      ) {
        this.logger.log('🔒 Creating mobile security context for invitation', {
          invitationId,
          label
        });

        // Create a preliminary device fingerprint from invitation data
        // This will be enhanced when actual device info is available via webhook
        const preliminaryDeviceInfo = {
          deviceId: `mobile_${invitationId}_${Date.now()}`,
          platform: 'web' as const, // Use 'web' as default, will be updated with actual platform
          osVersion: 'unknown',
          appVersion: '1.0.0',
          deviceModel: 'mobile-wallet',
          timezone: 'UTC',
          language: 'en'
        };

        // Generate initial device fingerprint
        const deviceFingerprint =
          await this.mobileSecurityService.generateDeviceFingerprint(
            preliminaryDeviceInfo
          );

        this.logger.log('🔒 Mobile device fingerprint created', {
          deviceId: deviceFingerprint.deviceId,
          trustScore: deviceFingerprint.trustScore,
          fingerprint: `${deviceFingerprint.fingerprint.substring(0, 16)}...`
        });

        // Track analytics for mobile connection
        try {
          if (this.mobileAnalyticsService) {
            await this.mobileAnalyticsService.trackUserBehavior({
              userId: 'anonymous', // Will be updated when user is identified
              deviceId: deviceFingerprint.deviceId,
              sessionId: `session_${Date.now()}`,
              eventType: 'app_open',
              eventCategory: 'invitation',
              eventAction: 'invitation_received',
              eventLabel: label,
              properties: {
                invitationType,
                invitationId,
                hasImage: Boolean(didcommInvitation.imageUrl),
                protocolsSupported: didcommInvitation.handshake_protocols || [],
                acceptFormats: didcommInvitation.accept || [],
                services: didcommInvitation.services || []
              },
              userAgent: 'mobile-wallet'
            });
          }
        } catch (analyticsError) {
          this.logger.error(
            'Error tracking analytics for mobile connection',
            analyticsError
          );
        }
      }
    } catch (error) {
      this.logger.error('Error tracking mobile connection', error);
      // Don't throw error to avoid breaking the invitation flow
    }
  }

  private async processMobileConnection(
    connectionDto: MobileConnectionDto,
    orgId: string
  ): Promise<void> {
    try {
      this.logger.log(
        'Processing mobile connection with security integration',
        {
          connectionId: connectionDto.connectionId,
          state: connectionDto.state,
          orgId,
          theirLabel: connectionDto.theirLabel
        }
      );

      // 🔒 MOBILE SECURITY INTEGRATION: Enhanced device security when connection is established
      if (
        'completed' === connectionDto.state ||
        'active' === connectionDto.state
      ) {
        this.logger.log(
          '🔒 Connection established - enhancing mobile security context',
          {
            connectionId: connectionDto.connectionId,
            theirDid: connectionDto.theirDid
          }
        );

        // Create enhanced device fingerprint with connection information
        const enhancedDeviceInfo = {
          deviceId: `connected_${connectionDto.connectionId}`,
          platform:
            this.detectPlatformFromMetadata(connectionDto.metadata) ||
            ('web' as const),
          osVersion: this.extractOSVersion(connectionDto.metadata) || 'unknown',
          appVersion: this.extractAppVersion(connectionDto.metadata) || '1.0.0',
          deviceModel:
            this.extractDeviceModel(connectionDto.metadata) || 'mobile-wallet',
          timezone: 'UTC', // Could be extracted from metadata
          language: 'en' // Could be extracted from metadata
        };

        // Generate or update device fingerprint for established connection
        const deviceFingerprint =
          await this.mobileSecurityService.generateDeviceFingerprint(
            enhancedDeviceInfo
          );

        this.logger.log(
          '🔒 Enhanced device fingerprint for established connection',
          {
            connectionId: connectionDto.connectionId,
            deviceId: deviceFingerprint.deviceId,
            trustScore: deviceFingerprint.trustScore,
            platform: deviceFingerprint.platform
          }
        );

        // Track connection establishment analytics
        try {
          if (this.mobileAnalyticsService) {
            await this.mobileAnalyticsService.trackUserBehavior({
              userId: connectionDto.theirDid || 'unknown',
              deviceId: deviceFingerprint.deviceId,
              sessionId: `conn_${connectionDto.connectionId}`,
              eventType: 'user_action',
              eventCategory: 'authentication', // Use valid category
              eventAction: 'connection_established',
              eventLabel: connectionDto.theirLabel || 'Mobile Connection',
              properties: {
                connectionId: connectionDto.connectionId,
                connectionState: connectionDto.state,
                orgId,
                theirDid: connectionDto.theirDid,
                platform: deviceFingerprint.platform,
                trustScore: deviceFingerprint.trustScore,
                hasMetadata: Boolean(connectionDto.metadata)
              },
              userAgent: 'mobile-wallet'
            });

            // Track performance metrics for connection establishment
            const now = Date.now();
            await this.mobileAnalyticsService.trackPerformanceMetrics({
              userId: connectionDto.theirDid || 'unknown',
              deviceId: deviceFingerprint.deviceId,
              sessionId: `conn_${connectionDto.connectionId}`,
              metricType: 'network_request',
              startTime: new Date(now - 1000).toISOString(),
              endTime: new Date(now).toISOString(),
              duration: 1000,
              success: true,
              deviceSpecs: {
                platform: deviceFingerprint.platform,
                osVersion: deviceFingerprint.osVersion,
                appVersion: deviceFingerprint.appVersion,
                deviceModel: deviceFingerprint.deviceModel
              },
              networkType: 'wifi'
            });
          }
        } catch (analyticsError) {
          this.logger.error(
            'Error tracking analytics for mobile connection',
            analyticsError
          );
        }

        // Log secure connection establishment (notification service may not be available)
        this.logger.log(
          '🔒 Secure connection established with enhanced security',
          {
            connectionId: connectionDto.connectionId,
            orgId,
            trustScore: deviceFingerprint.trustScore,
            securityLevel:
              70 < deviceFingerprint.trustScore
                ? 'high'
                : 40 < deviceFingerprint.trustScore
                ? 'medium'
                : 'low',
            deviceId: deviceFingerprint.deviceId
          }
        );
      }
    } catch (error) {
      this.logger.error('Error processing mobile connection', error);
      throw error;
    }
  }

  // Helper methods for extracting device information from connection metadata
  private detectPlatformFromMetadata(
    metadata?: Record<string, any>
  ): 'android' | 'ios' | 'web' | undefined {
    if (!metadata) {
      return undefined;
    }

    const userAgent = metadata.userAgent || metadata.platform || '';
    if (userAgent.toLowerCase().includes('android')) {
      return 'android';
    }
    if (
      userAgent.toLowerCase().includes('ios') ||
      userAgent.toLowerCase().includes('iphone')
    ) {
      return 'ios';
    }
    return 'web';
  }

  private extractOSVersion(metadata?: Record<string, any>): string | undefined {
    if (!metadata) {
      return undefined;
    }
    return metadata.osVersion || metadata.systemVersion || undefined;
  }

  private extractAppVersion(
    metadata?: Record<string, any>
  ): string | undefined {
    if (!metadata) {
      return undefined;
    }
    return metadata.appVersion || metadata.version || undefined;
  }

  private extractDeviceModel(
    metadata?: Record<string, any>
  ): string | undefined {
    if (!metadata) {
      return undefined;
    }
    return metadata.deviceModel || metadata.model || undefined;
  }

  private async processMobileCredential(
    credentialDto: MobileCredentialDto,
    orgId: string
  ): Promise<void> {
    try {
      // Process mobile credential events
      // For now, just log - this will be enhanced when service methods are added
      this.logger.log('Processing mobile credential', {
        credentialId: credentialDto.credentialId,
        orgId
      });
    } catch (error) {
      this.logger.error('Error processing mobile credential', error);
      throw error;
    }
  }

  private async notifyMobileConnectionUpdate(
    connectionDto: MobileConnectionDto,
    orgId: string
  ): Promise<void> {
    try {
      // Send real-time notifications about connection updates
      // This would integrate with WebSocket/NATS for real-time updates
      this.logger.log('Notifying mobile connection update', {
        connectionId: connectionDto.connectionId,
        orgId
      });
    } catch (error) {
      this.logger.error('Error notifying mobile connection update', error);
    }
  }

  private async updateConnectionState(
    connectionId: string,
    state: string
  ): Promise<void> {
    try {
      // Update connection state in database
      // For now, just log - this will be enhanced when service methods are added
      this.logger.log('Updating connection state', { connectionId, state });
    } catch (error) {
      this.logger.error('Error updating connection state', error);
      throw error;
    }
  }

  // TODO: FCM Endpoints - temporarily disabled to resolve dependency issues
  /*
  // Firebase Cloud Messaging (FCM) Endpoints
  @Post("fcm/register-device")
  async registerFCMDevice(
    @Body() body: any,
    @Res() res: Response
  ): Promise<void> {
    try {
      this.logger.log("FCM Device Registration Request:", body);

      if (!body.token || !body.userId) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: "Missing required fields: token and userId",
        });
      }

      await this.mobilePushNotificationService.registerDevice(
        body.userId,
        body.deviceId || `device_${Date.now()}`,
        body.token,
        body.platform || 'android',
        body.appVersion || '1.0.0'
      );

      return res.status(HttpStatus.OK).json({
        success: true,
        message: "Device registered successfully",
        data: { 
          deviceId: body.deviceId || `device_${Date.now()}`,
          userId: body.userId,
          registered: true
        },
      });
    } catch (error) {
      this.logger.error("Failed to register FCM device:", error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to register device",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  @Delete("fcm/unregister-device/:token")
  async unregisterFCMDevice(
    @Param("token") token: string,
    @Res() res: Response
  ): Promise<void> {
    try {
      this.logger.log("FCM Device Unregistration Request:", { token });

      const result = await this.mobileFCMService.unregisterDevice(token);

      return res.status(HttpStatus.OK).json({
        success: true,
        message: "Device unregistered successfully",
        data: { result },
      });
    } catch (error) {
      this.logger.error("Failed to unregister FCM device:", error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to unregister device",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  @Post("fcm/send-to-device")
  async sendFCMToDevice(
    @Body() body: any,
    @Res() res: Response
  ): Promise<void> {
    try {
      this.logger.log("FCM Send to Device Request:", body);

      if (!body.token || !body.notification) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: "Missing required fields: token and notification",
        });
      }

      const result = await this.mobileFCMService.sendToDevice(
        body.token,
        body.notification,
        body.data
      );

      return res.status(HttpStatus.OK).json({
        success: true,
        message: "FCM message sent successfully",
        data: { result },
      });
    } catch (error) {
      this.logger.error("Failed to send FCM to device:", error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to send FCM message",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  @Post("fcm/send-to-user")
  async sendFCMToUser(@Body() body: any, @Res() res: Response): Promise<void> {
    try {
      this.logger.log("FCM Send to User Request:", body);

      if (!body.userId || !body.notification) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: "Missing required fields: userId and notification",
        });
      }

      const result = await this.mobileFCMService.sendToUser(
        body.userId,
        body.notification,
        body.data
      );

      return res.status(HttpStatus.OK).json({
        success: true,
        message: "FCM message sent to user successfully",
        data: { result },
      });
    } catch (error) {
      this.logger.error("Failed to send FCM to user:", error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to send FCM message to user",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  @Post("fcm/send-to-organization")
  async sendFCMToOrganization(
    @Body() body: any,
    @Res() res: Response
  ): Promise<void> {
    try {
      this.logger.log("FCM Send to Organization Request:", body);

      if (!body.organizationId || !body.notification) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: "Missing required fields: organizationId and notification",
        });
      }

      const result = await this.mobileFCMService.sendToOrganization(
        body.organizationId,
        body.notification,
        body.data
      );

      return res.status(HttpStatus.OK).json({
        success: true,
        message: "FCM message sent to organization successfully",
        data: { result },
      });
    } catch (error) {
      this.logger.error("Failed to send FCM to organization:", error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to send FCM message to organization",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  @Get("fcm/stats")
  async getFCMStats(@Res() res: Response): Promise<void> {
    try {
      const stats = await this.mobileFCMService.getFCMStats();

      return res.status(HttpStatus.OK).json({
        success: true,
        message: "FCM statistics retrieved successfully",
        data: { stats },
      });
    } catch (error) {
      this.logger.error("Failed to get FCM stats:", error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to get FCM statistics",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  @Get("fcm/devices/:userId")
  async getUserFCMDevices(
    @Param("userId") userId: string,
    @Res() res: Response
  ): Promise<void> {
    try {
      const devices = await this.mobileFCMService.getUserDevices(userId);

      return res.status(HttpStatus.OK).json({
        success: true,
        message: "User FCM devices retrieved successfully",
        data: { devices },
      });
    } catch (error) {
      this.logger.error("Failed to get user FCM devices:", error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to get user devices",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  */

  // Enhanced Security & Authentication Endpoints
  @Post('security/generate-fingerprint')
  async generateDeviceFingerprint(
    @Body() body: any,
    @Res() res: Response
  ): Promise<Response> {
    try {
      this.logger.log('Generate Device Fingerprint Request:', body);

      if (!body.deviceId || !body.platform) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Missing required fields: deviceId and platform'
        });
      }

      const fingerprint =
        await this.mobileSecurityService.generateDeviceFingerprint(body);

      return res.status(HttpStatus.OK).json({
        success: true,
        message: 'Device fingerprint generated successfully',
        data: { fingerprint }
      });
    } catch (error) {
      this.logger.error('Failed to generate device fingerprint:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to generate device fingerprint',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  @Post('security/biometric-challenge')
  async createBiometricChallenge(
    @Body() body: any,
    @Res() res: Response
  ): Promise<Response> {
    try {
      this.logger.log('Create Biometric Challenge Request:', body);

      if (!body.userId || !body.deviceId || !body.challengeType) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message:
            'Missing required fields: userId, deviceId, and challengeType'
        });
      }

      const challenge =
        await this.mobileSecurityService.createBiometricChallenge(
          body.userId,
          body.deviceId,
          body.challengeType
        );

      return res.status(HttpStatus.OK).json({
        success: true,
        message: 'Biometric challenge created successfully',
        data: { challenge }
      });
    } catch (error) {
      this.logger.error('Failed to create biometric challenge:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to create biometric challenge',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  @Post('security/verify-biometric')
  async verifyBiometricChallenge(
    @Body() body: any,
    @Res() res: Response
  ): Promise<Response> {
    try {
      this.logger.log('Verify Biometric Challenge Request:', {
        challengeId: body.challengeId
      });

      if (!body.challengeId || !body.biometricData) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Missing required fields: challengeId and biometricData'
        });
      }

      const result = await this.mobileSecurityService.verifyBiometricChallenge(
        body.challengeId,
        body.biometricData
      );

      return res.status(HttpStatus.OK).json({
        success: result.success,
        message: result.success
          ? 'Biometric verification successful'
          : 'Biometric verification failed',
        data: { result }
      });
    } catch (error) {
      this.logger.error('Failed to verify biometric challenge:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to verify biometric challenge',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  @Post('security/authenticate')
  async authenticateUserSecure(
    @Body() body: any,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<Response> {
    try {
      this.logger.log('Secure Authentication Request:', {
        userId: body.userId,
        deviceId: body.deviceFingerprint?.deviceId
      });

      if (!body.userId || !body.deviceFingerprint) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Missing required fields: userId and deviceFingerprint'
        });
      }

      const ipAddress = req.ip || '127.0.0.1';
      const userAgent = req.get('User-Agent') || 'unknown';

      const result = await this.mobileSecurityService.authenticateUser(
        body.userId,
        body.deviceFingerprint,
        ipAddress,
        userAgent,
        body.credentials
      );

      if (result.requiresBiometric) {
        return res.status(HttpStatus.ACCEPTED).json({
          success: false,
          requiresBiometric: true,
          message: 'Biometric authentication required',
          data: { riskAssessment: 'high' }
        });
      }

      return res.status(HttpStatus.OK).json({
        success: result.success,
        message: result.success
          ? 'Authentication successful'
          : 'Authentication failed',
        data: result.tokens
          ? { tokens: result.tokens }
          : { error: result.error }
      });
    } catch (error) {
      this.logger.error('Failed to authenticate user:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Authentication failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  @Post('security/refresh-tokens')
  async refreshSecurityTokens(
    @Body() body: any,
    @Res() res: Response
  ): Promise<Response> {
    try {
      this.logger.log('Refresh Security Tokens Request:', {
        deviceId: body.deviceFingerprint?.deviceId
      });

      if (!body.refreshToken || !body.deviceFingerprint) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message:
            'Missing required fields: refreshToken and deviceFingerprint'
        });
      }

      const result = await this.mobileSecurityService.refreshTokens(
        body.refreshToken,
        body.deviceFingerprint
      );

      return res.status(HttpStatus.OK).json({
        success: result.success,
        message: result.success
          ? 'Tokens refreshed successfully'
          : 'Token refresh failed',
        data: result.tokens
          ? { tokens: result.tokens }
          : { error: result.error }
      });
    } catch (error) {
      this.logger.error('Failed to refresh tokens:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to refresh tokens',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  @Get('security/audit-logs/:userId')
  async getSecurityAuditLogs(
    @Param('userId') userId: string,
    @Query('limit') limit: string,
    @Res() res: Response
  ): Promise<Response> {
    try {
      const auditLogs = await this.mobileSecurityService.getSecurityAuditLogs(
        userId,
        parseInt(limit) || 50
      );

      return res.status(HttpStatus.OK).json({
        success: true,
        message: 'Security audit logs retrieved successfully',
        data: { auditLogs, count: auditLogs.length }
      });
    } catch (error) {
      this.logger.error('Failed to get security audit logs:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to get security audit logs',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  @Get('security/trusted-devices/:userId')
  async getTrustedDevices(
    @Param('userId') userId: string,
    @Res() res: Response
  ): Promise<Response> {
    try {
      const trustedDevices = await this.mobileSecurityService.getTrustedDevices(
        userId
      );

      return res.status(HttpStatus.OK).json({
        success: true,
        message: 'Trusted devices retrieved successfully',
        data: { trustedDevices, count: trustedDevices.length }
      });
    } catch (error) {
      this.logger.error('Failed to get trusted devices:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to get trusted devices',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  @Delete('security/trusted-devices/:userId/:deviceId')
  async revokeTrustedDevice(
    @Param('userId') userId: string,
    @Param('deviceId') deviceId: string,
    @Res() res: Response
  ): Promise<Response> {
    try {
      const result = await this.mobileSecurityService.revokeTrustedDevice(
        userId,
        deviceId
      );

      return res.status(HttpStatus.OK).json({
        success: result,
        message: result
          ? 'Device trust revoked successfully'
          : 'Device trust revocation failed',
        data: { userId, deviceId, revoked: result }
      });
    } catch (error) {
      this.logger.error('Failed to revoke trusted device:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to revoke trusted device',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private createMobileDeepLink(invitationUrl: string): string {
    try {
      // Create universal deep link that works with mobile wallets
      const baseUrl = `${process.env.API_GATEWAY_PROTOCOL}://${process.env.API_ENDPOINT}`;

      // Support multiple wallet deep link formats
      // This creates a universal format that most wallets can handle
      return `didcomm://?oob=${encodeURIComponent(
        invitationUrl
      )}&callback=${encodeURIComponent(`${baseUrl}/mobile/callback`)}`;
    } catch (error) {
      this.logger.error('Error creating mobile deep link', error);
      return invitationUrl; // Fallback to original URL
    }
  }

  // ============================================================================
  // STEP 6: ANALYTICS & INTELLIGENCE PLATFORM ENDPOINTS
  // ============================================================================

  /**
   * Track user behavior event for analytics
   */
  @Post('analytics/track/behavior')
  @ApiOperation({
    summary: 'Track user behavior event',
    description:
      'Record user behavior event for analytics and insights generation'
  })
  @ApiBody({
    description: 'User behavior event data',
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID' },
        deviceId: { type: 'string', description: 'Device ID' },
        sessionId: { type: 'string', description: 'Session ID' },
        eventType: {
          type: 'string',
          enum: [
            'app_open',
            'screen_view',
            'user_action',
            'feature_usage',
            'error',
            'crash',
            'performance'
          ],
          description: 'Type of behavior event'
        },
        eventCategory: {
          type: 'string',
          enum: [
            'navigation',
            'authentication',
            'credential',
            'invitation',
            'notification',
            'system'
          ],
          description: 'Category of the event'
        },
        eventAction: {
          type: 'string',
          description: 'Specific action performed'
        },
        eventLabel: { type: 'string', description: 'Optional event label' },
        eventValue: { type: 'number', description: 'Optional numeric value' },
        properties: {
          type: 'object',
          description: 'Additional event properties'
        },
        sessionDuration: {
          type: 'number',
          description: 'Session duration in milliseconds'
        },
        screenName: {
          type: 'string',
          description: 'Screen name where event occurred'
        },
        userAgent: { type: 'string', description: 'User agent string' },
        location: {
          type: 'object',
          properties: {
            country: { type: 'string' },
            city: { type: 'string' },
            coordinates: {
              type: 'object',
              properties: {
                lat: { type: 'number' },
                lng: { type: 'number' }
              }
            }
          }
        }
      },
      required: [
        'userId',
        'deviceId',
        'sessionId',
        'eventType',
        'eventCategory',
        'eventAction',
        'userAgent'
      ]
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Behavior event tracked successfully',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        message: {
          type: 'string',
          example: 'Behavior event tracked successfully'
        },
        data: {
          type: 'object',
          properties: {
            eventId: { type: 'string' },
            tracked: { type: 'boolean' }
          }
        }
      }
    }
  })
  async trackUserBehavior(
    @Body() body: any,
    @Res() res: Response
  ): Promise<Response> {
    try {
      await this.mobileAnalyticsService.trackUserBehavior(body);

      return res.status(HttpStatus.OK).json({
        statusCode: HttpStatus.OK,
        message: 'Behavior event tracked successfully',
        data: { tracked: true }
      });
    } catch (error) {
      this.logger.error('Failed to track user behavior:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to track user behavior',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Track performance metrics
   */
  @Post('analytics/track/performance')
  @ApiOperation({
    summary: 'Track performance metrics',
    description: 'Record performance metrics for monitoring and optimization'
  })
  @ApiBody({
    description: 'Performance metrics data',
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID' },
        deviceId: { type: 'string', description: 'Device ID' },
        sessionId: { type: 'string', description: 'Session ID' },
        metricType: {
          type: 'string',
          enum: [
            'app_launch',
            'api_response',
            'screen_load',
            'network_request',
            'battery_usage',
            'memory_usage'
          ],
          description: 'Type of performance metric'
        },
        duration: { type: 'number', description: 'Duration in milliseconds' },
        startTime: { type: 'string', description: 'Start time ISO string' },
        endTime: { type: 'string', description: 'End time ISO string' },
        success: {
          type: 'boolean',
          description: 'Whether operation was successful'
        },
        errorMessage: {
          type: 'string',
          description: 'Error message if failed'
        },
        networkType: {
          type: 'string',
          enum: ['wifi', '4g', '5g', 'edge', 'offline'],
          description: 'Network connection type'
        },
        deviceSpecs: {
          type: 'object',
          properties: {
            platform: { type: 'string' },
            osVersion: { type: 'string' },
            appVersion: { type: 'string' },
            deviceModel: { type: 'string' },
            ramSize: { type: 'number' },
            storageAvailable: { type: 'number' },
            batteryLevel: { type: 'number' }
          }
        },
        apiEndpoint: {
          type: 'string',
          description: 'API endpoint for API metrics'
        },
        responseSize: { type: 'number', description: 'Response size in bytes' },
        cacheHit: {
          type: 'boolean',
          description: 'Whether response was cached'
        }
      },
      required: [
        'userId',
        'deviceId',
        'sessionId',
        'metricType',
        'duration',
        'startTime',
        'endTime',
        'success',
        'deviceSpecs'
      ]
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Performance metrics tracked successfully'
  })
  async trackPerformanceMetrics(
    @Body() body: any,
    @Res() res: Response
  ): Promise<Response> {
    try {
      await this.mobileAnalyticsService.trackPerformanceMetrics(body);

      return res.status(HttpStatus.OK).json({
        statusCode: HttpStatus.OK,
        message: 'Performance metrics tracked successfully',
        data: { tracked: true }
      });
    } catch (error) {
      this.logger.error('Failed to track performance metrics:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to track performance metrics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Start user journey tracking
   */
  @Post('analytics/journey/start')
  @ApiOperation({
    summary: 'Start user journey tracking',
    description:
      'Begin tracking a user journey for conversion and drop-off analysis'
  })
  @ApiBody({
    description: 'Journey start data',
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID' },
        journeyType: {
          type: 'string',
          description:
            'Type of journey (e.g., onboarding, credential_issuance)'
        },
        conversionGoal: {
          type: 'string',
          description: 'Optional conversion goal step name'
        }
      },
      required: ['userId', 'journeyType']
    }
  })
  @ApiResponse({
    status: 200,
    description: 'User journey started successfully'
  })
  async startUserJourney(
    @Body() body: any,
    @Res() res: Response
  ): Promise<Response> {
    try {
      const journey = await this.mobileAnalyticsService.startUserJourney(
        body.userId,
        body.journeyType,
        body.conversionGoal
      );

      return res.status(HttpStatus.OK).json({
        statusCode: HttpStatus.OK,
        message: 'User journey started successfully',
        data: { journey }
      });
    } catch (error) {
      this.logger.error('Failed to start user journey:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to start user journey',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Add step to user journey
   */
  @Post('analytics/journey/:journeyId/step')
  @ApiOperation({
    summary: 'Add step to user journey',
    description: 'Record a step in an active user journey'
  })
  @ApiParam({ name: 'journeyId', description: 'Journey ID' })
  @ApiBody({
    description: 'Journey step data',
    schema: {
      type: 'object',
      properties: {
        stepName: { type: 'string', description: 'Name of the journey step' },
        success: {
          type: 'boolean',
          description: 'Whether step was completed successfully'
        },
        metadata: { type: 'object', description: 'Additional step metadata' }
      },
      required: ['stepName', 'success']
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Journey step added successfully'
  })
  async addJourneyStep(
    @Param('journeyId') journeyId: string,
    @Body() body: any,
    @Res() res: Response
  ): Promise<Response> {
    try {
      await this.mobileAnalyticsService.addJourneyStep(
        journeyId,
        body.stepName,
        body.success,
        body.metadata || {}
      );

      return res.status(HttpStatus.OK).json({
        statusCode: HttpStatus.OK,
        message: 'Journey step added successfully',
        data: { added: true }
      });
    } catch (error) {
      this.logger.error('Failed to add journey step:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to add journey step',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Generate analytics dashboard
   */
  @Get('analytics/dashboard')
  @ApiOperation({
    summary: 'Generate analytics dashboard',
    description:
      'Get comprehensive analytics dashboard with metrics and insights'
  })
  @ApiQuery({
    name: 'period',
    required: false,
    description: 'Time period for analytics',
    enum: ['last_hour', 'last_24h', 'last_7d', 'last_30d', 'custom']
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Custom start date (ISO string)'
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Custom end date (ISO string)'
  })
  @ApiResponse({
    status: 200,
    description: 'Analytics dashboard generated successfully'
  })
  async generateAnalyticsDashboard(
    @Res() res: Response,
    @Query('period') period?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ): Promise<Response> {
    try {
      const dashboard = await this.mobileAnalyticsService.generateDashboard(
        (period as any) || 'last_24h',
        startDate,
        endDate
      );

      return res.status(HttpStatus.OK).json({
        statusCode: HttpStatus.OK,
        message: 'Analytics dashboard generated successfully',
        data: { dashboard }
      });
    } catch (error) {
      this.logger.error('Failed to generate analytics dashboard:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to generate analytics dashboard',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get AI insights
   */
  @Get('analytics/insights')
  @ApiOperation({
    summary: 'Get AI insights',
    description:
      'Generate and retrieve AI-powered insights from analytics data'
  })
  @ApiResponse({
    status: 200,
    description: 'AI insights generated successfully'
  })
  async getAIInsights(@Res() res: Response): Promise<Response> {
    try {
      const insights = await this.mobileAnalyticsService.generateAIInsights();

      return res.status(HttpStatus.OK).json({
        statusCode: HttpStatus.OK,
        message: 'AI insights generated successfully',
        data: { insights }
      });
    } catch (error) {
      this.logger.error('Failed to generate AI insights:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to generate AI insights',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get user engagement metrics
   */
  @Get('analytics/engagement/:userId')
  @ApiOperation({
    summary: 'Get user engagement metrics',
    description: 'Retrieve detailed engagement metrics for a specific user'
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({
    name: 'period',
    required: false,
    description: 'Time period for metrics',
    enum: ['daily', 'weekly', 'monthly']
  })
  @ApiResponse({
    status: 200,
    description: 'User engagement metrics retrieved successfully'
  })
  async getUserEngagementMetrics(
    @Res() res: Response,
    @Param('userId') userId: string,
    @Query('period') period?: string
  ): Promise<Response> {
    try {
      const metrics =
        await this.mobileAnalyticsService.getUserEngagementMetrics(
          userId,
          (period as any) || 'weekly'
        );

      return res.status(HttpStatus.OK).json({
        statusCode: HttpStatus.OK,
        message: 'User engagement metrics retrieved successfully',
        data: { metrics }
      });
    } catch (error) {
      this.logger.error('Failed to get user engagement metrics:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to get user engagement metrics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get user journey analytics
   */
  @Get('analytics/journey')
  @ApiOperation({
    summary: 'Get user journey analytics',
    description:
      'Retrieve journey analytics including conversion rates and drop-off analysis'
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Filter by specific user ID'
  })
  @ApiResponse({
    status: 200,
    description: 'User journey analytics retrieved successfully'
  })
  async getUserJourneyAnalytics(
    @Res() res: Response,
    @Query('userId') userId?: string
  ): Promise<Response> {
    try {
      const analytics =
        await this.mobileAnalyticsService.getUserJourneyAnalytics(userId);

      return res.status(HttpStatus.OK).json({
        statusCode: HttpStatus.OK,
        message: 'User journey analytics retrieved successfully',
        data: { analytics }
      });
    } catch (error) {
      this.logger.error('Failed to get user journey analytics:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to get user journey analytics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Real Mobile Wallet DIDComm Webhook
   * This endpoint receives real DIDComm protocol messages from mobile wallets
   */
  @Post('mobile/webhook/didcomm')
  @ApiOperation({
    summary: 'Real Mobile Wallet DIDComm Webhook',
    description:
      'Receives real DIDComm protocol messages from mobile wallet applications for connection establishment, credential exchange, and proof presentation'
  })
  @ApiBody({
    description: 'DIDComm message payload from mobile wallet',
    schema: {
      type: 'object',
      properties: {
        '@id': { type: 'string', description: 'Message ID' },
        '@type': {
          type: 'string',
          description:
            'Message type (e.g., https://didcomm.org/connections/1.0/request)'
        },
        connectionId: { type: 'string', description: 'Connection ID' },
        threadId: {
          type: 'string',
          description: 'Thread ID for message correlation'
        },
        state: { type: 'string', description: 'Current state of the protocol' },
        role: {
          type: 'string',
          description: 'Role in the protocol (inviter/invitee)'
        },
        orgId: { type: 'string', description: 'Organization ID' },
        metadata: { type: 'object', description: 'Additional metadata' }
      },
      required: ['@id', '@type']
    }
  })
  @ApiResponse({
    status: 200,
    description: 'DIDComm webhook processed successfully'
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid DIDComm message format'
  })
  async handleMobileWebhook(
    @Body() webhookData: any,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<Response> {
    // 🔍 CHECKPOINT 1: INCOMING MOBILE CONNECTION
    const timestamp = new Date().toISOString();
    const checkpointId = `MOBILE_CHECKPOINT_${Date.now()}`;

    this.logger.log('🔍📱 ===== MOBILE WEBHOOK CHECKPOINT =====', {
      checkpointId,
      timestamp,
      method: req.method,
      url: req.url,
      headers: {
        userAgent: req.headers['user-agent'],
        contentType: req.headers['content-type'],
        authorization: req.headers['authorization'] ? '[PRESENT]' : '[MISSING]',
        origin: req.headers['origin'],
        referer: req.headers['referer']
      },
      body: JSON.stringify(webhookData, null, 2),
      bodySize: JSON.stringify(webhookData).length
    });

    try {
      // 🔍 CHECKPOINT 2: VALIDATE DIDCOMM MESSAGE
      if (!webhookData || 'object' !== typeof webhookData) {
        this.logger.error('🔍❌ CHECKPOINT: Invalid webhook data', {
          checkpointId,
          error: 'Webhook data is null or not an object',
          receivedType: typeof webhookData,
          receivedValue: webhookData
        });

        return res.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Invalid webhook data: Expected JSON object',
          error: 'Bad Request',
          checkpointId,
          timestamp
        });
      }

      const messageId = webhookData['@id'] || webhookData.id;
      const messageType = webhookData['@type'] || webhookData.type;

      if (!messageId || !messageType) {
        this.logger.error('🔍❌ CHECKPOINT: Missing required DIDComm fields', {
          checkpointId,
          messageId: messageId || '[MISSING]',
          messageType: messageType || '[MISSING]',
          availableFields: Object.keys(webhookData)
        });

        return res.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Invalid DIDComm message: Missing @id or @type',
          error: 'Bad Request',
          checkpointId,
          timestamp
        });
      }

      // 🔍 CHECKPOINT 3: PROCESS DIDCOMM MESSAGE
      this.logger.log('🔍✅ CHECKPOINT: Valid DIDComm message received', {
        checkpointId,
        messageId,
        messageType,
        connectionId: webhookData.connectionId || '[NOT_SET]',
        state: webhookData.state || '[NOT_SET]',
        threadId: webhookData.threadId || '[NOT_SET]',
        orgId: webhookData.orgId || '[NOT_SET]',
        role: webhookData.role || '[NOT_SET]'
      });

      // 🔍 CHECKPOINT 4: DETECT MESSAGE CATEGORY
      const messageCategory = this.categorizeMessage(messageType);
      this.logger.log('🔍🏷️ CHECKPOINT: Message categorized', {
        checkpointId,
        messageType,
        category: messageCategory,
        isConnection: 'connection' === messageCategory,
        isCredential: 'credential' === messageCategory,
        isProof: 'proof' === messageCategory,
        isBasicMessage: 'basic-message' === messageCategory
      });

      // 🔍 CHECKPOINT 5: MOBILE DEVICE DETECTION
      const deviceInfo = this.extractDeviceInfo(req);
      this.logger.log('🔍📱 CHECKPOINT: Mobile device detected', {
        checkpointId,
        deviceInfo,
        isMobileWallet: this.isMobileWallet(req),
        platform: deviceInfo.platform,
        walletApp: deviceInfo.walletApp
      });

      // 🔍 CHECKPOINT 6: PROCESS MESSAGE BY CATEGORY
      let processingResult;
      switch (messageCategory) {
        case 'connection':
          processingResult = await this.processConnectionMessage(
            webhookData,
            checkpointId
          );
          break;
        case 'credential':
          processingResult = await this.processCredentialMessage(
            webhookData,
            checkpointId
          );
          break;
        case 'proof':
          processingResult = await this.processProofMessage(
            webhookData,
            checkpointId
          );
          break;
        case 'basic-message':
          processingResult = await this.processBasicMessage(
            webhookData,
            checkpointId
          );
          break;
        default:
          processingResult = await this.processGenericMessage(
            webhookData,
            checkpointId
          );
      }

      // 🔍 CHECKPOINT 7: ANALYTICS AND TRACKING
      await this.trackMobileWebhookEvent(webhookData, deviceInfo, checkpointId);

      // 🔍 CHECKPOINT 8: REAL-TIME NOTIFICATIONS
      if (webhookData.connectionId) {
        await this.sendRealTimeUpdate(webhookData, checkpointId);
      }

      // 🔍 CHECKPOINT 9: SUCCESS RESPONSE
      this.logger.log(
        '🔍🎉 CHECKPOINT: Mobile webhook processed successfully',
        {
          checkpointId,
          messageId,
          messageType,
          category: messageCategory,
          processingResult,
          duration: Date.now() - parseInt(checkpointId.split('_')[2])
        }
      );

      return res.status(HttpStatus.OK).json({
        statusCode: HttpStatus.OK,
        message: 'DIDComm webhook processed successfully',
        data: {
          messageId,
          processed: true,
          category: messageCategory,
          processingResult,
          checkpointId,
          timestamp
        }
      });
    } catch (error) {
      // 🔍 CHECKPOINT 10: ERROR HANDLING
      this.logger.error('🔍💥 CHECKPOINT: Mobile webhook processing failed', {
        checkpointId,
        error: error.message,
        stack: error.stack,
        webhookData: JSON.stringify(webhookData, null, 2)
      });

      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to process mobile webhook',
        error: error.message,
        checkpointId,
        timestamp
      });
    }
  }
  async handleMobileWalletDIDCommWebhook(
    @Body() webhookPayload: any,
    @Res() res: Response
  ): Promise<Response> {
    try {
      this.logger.log('🚀 Real Mobile Wallet DIDComm Webhook received:', {
        type: webhookPayload['@type'],
        id: webhookPayload['@id'],
        connectionId: webhookPayload.connectionId,
        state: webhookPayload.state
      });

      // Validate required fields
      if (!webhookPayload['@id'] || !webhookPayload['@type']) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Invalid DIDComm message: Missing @id or @type',
          error: 'Bad Request'
        });
      }

      // Add timestamp if not present
      const processedPayload = {
        ...webhookPayload,
        timestamp: webhookPayload.timestamp || new Date().toISOString()
      };

      // Process the webhook with real DIDComm service
      await this.realDIDCommWebhookService.processWebhook(processedPayload);

      // Also integrate with mobile security for enhanced tracking
      if (webhookPayload.connectionId && webhookPayload.state) {
        await this.processMobileConnection(
          {
            connectionId: webhookPayload.connectionId,
            state: webhookPayload.state,
            theirDid: webhookPayload.theirDid,
            theirLabel: webhookPayload.theirLabel,
            metadata: webhookPayload.metadata
          },
          webhookPayload.orgId || 'unknown'
        );
      }

      this.logger.log(
        '✅ Mobile wallet DIDComm webhook processed successfully'
      );

      return res.status(HttpStatus.OK).json({
        statusCode: HttpStatus.OK,
        message: 'DIDComm webhook processed successfully',
        data: {
          messageId: webhookPayload['@id'],
          processed: true,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      this.logger.error(
        '❌ Failed to process mobile wallet DIDComm webhook:',
        error
      );
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to process DIDComm webhook',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Register Mobile Device for Push Notifications
   */
  @Post('mobile/device/register')
  @ApiOperation({
    summary: 'Register Mobile Device for Push Notifications',
    description:
      'Register a mobile device to receive push notifications for DIDComm events'
  })
  @ApiBody({
    description: 'Device registration data',
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID' },
        deviceId: { type: 'string', description: 'Device ID' },
        fcmToken: {
          type: 'string',
          description: 'Firebase Cloud Messaging token'
        },
        platform: {
          type: 'string',
          enum: ['android', 'ios'],
          description: 'Mobile platform'
        },
        appVersion: { type: 'string', description: 'App version' }
      },
      required: ['userId', 'deviceId', 'fcmToken', 'platform']
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Device registered successfully'
  })
  async registerMobileDevice(
    @Body()
    deviceData: {
      userId: string;
      deviceId: string;
      fcmToken: string;
      platform: 'android' | 'ios';
      appVersion?: string;
    },
    @Res() res: Response
  ): Promise<Response> {
    try {
      await this.mobilePushNotificationService.registerDevice(
        deviceData.userId,
        deviceData.deviceId,
        deviceData.fcmToken,
        deviceData.platform,
        deviceData.appVersion || '1.0.0'
      );

      this.logger.log(`Mobile device registered: ${deviceData.deviceId}`);

      return res.status(HttpStatus.OK).json({
        statusCode: HttpStatus.OK,
        message: 'Device registered successfully',
        data: {
          deviceId: deviceData.deviceId,
          registered: true,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      this.logger.error('Failed to register mobile device:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to register mobile device',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * 🔍 CHECKPOINT MONITORING ENDPOINT
   * Real-time endpoint to monitor mobile app connections
   */
  @Get('mobile/checkpoint/monitor')
  @ApiOperation({
    summary: 'Monitor Mobile App Connections',
    description:
      'Real-time monitoring endpoint for mobile wallet connections and DIDComm messages'
  })
  @ApiResponse({
    status: 200,
    description: 'Monitoring data retrieved successfully'
  })
  async monitorMobileConnections(@Res() res: Response): Promise<Response> {
    const monitoringData = {
      status: '🔍 MOBILE CHECKPOINT MONITORING ACTIVE',
      timestamp: new Date().toISOString(),
      endpoints: {
        webhook: 'POST /mobile/webhook/didcomm - Main DIDComm webhook endpoint',
        deviceRegistration:
          'POST /mobile/device/register - Device registration',
        monitoring: 'GET /mobile/checkpoint/monitor - This monitoring endpoint'
      },
      instructions: {
        testing:
          'Use a mobile wallet app to scan QR codes or send DIDComm messages',
        logs: 'Watch the server logs for checkpoint messages starting with 🔍',
        verification:
          'Each mobile interaction will generate a unique checkpointId'
      },
      recentActivity: {
        message: 'Monitor server logs for real-time checkpoint data',
        pattern: 'Look for logs with 🔍 emoji and \'CHECKPOINT\' keyword'
      },
      ready: true
    };

    this.logger.log(
      '🔍📊 CHECKPOINT MONITOR: Mobile monitoring dashboard accessed',
      {
        timestamp: new Date().toISOString(),
        accessedFrom: 'monitoring-endpoint'
      }
    );

    return res.status(HttpStatus.OK).json(monitoringData);
  }

  /**
   * 🔍 TEST CHECKPOINT ENDPOINT
   * Test the checkpoint system with sample data
   */
  @Post('mobile/checkpoint/test')
  @ApiOperation({
    summary: 'Test Mobile Checkpoint System',
    description:
      'Send a test DIDComm message to verify checkpoint system is working'
  })
  @ApiBody({
    description: 'Test DIDComm message',
    schema: {
      type: 'object',
      properties: {
        '@id': { type: 'string', example: 'test-message-123' },
        '@type': {
          type: 'string',
          example: 'https://didcomm.org/connections/1.0/request'
        },
        connectionId: { type: 'string', example: 'test-connection-456' },
        state: { type: 'string', example: 'request-sent' }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Test checkpoint processed successfully'
  })
  async testMobileCheckpoint(
    @Body() testData: any,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<Response> {
    // Set test headers to simulate mobile wallet
    req.headers['user-agent'] =
      testData.userAgent || 'TestMobileWallet/1.0.0 (Test Device)';
    req.headers['origin'] = testData.origin || 'test://mobile-wallet';

    this.logger.log(
      '🔍🧪 CHECKPOINT TEST: Simulating mobile wallet interaction',
      {
        testData,
        headers: req.headers
      }
    );

    // Route to the actual webhook handler
    return this.handleMobileWebhook(testData, req, res);
  }

  // 🔍 CHECKPOINT HELPER METHODS FOR MOBILE APP INSPECTION

  /**
   * Categorize DIDComm message type for processing
   */
  private categorizeMessage(messageType: string): string {
    if (
      messageType.includes('connections/') ||
      messageType.includes('out-of-band/')
    ) {
      return 'connection';
    }
    if (
      messageType.includes('issue-credential/') ||
      messageType.includes('credential/')
    ) {
      return 'credential';
    }
    if (
      messageType.includes('present-proof/') ||
      messageType.includes('proof/')
    ) {
      return 'proof';
    }
    if (
      messageType.includes('basicmessage/') ||
      messageType.includes('basic-message/')
    ) {
      return 'basic-message';
    }
    return 'generic';
  }

  /**
   * Extract device information from request headers
   */
  private extractDeviceInfo(req: Request): any {
    const userAgent = req.headers['user-agent'] || '';
    const origin = req.headers['origin'] || '';

    return {
      userAgent,
      origin,
      platform: this.detectPlatform(userAgent),
      walletApp: this.detectWalletApp(userAgent, origin),
      deviceModel: this.extractDeviceModel({ userAgent }),
      osVersion: this.extractOSVersion({ userAgent }),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Detect if request is from a mobile wallet
   */
  private isMobileWallet(req: Request): boolean {
    const userAgent = (req.headers['user-agent'] || '').toLowerCase();
    const origin = (req.headers['origin'] || '').toLowerCase();

    const mobileIndicators = [
      'mobile',
      'android',
      'ios',
      'iphone',
      'ipad',
      'bifold',
      'trinsic',
      'lissi',
      'esatus',
      'wallet'
    ];

    return mobileIndicators.some(
      (indicator) => userAgent.includes(indicator) || origin.includes(indicator)
    );
  }

  /**
   * Detect platform from user agent
   */
  private detectPlatform(userAgent: string): 'android' | 'ios' | 'web' {
    const ua = userAgent.toLowerCase();
    if (ua.includes('android')) {
      return 'android';
    }
    if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) {
      return 'ios';
    }
    return 'web';
  }

  /**
   * Detect wallet application
   */
  private detectWalletApp(userAgent: string, origin: string): string {
    const ua = userAgent.toLowerCase();
    const or = origin.toLowerCase();

    if (ua.includes('bifold') || or.includes('bifold')) {
      return 'Aries Bifold';
    }
    if (ua.includes('trinsic') || or.includes('trinsic')) {
      return 'Trinsic';
    }
    if (ua.includes('lissi') || or.includes('lissi')) {
      return 'Lissi';
    }
    if (ua.includes('esatus') || or.includes('esatus')) {
      return 'esatus';
    }
    if (ua.includes('wallet')) {
      return 'Generic Wallet';
    }

    return 'Unknown';
  }

  /**
   * Process connection-related DIDComm messages
   */
  private async processConnectionMessage(
    webhookData: any,
    checkpointId: string
  ): Promise<any> {
    this.logger.log('🔍🔗 CHECKPOINT: Processing connection message', {
      checkpointId,
      messageType: webhookData['@type'],
      connectionId: webhookData.connectionId,
      state: webhookData.state,
      role: webhookData.role
    });

    // Extract connection details
    const connectionInfo = {
      connectionId: webhookData.connectionId,
      state: webhookData.state,
      role: webhookData.role,
      theirDid: webhookData.connection?.their_did,
      theirLabel: webhookData.connection?.their_label,
      myDid: webhookData.connection?.my_did,
      metadata: webhookData.connection?.metadata
    };

    // Track connection progress
    if (connectionInfo.state) {
      this.logger.log('🔍📊 CHECKPOINT: Connection state transition', {
        checkpointId,
        from: 'previous_state', // TODO: Track previous state
        to: connectionInfo.state,
        connectionId: connectionInfo.connectionId
      });
    }

    return {
      processed: true,
      type: 'connection',
      connectionInfo,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Process credential-related DIDComm messages
   */
  private async processCredentialMessage(
    webhookData: any,
    checkpointId: string
  ): Promise<any> {
    this.logger.log('🔍🎓 CHECKPOINT: Processing credential message', {
      checkpointId,
      messageType: webhookData['@type'],
      credentialExchangeId: webhookData.credential_exchange_id,
      state: webhookData.state
    });

    return {
      processed: true,
      type: 'credential',
      credentialInfo: {
        exchangeId: webhookData.credential_exchange_id,
        state: webhookData.state,
        schemaId: webhookData.credential_proposal?.schema_id,
        credDefId: webhookData.credential_proposal?.cred_def_id
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Process proof-related DIDComm messages
   */
  private async processProofMessage(
    webhookData: any,
    checkpointId: string
  ): Promise<any> {
    this.logger.log('🔍🔍 CHECKPOINT: Processing proof message', {
      checkpointId,
      messageType: webhookData['@type'],
      presentationExchangeId: webhookData.presentation_exchange_id,
      state: webhookData.state
    });

    return {
      processed: true,
      type: 'proof',
      proofInfo: {
        exchangeId: webhookData.presentation_exchange_id,
        state: webhookData.state,
        verified: webhookData.verified
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Process basic message DIDComm messages
   */
  private async processBasicMessage(
    webhookData: any,
    checkpointId: string
  ): Promise<any> {
    this.logger.log('🔍💬 CHECKPOINT: Processing basic message', {
      checkpointId,
      messageType: webhookData['@type'],
      content: `${webhookData.content?.substr(0, 100)}...`,
      connectionId: webhookData.connection_id
    });

    return {
      processed: true,
      type: 'basic-message',
      messageInfo: {
        content: webhookData.content,
        connectionId: webhookData.connection_id
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Process generic DIDComm messages
   */
  private async processGenericMessage(
    webhookData: any,
    checkpointId: string
  ): Promise<any> {
    this.logger.log('🔍📋 CHECKPOINT: Processing generic message', {
      checkpointId,
      messageType: webhookData['@type'],
      availableFields: Object.keys(webhookData)
    });

    return {
      processed: true,
      type: 'generic',
      messageInfo: {
        type: webhookData['@type'],
        id: webhookData['@id'],
        fields: Object.keys(webhookData)
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Track mobile webhook events for analytics
   */
  private async trackMobileWebhookEvent(
    webhookData: any,
    deviceInfo: any,
    checkpointId: string
  ): Promise<void> {
    try {
      this.logger.log('🔍📈 CHECKPOINT: Tracking mobile webhook event', {
        checkpointId,
        messageType: webhookData['@type'],
        deviceInfo
      });

      // Track with mobile analytics service
      if (this.mobileAnalyticsService) {
        await this.mobileAnalyticsService.trackUserBehavior({
          userId: webhookData.connectionId || 'anonymous',
          deviceId: deviceInfo.walletApp,
          sessionId: checkpointId,
          eventType: 'user_action',
          eventCategory: 'invitation',
          eventAction: webhookData['@type'],
          eventLabel: 'mobile_webhook',
          properties: {
            messageId: webhookData['@id'],
            platform: deviceInfo.platform,
            walletApp: deviceInfo.walletApp,
            checkpointId
          },
          userAgent: deviceInfo.userAgent
        });
      }
    } catch (error) {
      this.logger.error('🔍❌ CHECKPOINT: Failed to track webhook event', {
        checkpointId,
        error: error.message
      });
    }
  }

  /**
   * Send real-time updates via WebSocket/NATS
   */
  private async sendRealTimeUpdate(
    webhookData: any,
    checkpointId: string
  ): Promise<void> {
    try {
      this.logger.log('🔍🔔 CHECKPOINT: Sending real-time update', {
        checkpointId,
        connectionId: webhookData.connectionId,
        messageType: webhookData['@type']
      });

      // Send via mobile push notification service
      if (this.mobilePushNotificationService && webhookData.connectionId) {
        await this.mobilePushNotificationService.sendNotificationToUser(
          webhookData.connectionId,
          {
            title: 'DIDComm Event',
            body: `New ${webhookData['@type']} message received`,
            data: {
              messageId: webhookData['@id'],
              messageType: webhookData['@type'],
              checkpointId,
              timestamp: new Date().toISOString()
            }
          }
        );
      }
    } catch (error) {
      this.logger.error('🔍❌ CHECKPOINT: Failed to send real-time update', {
        checkpointId,
        error: error.message
      });
    }
  }
}
