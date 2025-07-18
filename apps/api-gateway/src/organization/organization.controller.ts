import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiForbiddenResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { CommonService } from "@credebl/common";
import {
  Controller,
  Get,
  Put,
  Param,
  UseGuards,
  UseFilters,
  Post,
  Body,
  Res,
  HttpStatus,
  Query,
  Delete,
  ParseUUIDPipe,
  BadRequestException,
  ValidationPipe,
  UsePipes,
} from "@nestjs/common";
import { OrganizationService } from "./organization.service";
import { CreateOrganizationDto } from "./dtos/create-organization-dto";
import IResponse from "@credebl/common/interfaces/response.interface";
import { Response } from "express";
import { ApiResponseDto } from "../dtos/apiResponse.dto";
import { UnauthorizedErrorDto } from "../dtos/unauthorized-error.dto";
import { ForbiddenErrorDto } from "../dtos/forbidden-error.dto";
import { AuthGuard } from "@nestjs/passport";
import { User } from "../authz/decorators/user.decorator";
import { user } from "@prisma/client";
import { ResponseMessages } from "@credebl/common/response-messages";
import { BulkSendInvitationDto } from "./dtos/send-invitation.dto";
import { OrgRolesGuard } from "../authz/guards/org-roles.guard";
import { Roles } from "../authz/decorators/roles.decorator";
import { OrgRoles } from "libs/org-roles/enums";
import { UpdateUserRolesDto } from "./dtos/update-user-roles.dto";
import { UpdateOrganizationDto } from "./dtos/update-organization-dto";
import { CustomExceptionFilter } from "apps/api-gateway/common/exception-handler";
import { IUserRequestInterface } from "../interfaces/IUserRequestInterface";
import { ClientCredentialsDto } from "./dtos/client-credentials.dto";
import { PaginationDto } from "@credebl/common/dtos/pagination.dto";
import { validate as isValidUUID } from "uuid";
import { UserAccessGuard } from "../authz/guards/user-access-guard";
import { GetAllOrganizationsDto } from "./dtos/get-organizations.dto";
import { PrimaryDid } from "./dtos/set-primary-did.dto";
import { TrimStringParamPipe } from "@credebl/common/cast.helper";
import { Logger } from "@nestjs/common";

@UseFilters(CustomExceptionFilter)
@Controller("orgs")
@ApiTags("organizations")
@ApiUnauthorizedResponse({
  status: HttpStatus.UNAUTHORIZED,
  description: "Unauthorized",
  type: UnauthorizedErrorDto,
})
@ApiForbiddenResponse({
  status: HttpStatus.FORBIDDEN,
  description: "Forbidden",
  type: ForbiddenErrorDto,
})
export class OrganizationController {
  private readonly logger = new Logger("OrganizationController");

  constructor(
    private readonly organizationService: OrganizationService,
    private readonly commonService: CommonService
  ) {}

  /**
   * Get organization profile details
   * @param orgId The ID of the organization
   * @returns Organization logo image
   */
  @Get("/profile/:orgId")
  @ApiOperation({
    summary: "Organization Profile",
    description: "Get organization profile details",
  })
  @ApiExcludeEndpoint()
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Success",
    type: ApiResponseDto,
  })
  async getOrgPofile(
    @Param(
      "orgId",
      new ParseUUIDPipe({
        exceptionFactory: (): Error => {
          throw new BadRequestException(
            ResponseMessages.organisation.error.invalidOrgId
          );
        },
      })
    )
    orgId: string,
    @Res() res: Response
  ): Promise<Response> {
    const orgProfile = await this.organizationService.getOrgPofile(orgId);

    const base64Data = orgProfile["logoUrl"];
    const getImageBuffer = await this.organizationService.getBase64Image(
      base64Data
    );
    res.setHeader("Content-Type", "image/png");
    return res.send(getImageBuffer);
  }

  /**
   * Get all public profile organizations
   * @returns List of public organizations
   */
  @Get("/public-profile")
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Success",
    type: ApiResponseDto,
  })
  @ApiOperation({
    summary: "Get all public profile organizations",
    description:
      "Retrieve a list of all public profile organizations. Supports pagination and search.",
  })
  @ApiQuery({
    name: "pageNumber",
    type: Number,
    required: false,
  })
  @ApiQuery({
    name: "pageSize",
    type: Number,
    required: false,
  })
  @ApiQuery({
    name: "search",
    type: String,
    required: false,
  })
  async get(
    @Query() paginationDto: PaginationDto,
    @Res() res: Response
  ): Promise<Response> {
    const users = await this.organizationService.getPublicOrganizations(
      paginationDto
    );
    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: ResponseMessages.organisation.success.getOrganizations,
      data: users,
    };

    return res.status(HttpStatus.OK).json(finalResponse);
  }

  /**
   * Fetch org-roles details
   * @param orgId The ID of the organization
   * @returns Organization roles details
   */
  @Get("/:orgId/roles")
  @ApiOperation({
    summary: "Fetch org-roles details",
    description: "Retrieve the roles details for a specific organization.",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Success",
    type: ApiResponseDto,
  })
  @UseGuards(AuthGuard("jwt"), OrgRolesGuard)
  @Roles(OrgRoles.OWNER, OrgRoles.ADMIN)
  @ApiBearerAuth()
  async getOrgRoles(
    @Param("orgId") orgId: string,
    @User() user: user,
    @Res() res: Response
  ): Promise<Response> {
    const orgRoles = await this.organizationService.getOrgRoles(
      orgId.trim(),
      user
    );

    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: ResponseMessages.organisation.success.fetchOrgRoles,
      data: orgRoles,
    };

    return res.status(HttpStatus.OK).json(finalResponse);
  }
  /**
   * Fetch organization details
   * @param orgSlug The slug of the organization
   * @returns Organization details
   */
  @Get("public-profiles/:orgSlug")
  @ApiOperation({
    summary: "Fetch organization details",
    description:
      "Retrieve the details of a specific organization using its slug.",
  })
  @ApiParam({
    name: "orgSlug",
    type: String,
    required: true,
  })
  async getPublicProfile(
    @Param("orgSlug") orgSlug: string,
    @Res() res: Response
  ): Promise<Response> {
    // eslint-disable-next-line no-param-reassign
    orgSlug = orgSlug.trim();

    if (!orgSlug.length) {
      throw new BadRequestException(
        ResponseMessages.organisation.error.orgSlugIsRequired
      );
    }
    const userData = await this.organizationService.getPublicProfile(orgSlug);

    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: ResponseMessages.organisation.success.fetchProfile,
      data: userData,
    };

    return res.status(HttpStatus.OK).json(finalResponse);
  }

  /**
   * Get organization dashboard details
   * @param orgId The ID of the organization
   * @returns Organization dashboard details
   */
  @Get("/dashboard/:orgId")
  @ApiOperation({
    summary: "Get dashboard details",
    description: "Get organization dashboard details",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Success",
    type: ApiResponseDto,
  })
  @UseGuards(AuthGuard("jwt"), OrgRolesGuard)
  @ApiBearerAuth()
  @Roles(
    OrgRoles.OWNER,
    OrgRoles.SUPER_ADMIN,
    OrgRoles.ADMIN,
    OrgRoles.ISSUER,
    OrgRoles.VERIFIER,
    OrgRoles.MEMBER
  )
  async getOrganizationDashboard(
    @Param("orgId") orgId: string,
    @Res() res: Response,
    @User() reqUser: user
  ): Promise<Response> {
    const getOrganization =
      await this.organizationService.getOrganizationDashboard(
        orgId,
        reqUser.id
      );

    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: ResponseMessages.organisation.success.getOrgDashboard,
      data: getOrganization,
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }
  /**
   * Get organization references count
   * @param orgId The ID of the organization
   * @returns Organization references count
   */
  @Get("/activity-count/:orgId")
  @ApiOperation({
    summary: "Get organization references count",
    description:
      "Retrieve the count of references for a specific organization.",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Success",
    type: ApiResponseDto,
  })
  @UseGuards(AuthGuard("jwt"), OrgRolesGuard)
  @ApiBearerAuth()
  @Roles(OrgRoles.OWNER)
  async getOrganizationActivityCount(
    @Param(
      "orgId",
      new ParseUUIDPipe({
        exceptionFactory: (): Error => {
          throw new BadRequestException(
            ResponseMessages.organisation.error.invalidOrgId
          );
        },
      })
    )
    orgId: string,
    @Res() res: Response,
    @User() reqUser: user
  ): Promise<Response> {
    const getOrganization =
      await this.organizationService.getOrganizationActivityCount(
        orgId,
        reqUser.id
      );

    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: ResponseMessages.organisation.success.getOrganizationActivity,
      data: getOrganization,
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }
  /**
   * Get all invitations
   * @param orgId The ID of the organization
   * @returns List of all invitations
   */
  @Get("/:orgId/invitations")
  @ApiOperation({
    summary: "Get all invitations",
    description:
      "Retrieve a list of all invitations for a specific organization. Supports pagination and search.",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Success",
    type: ApiResponseDto,
  })
  @UseGuards(AuthGuard("jwt"), OrgRolesGuard)
  @ApiBearerAuth()
  @ApiQuery({
    name: "pageNumber",
    type: Number,
    required: false,
  })
  @ApiQuery({
    name: "pageSize",
    type: Number,
    required: false,
  })
  @ApiQuery({
    name: "search",
    type: String,
    required: false,
  })
  @Roles(
    OrgRoles.OWNER,
    OrgRoles.SUPER_ADMIN,
    OrgRoles.ADMIN,
    OrgRoles.ISSUER,
    OrgRoles.VERIFIER,
    OrgRoles.MEMBER
  )
  async getInvitationsByOrgId(
    @Param("orgId") orgId: string,
    @Query() paginationDto: PaginationDto,
    @Res() res: Response
  ): Promise<Response> {
    const getInvitationById =
      await this.organizationService.getInvitationsByOrgId(
        orgId,
        paginationDto
      );

    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: ResponseMessages.organisation.success.getInvitation,
      data: getInvitationById,
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }
  /**
   * Get all organizations
   * @returns List of all organizations
   */
  @Get("/")
  @ApiOperation({
    summary: "Get all organizations",
    description: "Retrieve a list of all organizations.",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Success",
    type: ApiResponseDto,
  })
  @UseGuards(AuthGuard("jwt"), UserAccessGuard)
  @ApiBearerAuth()
  async getOrganizations(
    @Query() organizationDto: GetAllOrganizationsDto,
    @Res() res: Response,
    @User() reqUser: user
  ): Promise<Response> {
    const getOrganizations = await this.organizationService.getOrganizations(
      organizationDto,
      reqUser.id
    );

    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: ResponseMessages.organisation.success.getOrganizations,
      data: getOrganizations,
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }

  /**
   * Get an organization by ID
   * @param orgId The ID of the organization
   * @returns Organization details
   */
  @Get("/:orgId")
  @ApiOperation({
    summary: "Get an organization",
    description: "Retrieve the details of a specific organization by its ID.",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Success",
    type: ApiResponseDto,
  })
  @UseGuards(AuthGuard("jwt"), OrgRolesGuard)
  @ApiBearerAuth()
  @Roles(
    OrgRoles.OWNER,
    OrgRoles.ADMIN,
    OrgRoles.ISSUER,
    OrgRoles.VERIFIER,
    OrgRoles.MEMBER,
    OrgRoles.PLATFORM_ADMIN
  )
  async getOrganization(
    @Param("orgId") orgId: string,
    @Res() res: Response,
    @User() reqUser: user
  ): Promise<Response> {
    const getOrganization = await this.organizationService.getOrganization(
      orgId,
      reqUser.id
    );

    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: ResponseMessages.organisation.success.getOrganization,
      data: getOrganization,
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }
  /**
   * Fetch client credentials for an organization
   * @param orgId The ID of the organization
   * @returns Client credentials
   */
  @Get("/:orgId/client_credentials")
  @Roles(
    OrgRoles.OWNER,
    OrgRoles.ADMIN,
    OrgRoles.ISSUER,
    OrgRoles.VERIFIER,
    OrgRoles.MEMBER
  )
  @ApiOperation({
    summary: "Fetch client credentials for an organization",
    description: "Fetch client id and secret for an organization",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Success",
    type: ApiResponseDto,
  })
  @UseGuards(AuthGuard("jwt"), OrgRolesGuard)
  @ApiBearerAuth()
  async fetchOrgCredentials(
    @Param("orgId") orgId: string,
    @Res() res: Response,
    @User() reqUser: user
  ): Promise<Response> {
    const orgCredentials = await this.organizationService.fetchOrgCredentials(
      orgId,
      reqUser.id
    );
    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: ResponseMessages.organisation.success.fetchedOrgCredentials,
      data: orgCredentials,
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }

  /**
   * Get organization users list
   * @param orgId The ID of the organization
   * @returns List of users in the organization
   */

  @Get("/:orgId/users")
  @Roles(
    OrgRoles.OWNER,
    OrgRoles.ADMIN,
    OrgRoles.HOLDER,
    OrgRoles.ISSUER,
    OrgRoles.SUPER_ADMIN,
    OrgRoles.MEMBER
  )
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), OrgRolesGuard)
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Success",
    type: ApiResponseDto,
  })
  @ApiOperation({
    summary: "Get organization users list",
    description:
      "Retrieve a list of users in a specific organization. Supports pagination and search.",
  })
  @ApiQuery({
    name: "pageNumber",
    type: Number,
    required: false,
  })
  @ApiQuery({
    name: "pageSize",
    type: Number,
    required: false,
  })
  @ApiQuery({
    name: "search",
    type: String,
    required: false,
  })
  async getOrganizationUsers(
    @User() user: IUserRequestInterface,
    @Query() paginationDto: PaginationDto,
    @Param("orgId") orgId: string,
    @Res() res: Response
  ): Promise<Response> {
    const users = await this.organizationService.getOrgUsers(
      orgId,
      paginationDto
    );
    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: ResponseMessages.user.success.fetchUsers,
      data: users,
    };

    return res.status(HttpStatus.OK).json(finalResponse);
  }

  /**
   * Fetch organization DIDs
   * @param orgId The ID of the organization
   * @returns List of DIDs in the organization
   */
  @Get("/:orgId/dids")
  @Roles(OrgRoles.OWNER, OrgRoles.ADMIN, OrgRoles.ISSUER, OrgRoles.MEMBER)
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), OrgRolesGuard)
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Success",
    type: ApiResponseDto,
  })
  @ApiOperation({
    summary: "Fetch organization DIDs",
    description: "Retrieve a list of all DIDs in a specific organization.",
  })
  async getAllDidByOrgId(
    @Param("orgId") orgId: string,
    @Res() res: Response
  ): Promise<Response> {
    const users = await this.organizationService.getDidList(orgId);
    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: ResponseMessages.organisation.success.orgDids,
      data: users,
    };

    return res.status(HttpStatus.OK).json(finalResponse);
  }

  /**
   * Create a new organization
   * @param createOrgDto The details of the organization to be created
   * @returns Created organization details
   */
  @Post("/")
  @ApiOperation({
    summary: "Create a new Organization",
    description: "Create a new organization with the provided details.",
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "Success",
    type: ApiResponseDto,
  })
  @UseGuards(AuthGuard("jwt"), UserAccessGuard)
  @ApiBearerAuth()
  async createOrganization(
    @Body() createOrgDto: CreateOrganizationDto,
    @Res() res: Response,
    @User() reqUser: user
  ): Promise<Response> {
    this.logger.log(
      `🚀 === API GATEWAY: ORGANIZATION CREATION REQUEST RECEIVED ===`
    );
    this.logger.log(`Organization name: ${createOrgDto.name}`);
    this.logger.log(`User: ${reqUser.email} (ID: ${reqUser.id})`);
    this.logger.log(`Keycloak User ID: ${reqUser.keycloakUserId}`);

    // eslint-disable-next-line prefer-destructuring
    const keycloakUserId = reqUser.keycloakUserId;

    this.logger.log(`📡 Forwarding request to Organization Service...`);
    const orgData = await this.organizationService.createOrganization(
      createOrgDto,
      reqUser.id,
      keycloakUserId
    );

    this.logger.log(`✅ Organization creation completed successfully`);
    this.logger.log(
      `Created organization: ${orgData.name} (ID: ${orgData.id})`
    );

    const finalResponse: IResponse = {
      statusCode: HttpStatus.CREATED,
      message: ResponseMessages.organisation.success.create,
      data: orgData,
    };
    return res.status(HttpStatus.CREATED).json(finalResponse);
  }

  /**
   * Set primary DID for an organization
   * @param orgId The ID of the organization
   * @param primaryDidPayload The primary DID details
   * @returns Success message
   */
  @Put("/:orgId/primary-did")
  @Roles(
    OrgRoles.OWNER,
    OrgRoles.ADMIN,
    OrgRoles.ISSUER,
    OrgRoles.VERIFIER,
    OrgRoles.MEMBER
  )
  @ApiOperation({
    summary: "Set primary DID",
    description: "Set the primary DID for a specific organization.",
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "Success",
    type: ApiResponseDto,
  })
  @UseGuards(AuthGuard("jwt"), OrgRolesGuard)
  @ApiBearerAuth()
  async setPrimaryDid(
    @Param("orgId") orgId: string,
    @Body() primaryDidPayload: PrimaryDid,
    @Res() res: Response
  ): Promise<Response> {
    await this.organizationService.setPrimaryDid(primaryDidPayload, orgId);
    const finalResponse: IResponse = {
      statusCode: HttpStatus.CREATED,
      message: ResponseMessages.organisation.success.primaryDid,
    };
    return res.status(HttpStatus.CREATED).json(finalResponse);
  }
  /**
   *
   * @param orgId
   * @param res
   * @param reqUser
   * @returns Organization Client Credentials
   */
  @Post("/:orgId/client_credentials")
  @Roles(OrgRoles.OWNER)
  @ApiOperation({
    summary: "Create credentials for an organization",
    description: "Create client ID and secret for a specific organization.",
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "Success",
    type: ApiResponseDto,
  })
  @UseGuards(AuthGuard("jwt"), OrgRolesGuard, UserAccessGuard)
  @ApiBearerAuth()
  async createOrgCredentials(
    @Param("orgId") orgId: string,
    @Res() res: Response,
    @User() reqUser: user
  ): Promise<Response> {
    // eslint-disable-next-line prefer-destructuring
    const keycloakUserId = reqUser.keycloakUserId;

    const orgCredentials = await this.organizationService.createOrgCredentials(
      orgId,
      reqUser.id,
      keycloakUserId
    );
    const finalResponse: IResponse = {
      statusCode: HttpStatus.CREATED,
      message: ResponseMessages.organisation.success.orgCredentials,
      data: orgCredentials,
    };
    return res.status(HttpStatus.CREATED).json(finalResponse);
  }
  /**
   * Authenticate client for credentials
   * @param clientId The client ID
   * @param clientCredentialsDto The client credentials details
   * @returns Authenticated client credentials
   */
  @Post("/:clientId/token")
  @ApiOperation({
    summary: "Authenticate client for credentials",
    description: "Authenticate client using the provided credentials.",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Success",
    type: ApiResponseDto,
  })
  async clientLoginCredentials(
    @Param("clientId") clientId: string,
    @Body() clientCredentialsDto: ClientCredentialsDto,
    @Res() res: Response
  ): Promise<Response> {
    clientCredentialsDto.clientId = clientId.trim();

    if (!clientCredentialsDto.clientId) {
      throw new BadRequestException(
        ResponseMessages.organisation.error.clientIdRequired
      );
    }

    const orgCredentials =
      await this.organizationService.clientLoginCredentials(
        clientCredentialsDto
      );
    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: ResponseMessages.organisation.success.clientCredentials,
      data: orgCredentials,
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }
  /**
   * Register client and map users
   * @returns Success message
   */
  @Post("/register-org-map-users")
  @ApiOperation({
    summary: "Register client and map users",
    description: "Register a new client and map users to the client.",
  })
  @UseGuards(AuthGuard("jwt"), OrgRolesGuard)
  @Roles(OrgRoles.PLATFORM_ADMIN)
  @ApiBearerAuth()
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Success",
    type: ApiResponseDto,
  })
  async registerOrgsMapUsers(@Res() res: Response): Promise<Response> {
    await this.organizationService.registerOrgsMapUsers();

    const finalResponse: IResponse = {
      statusCode: HttpStatus.CREATED,
      message: "Organization client created and users mapped to client",
    };

    return res.status(HttpStatus.CREATED).json(finalResponse);
  }
  /**
   * Create organization invitation
   * @param bulkInvitationDto The details of the invitation
   * @param orgId The ID of the organization
   * @returns Success message
   */
  @Post("/:orgId/invitations")
  @ApiOperation({
    summary: "Create organization invitation",
    description: "Create an invitation for a specific organization.",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Success",
    type: ApiResponseDto,
  })
  @Roles(OrgRoles.OWNER, OrgRoles.SUPER_ADMIN, OrgRoles.ADMIN)
  @UseGuards(AuthGuard("jwt"), OrgRolesGuard)
  @ApiBearerAuth()
  async createInvitation(
    @Body() bulkInvitationDto: BulkSendInvitationDto,
    @Param("orgId") orgId: string,
    @User() user: user,
    @Res() res: Response
  ): Promise<Response> {
    bulkInvitationDto.orgId = orgId;
    await this.organizationService.createInvitation(
      bulkInvitationDto,
      user.id,
      user.email
    );

    const finalResponse: IResponse = {
      statusCode: HttpStatus.CREATED,
      message: ResponseMessages.organisation.success.createInvitation,
    };

    return res.status(HttpStatus.CREATED).json(finalResponse);
  }
  /**
   * Update user roles
   * @param updateUserDto The details of the user roles to be updated
   * @param orgId The ID of the organization
   * @param userId The ID of the user
   * @returns Success message
   */
  @Put("/:orgId/user-roles/:userId")
  @Roles(OrgRoles.OWNER, OrgRoles.ADMIN)
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), OrgRolesGuard)
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Success",
    type: ApiResponseDto,
  })
  @ApiOperation({
    summary: "Update user roles",
    description: "Update the roles of a user in a specific organization.",
  })
  async updateUserRoles(
    @Body() updateUserDto: UpdateUserRolesDto,
    @Param("orgId") orgId: string,
    @Param("userId") userId: string,
    @Res() res: Response
  ): Promise<Response> {
    updateUserDto.orgId = orgId;
    updateUserDto.userId = userId.trim();
    if (!updateUserDto.userId.length) {
      throw new BadRequestException(
        ResponseMessages.organisation.error.userIdIsRequired
      );
    }

    if (!isValidUUID(updateUserDto.userId)) {
      throw new BadRequestException(
        ResponseMessages.organisation.error.invalidUserId
      );
    }

    await this.organizationService.updateUserRoles(
      updateUserDto,
      updateUserDto.userId
    );

    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: ResponseMessages.organisation.success.updateUserRoles,
    };

    return res.status(HttpStatus.OK).json(finalResponse);
  }
  /**
   * Update an organization
   * @param updateOrgDto The details of the organization to be updated
   * @param orgId The ID of the organization
   * @returns Success message
   */
  @Put("/:orgId")
  @ApiOperation({
    summary: "Update Organization",
    description: "Update the details of the organization.",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Success",
    type: ApiResponseDto,
  })
  @ApiBearerAuth()
  @Roles(OrgRoles.OWNER, OrgRoles.ADMIN)
  @ApiParam({
    name: "orgId",
  })
  @UseGuards(AuthGuard("jwt"), OrgRolesGuard, UserAccessGuard)
  @UsePipes(new ValidationPipe())
  async updateOrganization(
    @Body() updateOrgDto: UpdateOrganizationDto,
    @Param(
      "orgId",
      new ParseUUIDPipe({
        exceptionFactory: (): Error => {
          throw new BadRequestException(`Invalid format for orgId`);
        },
      })
    )
    orgId: string,
    @Res() res: Response,
    @User() reqUser: user
  ): Promise<Response> {
    updateOrgDto.orgId = orgId;
    await this.organizationService.updateOrganization(
      updateOrgDto,
      reqUser.id,
      orgId
    );

    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: ResponseMessages.organisation.success.update,
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }

  /**
   * Delete an organization
   * @param orgId The ID of the organization
   * @returns Success message
   */
  @Delete("/:orgId")
  @ApiOperation({
    summary: "Delete Organization",
    description: "Delete an organization",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Success",
    type: ApiResponseDto,
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard("jwt"), OrgRolesGuard)
  @Roles(OrgRoles.OWNER)
  async deleteOrganization(
    @Param(
      "orgId",
      TrimStringParamPipe,
      new ParseUUIDPipe({
        exceptionFactory: (): Error => {
          throw new BadRequestException(
            ResponseMessages.organisation.error.invalidOrgId
          );
        },
      })
    )
    orgId: string,
    @User() user: user,
    @Res() res: Response
  ): Promise<Response> {
    await this.organizationService.deleteOrganization(orgId, user);

    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: ResponseMessages.organisation.success.delete,
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }

  /**
   * Delete organization client credentials
   * @param orgId The ID of the organization
   * @returns Success message
   */
  @Delete("/:orgId/client_credentials")
  @ApiOperation({
    summary: "Delete Client Credentials",
    description: "Delete Organization Client Credentials",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Success",
    type: ApiResponseDto,
  })
  @ApiBearerAuth()
  @ApiExcludeEndpoint()
  @UseGuards(AuthGuard("jwt"))
  async deleteOrgClientCredentials(
    @Param("orgId") orgId: string,
    @Res() res: Response,
    @User() user: user
  ): Promise<Response> {
    const deleteResponse =
      await this.organizationService.deleteOrgClientCredentials(orgId, user);

    const finalResponse: IResponse = {
      statusCode: HttpStatus.ACCEPTED,
      message: deleteResponse,
    };
    return res.status(HttpStatus.ACCEPTED).json(finalResponse);
  }

  /**
   * Delete organization invitation
   * @param orgId The ID of the organization
   * @param invitationId The ID of the invitation
   * @returns Success message
   */
  @Delete("/:orgId/invitations/:invitationId")
  @ApiOperation({
    summary: "Delete invitation",
    description: "Delete organization invitation",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Success",
    type: ApiResponseDto,
  })
  @ApiBearerAuth()
  @Roles(OrgRoles.OWNER, OrgRoles.ADMIN)
  @UseGuards(AuthGuard("jwt"), OrgRolesGuard)
  async deleteOrganizationInvitation(
    @Param("orgId") orgId: string,
    @Param("invitationId") invitationId: string,
    @Res() res: Response
  ): Promise<Response> {
    // eslint-disable-next-line no-param-reassign
    invitationId = invitationId.trim();
    if (!invitationId.length) {
      throw new BadRequestException(
        ResponseMessages.organisation.error.invitationIdIsRequired
      );
    }

    if (!isValidUUID(invitationId)) {
      throw new BadRequestException(
        ResponseMessages.organisation.error.invalidInvitationId
      );
    }

    await this.organizationService.deleteOrganizationInvitation(
      orgId,
      invitationId
    );
    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: ResponseMessages.organisation.success.orgInvitationDeleted,
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }
}
