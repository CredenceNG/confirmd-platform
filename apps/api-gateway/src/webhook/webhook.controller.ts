/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable no-param-reassign */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable camelcase */
import {
  Controller,
  Post,
  Body,
  Logger,
  UseGuards,
  BadRequestException,
  HttpStatus,
  Res,
  Get,
  Param,
  UseFilters,
  ParseUUIDPipe,
  Query
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
  ApiBearerAuth
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ApiResponseDto } from '../dtos/apiResponse.dto';
import { UnauthorizedErrorDto } from '../dtos/unauthorized-error.dto';
import { ForbiddenErrorDto } from '../dtos/forbidden-error.dto';
import { Response } from 'express';
import { IResponse } from '@credebl/common/interfaces/response.interface';
import { WebhookService } from './webhook.service';
import { WebhookReceiverService } from './webhook-receiver.service';
import { RegisterWebhookDto } from './dtos/register-webhook-dto';
import { ResponseMessages } from '@credebl/common/response-messages';
import { CustomExceptionFilter } from 'apps/api-gateway/common/exception-handler';
import { OrgRolesGuard } from '../authz/guards/org-roles.guard';
import { OrgRoles } from 'libs/org-roles/enums';
import { Roles } from '../authz/decorators/roles.decorator';
import { GetWebhookDto } from './dtos/get-webhoook-dto';

@UseFilters(CustomExceptionFilter)
@Controller('webhooks')
@ApiTags('webhooks')
@ApiUnauthorizedResponse({ status: 401, description: 'Unauthorized', type: UnauthorizedErrorDto })
@ApiForbiddenResponse({ status: 403, description: 'Forbidden', type: ForbiddenErrorDto })
export class WebhookController {
  constructor(
    private readonly webhookService: WebhookService,
    private readonly webhookReceiverService: WebhookReceiverService
  ) {}
  private readonly logger = new Logger('WebhookController');
  private readonly PAGE: number = 1;

  /**
   * Register a webhook URL for an organization
   * @param orgId The ID of the organization
   * @param registerWebhookDto The webhook registration details
   * @param res The response object
   * @returns The registered webhook details
   */
  @Post('/orgs/:orgId/register')
  @ApiOperation({
    summary: 'Register Webhook',
    description: 'Register a webhook URL for an organization.'
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), OrgRolesGuard)
  @Roles(OrgRoles.OWNER, OrgRoles.ADMIN)
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Webhook URL registered successfully', type: ApiResponseDto })
  async registerWebhook(
    @Param(
      'orgId',
      new ParseUUIDPipe({
        exceptionFactory: (): Error => {
          throw new BadRequestException(ResponseMessages.organisation.error.invalidOrgId);
        }
      })
    )
    orgId: string,
    @Body() registerWebhookDto: RegisterWebhookDto,
    @Res() res: Response
  ): Promise<Response> {
    registerWebhookDto.orgId = orgId;

    const webhookRegisterDetails = await this.webhookService.registerWebhook(registerWebhookDto);

    const finalResponse: IResponse = {
      statusCode: HttpStatus.CREATED,
      message: ResponseMessages.agent.success.webhookUrlRegister,
      data: webhookRegisterDetails
    };

    return res.status(HttpStatus.CREATED).json(finalResponse);
  }

  /**
   * Get the webhook URL details for an organization
   * @param getWebhook The webhook query parameters
   * @param res The response object
   * @returns The webhook URL details
   */
  @Get('/orgs/webhookurl')
  @ApiOperation({
    summary: 'Get Webhook URL Details',
    description: 'Retrieve the details of the webhook URL for an organization.'
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Roles(OrgRoles.OWNER, OrgRoles.ISSUER, OrgRoles.VERIFIER, OrgRoles.ADMIN)
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Webhook URL details retrieved successfully',
    type: ApiResponseDto
  })
  async getWebhookUrl(@Query() getWebhook: GetWebhookDto, @Res() res: Response): Promise<Response> {
    const webhookUrlData = await this.webhookService.getWebhookUrl(getWebhook);

    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: ResponseMessages.agent.success.getWebhookUrl,
      data: webhookUrlData
    };

    return res.status(HttpStatus.OK).json(finalResponse);
  }

  /**
   * Receive webhook events from Credo Controller (root webhook endpoint)
   * @param body The webhook payload
   * @param res The response object
   * @returns Success response
   */
  @Post()
  @ApiOperation({
    summary: 'Receive Webhook Events from Credo Controller',
    description: 'Root webhook endpoint for receiving all webhook events from Credo Controller and external agents.'
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Webhook event processed successfully' })
  async receiveRootWebhookEvent(@Body() body: any, @Res() res: Response): Promise<Response> {
    this.logger.log('🎯 === ROOT WEBHOOK EVENT RECEIVED ===');
    this.logger.log(`📨 Event Body: ${JSON.stringify(body, null, 2)}`);
    this.logger.log(`📊 Headers: ${JSON.stringify(res.req.headers, null, 2)}`);

    try {
      // Process the webhook event using WebhookReceiverService
      const result = await this.webhookReceiverService.processWebhookEvent(body);

      this.logger.log('✅ Root webhook event processed successfully');

      const finalResponse: IResponse = {
        statusCode: HttpStatus.OK,
        message: 'Root webhook event processed successfully',
        data: result
      };

      return res.status(HttpStatus.OK).json(finalResponse);
    } catch (error) {
      this.logger.error('❌ Root webhook event processing failed:', error);

      const errorResponse: IResponse = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Root webhook event processing failed',
        data: null
      };

      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * Receive webhook events from external agents with topic
   * @param topic The webhook topic (e.g., 'connections', 'credentials', etc.)
   * @param body The webhook payload
   * @param res The response object
   * @returns Success response
   */
  @Post('/topic')
  @ApiOperation({
    summary: 'Receive Webhook Events with Topic',
    description: 'Endpoint for receiving webhook events from external agents and clients with specific topics.'
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Webhook event processed successfully' })
  async receiveWebhookEvent(@Body() body: any, @Res() res: Response): Promise<Response> {
    this.logger.log('🎯 === EXTERNAL WEBHOOK EVENT RECEIVED ===');
    this.logger.log(`📨 WEBHOOK_PAYLOAD: ${JSON.stringify(body)}`);
    this.logger.log(`📊 Headers: ${JSON.stringify(res.req.headers)}`);

    try {
      // Process the webhook event using WebhookReceiverService
      const result = await this.webhookReceiverService.processWebhookEvent(body);

      this.logger.log('✅ Webhook event processed successfully');

      const finalResponse: IResponse = {
        statusCode: HttpStatus.OK,
        message: 'Webhook event processed successfully',
        data: result
      };

      this.logger.log(`📬 WEBHOOK_RESPONSE: ${JSON.stringify(finalResponse)}`);
      return res.status(HttpStatus.OK).json(finalResponse);
    } catch (error) {
      this.logger.error('❌ Webhook event processing failed:', error);

      const errorResponse: IResponse = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Webhook event processing failed',
        data: null
      };

      this.logger.log(`📬 WEBHOOK_RESPONSE: ${JSON.stringify(errorResponse)}`);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * Receive connection webhook events specifically
   * @param body The connection webhook payload
   * @param res The response object
   * @returns Success response
   */
  @Post('/connections')
  @ApiOperation({
    summary: 'Receive Connection Webhook Events',
    description: 'Endpoint specifically for receiving connection webhook events from DIDComm agents.'
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Connection webhook event processed successfully' })
  async receiveConnectionWebhook(@Body() body: any, @Res() res: Response): Promise<Response> {
    this.logger.log('🔗 === CONNECTION WEBHOOK EVENT RECEIVED ===');
    this.logger.log(`📨 WEBHOOK_PAYLOAD: ${JSON.stringify(body)}`);

    try {
      // Process the connection webhook event specifically
      const result = await this.webhookReceiverService.processConnectionWebhook(body);

      this.logger.log('✅ Connection webhook event processed successfully');

      const finalResponse: IResponse = {
        statusCode: HttpStatus.OK,
        message: 'Connection webhook event processed successfully',
        data: result
      };

      this.logger.log(`📬 WEBHOOK_RESPONSE: ${JSON.stringify(finalResponse)}`);
      return res.status(HttpStatus.OK).json(finalResponse);
    } catch (error) {
      this.logger.error('❌ Connection webhook event processing failed:', error);

      const errorResponse: IResponse = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Connection webhook event processing failed',
        data: null
      };

      this.logger.log(`📬 WEBHOOK_RESPONSE: ${JSON.stringify(errorResponse)}`);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * Receive credential webhook events from external agents
   * @param body The credential webhook payload
   * @param res The response object
   * @returns Success response
   */
  @Post('/credentials')
  @ApiOperation({
    summary: 'Receive Credential Webhook Events',
    description: 'Endpoint for receiving DIDComm credential issuance/verification events from external agents/wallets'
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Credential webhook event processed successfully' })
  async receiveCredentialWebhook(@Body() body: any, @Res() res: Response): Promise<Response> {
    this.logger.log('🎓 === CREDENTIAL WEBHOOK EVENT RECEIVED ===');
    this.logger.log(`📨 WEBHOOK_PAYLOAD: ${JSON.stringify(body)}`);

    try {
      const result = await this.webhookReceiverService.processCredentialWebhook(body);

      this.logger.log('✅ Credential webhook event processed successfully');

      const finalResponse: IResponse = {
        statusCode: HttpStatus.OK,
        message: 'Credential webhook event processed successfully',
        data: result
      };

      this.logger.log(`📬 WEBHOOK_RESPONSE: ${JSON.stringify(finalResponse)}`);
      return res.status(HttpStatus.OK).json(finalResponse);
    } catch (error) {
      this.logger.error('❌ Credential webhook event processing failed:', error);

      const errorResponse: IResponse = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Credential webhook event processing failed',
        data: null
      };

      this.logger.log(`📬 WEBHOOK_RESPONSE: ${JSON.stringify(errorResponse)}`);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * Receive proof webhook events from external agents
   * @param body The proof webhook payload
   * @param res The response object
   * @returns Success response
   */
  @Post('/proofs')
  @ApiOperation({
    summary: 'Receive Proof Webhook Events',
    description: 'Endpoint for receiving DIDComm proof presentation events from external agents/wallets'
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Proof webhook event processed successfully' })
  async receiveProofWebhook(@Body() body: any, @Res() res: Response): Promise<Response> {
    this.logger.log('🔍 === PROOF WEBHOOK EVENT RECEIVED ===');
    this.logger.log(`📨 WEBHOOK_PAYLOAD: ${JSON.stringify(body)}`);

    try {
      const result = await this.webhookReceiverService.processProofWebhook(body);

      this.logger.log('✅ Proof webhook event processed successfully');

      const finalResponse: IResponse = {
        statusCode: HttpStatus.OK,
        message: 'Proof webhook event processed successfully',
        data: result
      };

      this.logger.log(`📬 WEBHOOK_RESPONSE: ${JSON.stringify(finalResponse)}`);
      return res.status(HttpStatus.OK).json(finalResponse);
    } catch (error) {
      this.logger.error('❌ Proof webhook event processing failed:', error);

      const errorResponse: IResponse = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Proof webhook event processing failed',
        data: null
      };

      this.logger.log(`📬 WEBHOOK_RESPONSE: ${JSON.stringify(errorResponse)}`);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * Receive basic message webhook events from external agents
   * @param body The basic message webhook payload
   * @param res The response object
   * @returns Success response
   */
  @Post('/basic-messages')
  @ApiOperation({
    summary: 'Receive Basic Message Webhook Events',
    description: 'Endpoint for receiving DIDComm basic message events from external agents/wallets'
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Basic message webhook event processed successfully' })
  async receiveBasicMessageWebhook(@Body() body: any, @Res() res: Response): Promise<Response> {
    this.logger.log('💬 === BASIC MESSAGE WEBHOOK EVENT RECEIVED ===');
    this.logger.log(`📨 WEBHOOK_PAYLOAD: ${JSON.stringify(body)}`);

    try {
      const result = await this.webhookReceiverService.processBasicMessageWebhook(body);

      this.logger.log('✅ Basic message webhook event processed successfully');

      const finalResponse: IResponse = {
        statusCode: HttpStatus.OK,
        message: 'Basic message webhook event processed successfully',
        data: result
      };

      this.logger.log(`📬 WEBHOOK_RESPONSE: ${JSON.stringify(finalResponse)}`);
      return res.status(HttpStatus.OK).json(finalResponse);
    } catch (error) {
      this.logger.error('❌ Basic message webhook event processing failed:', error);

      const errorResponse: IResponse = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Basic message webhook event processing failed',
        data: null
      };

      this.logger.log(`📬 WEBHOOK_RESPONSE: ${JSON.stringify(errorResponse)}`);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * Receive question-answer webhook events from external agents
   * @param body The question-answer webhook payload
   * @param res The response object
   * @returns Success response
   */
  @Post('/question-answer')
  @ApiOperation({
    summary: 'Receive Question-Answer Webhook Events',
    description: 'Endpoint for receiving DIDComm question-answer protocol events from external agents/wallets'
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Question-answer webhook event processed successfully' })
  async receiveQuestionAnswerWebhook(@Body() body: any, @Res() res: Response): Promise<Response> {
    this.logger.log('❓ === QUESTION-ANSWER WEBHOOK EVENT RECEIVED ===');
    this.logger.log(`📨 WEBHOOK_PAYLOAD: ${JSON.stringify(body)}`);

    try {
      const result = await this.webhookReceiverService.processQuestionAnswerWebhook(body);

      this.logger.log('✅ Question-answer webhook event processed successfully');

      const finalResponse: IResponse = {
        statusCode: HttpStatus.OK,
        message: 'Question-answer webhook event processed successfully',
        data: result
      };

      this.logger.log(`📬 WEBHOOK_RESPONSE: ${JSON.stringify(finalResponse)}`);
      return res.status(HttpStatus.OK).json(finalResponse);
    } catch (error) {
      this.logger.error('❌ Question-answer webhook event processing failed:', error);

      const errorResponse: IResponse = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Question-answer webhook event processing failed',
        data: null
      };

      this.logger.log(`📬 WEBHOOK_RESPONSE: ${JSON.stringify(errorResponse)}`);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * Receive connection webhook events for specific organization
   * @param orgId The organization ID
   * @param body The connection webhook payload
   * @param res The response object
   * @returns Success response
   */
  @Post('/:orgId/connections')
  @ApiOperation({
    summary: 'Receive Organization-Specific Connection Webhook Events',
    description: 'Organization-specific endpoint for receiving DIDComm connection events'
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Org-specific connection webhook event processed successfully' })
  async receiveOrgConnectionWebhook(
    @Param('orgId') orgId: string,
    @Body() body: any,
    @Res() res: Response
  ): Promise<Response> {
    this.logger.log(`🏢 === ORG-SPECIFIC CONNECTION WEBHOOK RECEIVED (${orgId}) ===`);
    const payload = { ...body, orgId };
    this.logger.log(`📨 WEBHOOK_PAYLOAD: ${JSON.stringify(payload)}`);

    try {
      const result = await this.webhookReceiverService.processConnectionWebhook(payload);

      this.logger.log('✅ Org-specific connection webhook event processed successfully');

      const finalResponse: IResponse = {
        statusCode: HttpStatus.OK,
        message: 'Org-specific connection webhook event processed successfully',
        data: result
      };

      this.logger.log(`📬 WEBHOOK_RESPONSE: ${JSON.stringify(finalResponse)}`);
      return res.status(HttpStatus.OK).json(finalResponse);
    } catch (error) {
      this.logger.error('❌ Org-specific connection webhook event processing failed:', error);

      const errorResponse: IResponse = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Org-specific connection webhook event processing failed',
        data: null
      };

      this.logger.log(`📬 WEBHOOK_RESPONSE: ${JSON.stringify(errorResponse)}`);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }
}
