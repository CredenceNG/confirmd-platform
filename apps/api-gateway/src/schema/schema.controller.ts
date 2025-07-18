import { Controller, Logger, Post, Body, HttpStatus, UseGuards, Get, Query, BadRequestException, Res, UseFilters, Param, ParseUUIDPipe, Put } from '@nestjs/common';
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable camelcase */
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth, ApiForbiddenResponse, ApiUnauthorizedResponse, ApiQuery, ApiExcludeEndpoint } from '@nestjs/swagger';
import { SchemaService } from './schema.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiResponseDto } from '../dtos/apiResponse.dto';
import { UnauthorizedErrorDto } from '../dtos/unauthorized-error.dto';
import { ForbiddenErrorDto } from '../dtos/forbidden-error.dto';
import { IResponse } from '@credebl/common/interfaces/response.interface';
import { Response } from 'express';
import { User } from '../authz/decorators/user.decorator';
import { ISchemaSearchPayload } from '../interfaces/ISchemaSearch.interface';
import { ResponseMessages } from '@credebl/common/response-messages';
import { GetAllSchemaDto, GetCredentialDefinitionBySchemaIdDto } from './dtos/get-all-schema.dto';
import { OrgRoles } from 'libs/org-roles/enums';
import { Roles } from '../authz/decorators/roles.decorator';
import { IUserRequestInterface } from './interfaces';
import { OrgRolesGuard } from '../authz/guards/org-roles.guard';
import { GenericSchemaDTO } from '../dtos/create-schema.dto';
import { CustomExceptionFilter } from 'apps/api-gateway/common/exception-handler';
import { CredDefSortFields, SortFields } from '@credebl/enum/enum';
import { TrimStringParamPipe } from '@credebl/common/cast.helper';
import { UpdateSchemaDto } from './dtos/update-schema-dto';

@UseFilters(CustomExceptionFilter)
@Controller('orgs')
@ApiTags('schemas')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized', type: UnauthorizedErrorDto })
@ApiForbiddenResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden', type: ForbiddenErrorDto })
export class SchemaController {
  constructor(private readonly appService: SchemaService
  ) { }
  private readonly logger = new Logger('SchemaController');


  /**
   * Retrieves schema information from the ledger using its schema ID.
   *
   * @param orgId The organization ID.
   * @param schemaId The unique schema ID.
   * @returns The schema details retrieved from the ledger.
   */
  @Get('/:orgId/schemas/:schemaId')
  @Roles(OrgRoles.OWNER, OrgRoles.ADMIN, OrgRoles.ISSUER, OrgRoles.VERIFIER, OrgRoles.MEMBER)
  @UseGuards(AuthGuard('jwt'), OrgRolesGuard)
  @ApiOperation({
    summary: 'Get schema information from the ledger using its schema ID.',
    description: 'Retrives schema information from the ledger using its schema ID.'
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Success', type: ApiResponseDto })
  async getSchemaById(
    @Res() res: Response,
    @Param('orgId') orgId: string,    
    @Param('schemaId', TrimStringParamPipe) schemaId: string
  ): Promise<Response> {

    if (!schemaId) {
      throw new BadRequestException(ResponseMessages.schema.error.invalidSchemaId);
    }
    
    const schemaDetails = await this.appService.getSchemaById(schemaId, orgId);
    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: ResponseMessages.schema.success.fetch,
      data: schemaDetails
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }


  /**
   * Retrieves a list of credential definitions associated with a given schema ID.
   * 
   * @param orgId The organization ID.
   * @param schemaId The unique schema ID.
   * @param sortField The field by which to sort the results (optional).
   * 
   * @returns A list of credential definitions filtered by schema ID.
   */
  @Get('/:orgId/schemas/:schemaId/cred-defs')
  @ApiOperation({
    summary: 'Credential definitions by schema Id',
    description: 'Retrives credential definition list by schema Id available on platform.'
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Success', type: ApiResponseDto })
  @ApiQuery({
    name: 'sortField',
    enum: CredDefSortFields,
    required: false
  })
  @Roles(OrgRoles.OWNER, OrgRoles.ADMIN, OrgRoles.ISSUER, OrgRoles.VERIFIER, OrgRoles.MEMBER)
  @UseGuards(AuthGuard('jwt'), OrgRolesGuard)
  async getcredDeffListBySchemaId(
    @Param('orgId', new ParseUUIDPipe({exceptionFactory: (): Error => { throw new BadRequestException(ResponseMessages.organisation.error.invalidOrgId); }})) orgId: string,    
    @Param('schemaId', TrimStringParamPipe) schemaId: string,
    @Query() getCredentialDefinitionBySchemaIdDto: GetCredentialDefinitionBySchemaIdDto,
    @Res() res: Response,
    @User() user: IUserRequestInterface): Promise<Response> {

    if (!schemaId) {
      throw new BadRequestException(ResponseMessages.schema.error.invalidSchemaId);
    }

    getCredentialDefinitionBySchemaIdDto.schemaId = schemaId;
    getCredentialDefinitionBySchemaIdDto.orgId = orgId;

    const credentialDefinitionList = await this.appService.getcredDefListBySchemaId(getCredentialDefinitionBySchemaIdDto, user);
    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: ResponseMessages.schema.success.fetch,
      data: credentialDefinitionList
    };
    
    return res.status(HttpStatus.OK).json(finalResponse);
  }

  /**
   * Retrieves a list of schemas associated with a given organization ID.
   * 
   * @param orgId The organization ID.
   * 
   * @returns A list of schemas filtered by organization ID.
   */
  @Get('/:orgId/schemas')
  @ApiOperation({
    summary: 'Schemas by org id.',
    description: 'Retrieves all schemas belonging to a specific organization available on platform.'
  })
  @ApiQuery({
    name: 'sortField',
    enum: SortFields,
    required: false
  })
  @Roles(OrgRoles.OWNER, OrgRoles.ADMIN, OrgRoles.ISSUER, OrgRoles.VERIFIER, OrgRoles.MEMBER, OrgRoles.PLATFORM_ADMIN)
  @UseGuards(AuthGuard('jwt'), OrgRolesGuard)
  @ApiResponse({ status: HttpStatus.OK, description: 'Success', type: ApiResponseDto })
  async getSchemas(
    @Query() getAllSchemaDto: GetAllSchemaDto,
    @Param('orgId', new ParseUUIDPipe({exceptionFactory: (): Error => { throw new BadRequestException(ResponseMessages.organisation.error.invalidOrgId); }})) orgId: string,    
    @Res() res: Response,
    @User() user: IUserRequestInterface
  ): Promise<Response> {

    const { pageSize, searchByText, pageNumber, sortField, sortBy } = getAllSchemaDto;
    const schemaSearchCriteria: ISchemaSearchPayload = {
      pageNumber,
      searchByText,
      pageSize,
      sortField,
      sortBy
    };
    const schemasResponse = await this.appService.getSchemas(schemaSearchCriteria, user, orgId);

    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: ResponseMessages.schema.success.fetch,
      data: schemasResponse
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }


/**
 * Create and register various types of schemas.
 * 
 * @param orgId The organization ID.
 * @param schemaDetails The schema details.
 * @returns The created schema details.
 */  
  @Post('/:orgId/schemas')
  @ApiOperation({
    summary: 'Create and register various types of schemas.',
    description: 'Create and register a schema for an organization. Supports multiple systems like Indy, Polygon, and W3C standards.'
  }
  )
  @Roles(OrgRoles.OWNER, OrgRoles.ADMIN)
  @UseGuards(AuthGuard('jwt'), OrgRolesGuard)
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Success', type: ApiResponseDto })
  async createSchema(@Res() res: Response, @Body() schemaDetails: GenericSchemaDTO, @Param('orgId', new ParseUUIDPipe({exceptionFactory: (): Error => { throw new BadRequestException(ResponseMessages.organisation.error.invalidOrgId); }})) orgId: string, @User() user: IUserRequestInterface): Promise<Response> {
  const schemaResponse = await this.appService.createSchema(schemaDetails, user, orgId);
    const finalResponse: IResponse = {
      statusCode: HttpStatus.CREATED,
      message: ResponseMessages.schema.success.create,
      data: schemaResponse
    };
    return res.status(HttpStatus.CREATED).json(finalResponse);
  }

  /**
 * Update an schema alias
 * @param updateSchemaDto The details of the schema to be updated
 * @returns Success message
 */
  @Put('/schema')
  @ApiOperation({ summary: 'Update schema', description: 'Update the details of the schema' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Success', type: ApiResponseDto })
  @ApiExcludeEndpoint()
  @ApiBearerAuth()
  @Roles(OrgRoles.OWNER, OrgRoles.ADMIN)
  @UseGuards(AuthGuard('jwt'))
  async updateSchema(@Body() updateSchemaDto: UpdateSchemaDto,  @Res() res: Response): Promise<Response> {

    await this.appService.updateSchema(updateSchemaDto);

    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: ResponseMessages.schema.success.update
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }

}
