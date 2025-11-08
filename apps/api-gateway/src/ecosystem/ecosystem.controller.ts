import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseFilters,
  HttpStatus,
  Res,
  ParseUUIDPipe,
  BadRequestException
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { EcosystemService } from './ecosystem.service';
import { CommonService } from '@credebl/common';
import { User } from '../authz/decorators/user.decorator';
import { CustomExceptionFilter } from 'apps/api-gateway/common/exception-handler';
import { ApiResponseDto } from '../dtos/apiResponse.dto';
import { UnauthorizedErrorDto } from '../dtos/unauthorized-error.dto';
import { ForbiddenErrorDto } from '../dtos/forbidden-error.dto';
import IResponse from '@credebl/common/interfaces/response.interface';

@UseFilters(CustomExceptionFilter)
@Controller('ecosystem')
@ApiTags('ecosystem')
@ApiUnauthorizedResponse({
  status: HttpStatus.UNAUTHORIZED,
  description: 'Unauthorized',
  type: UnauthorizedErrorDto
})
@ApiForbiddenResponse({
  status: HttpStatus.FORBIDDEN,
  description: 'Forbidden',
  type: ForbiddenErrorDto
})
export class EcosystemController {
  constructor(
    private readonly ecosystemService: EcosystemService,
    private readonly commonService: CommonService
  ) {}

  /**
   * Create a new ecosystem
   */
  @Post('/')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Create a new ecosystem',
    description: 'Create a new ecosystem with name, logo, and description'
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Success',
    type: ApiResponseDto
  })
  async createEcosystem(
    @Body() createEcosystemDto: object,
    @User() user: user,
    @Res() res: Response
  ): Promise<Response> {
    const ecosystem = await this.ecosystemService.createEcosystem(createEcosystemDto, user.id);
    const finalResponse: IResponse = {
      statusCode: HttpStatus.CREATED,
      message: 'Ecosystem created successfully',
      data: ecosystem
    };
    return res.status(HttpStatus.CREATED).json(finalResponse);
  }

  /**
   * Get ecosystem by ID
   */
  @Get('/:id')
  @ApiOperation({
    summary: 'Get ecosystem by ID',
    description: 'Retrieve detailed information about a specific ecosystem'
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Ecosystem ID'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Success',
    type: ApiResponseDto
  })
  async getEcosystemById(
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: (): Error => {
          throw new BadRequestException('Invalid ecosystem ID');
        }
      })
    )
    id: string,
    @Res() res: Response
  ): Promise<Response> {
    const ecosystem = await this.ecosystemService.getEcosystemById(id);
    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: 'Ecosystem retrieved successfully',
      data: ecosystem
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }

  /**
   * Get all ecosystems
   */
  @Get('/')
  @ApiOperation({
    summary: 'Get all ecosystems',
    description: 'Retrieve a list of all ecosystems with pagination and search'
  })
  @ApiQuery({
    name: 'pageNumber',
    type: Number,
    required: false,
    description: 'Page number (default: 1)'
  })
  @ApiQuery({
    name: 'pageSize',
    type: Number,
    required: false,
    description: 'Number of items per page (default: 10)'
  })
  @ApiQuery({
    name: 'search',
    type: String,
    required: false,
    description: 'Search term'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Success',
    type: ApiResponseDto
  })
  async getAllEcosystems(
    @Res() res: Response,
    @Query('pageNumber') pageNumber = 1,
    @Query('pageSize') pageSize = 10,
    @Query('search') search = ''
  ): Promise<Response> {
    const ecosystems = await this.ecosystemService.getAllEcosystems(Number(pageNumber), Number(pageSize), search);
    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: 'Ecosystems retrieved successfully',
      data: ecosystems
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }

  /**
   * Update ecosystem
   */
  @Put('/:id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Update ecosystem',
    description: 'Update ecosystem information'
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Ecosystem ID'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Success',
    type: ApiResponseDto
  })
  async updateEcosystem(
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: (): Error => {
          throw new BadRequestException('Invalid ecosystem ID');
        }
      })
    )
    id: string,
    @Body() updateEcosystemDto: object,
    @User() user: user,
    @Res() res: Response
  ): Promise<Response> {
    const ecosystem = await this.ecosystemService.updateEcosystem(updateEcosystemDto, id, user.id);
    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: 'Ecosystem updated successfully',
      data: ecosystem
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }

  /**
   * Delete ecosystem
   */
  @Delete('/:id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Delete ecosystem',
    description: 'Soft delete an ecosystem'
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Ecosystem ID'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Success',
    type: ApiResponseDto
  })
  async deleteEcosystem(
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: (): Error => {
          throw new BadRequestException('Invalid ecosystem ID');
        }
      })
    )
    id: string,
    @User() user: user,
    @Res() res: Response
  ): Promise<Response> {
    const result = await this.ecosystemService.deleteEcosystem(id, user.id);
    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: result['message'],
      data: null
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }

  /**
   * Add organization to ecosystem
   */
  @Post('/:id/organizations')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Add organization to ecosystem',
    description: 'Add an organization to the ecosystem with specific roles'
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Ecosystem ID'
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Success',
    type: ApiResponseDto
  })
  async addOrganizationToEcosystem(
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: (): Error => {
          throw new BadRequestException('Invalid ecosystem ID');
        }
      })
    )
    id: string,
    @Body() addOrgDto: object,
    @User() user: user,
    @Res() res: Response
  ): Promise<Response> {
    const result = await this.ecosystemService.addOrganizationToEcosystem(addOrgDto, id, user.id);
    const finalResponse: IResponse = {
      statusCode: HttpStatus.CREATED,
      message: result['message'],
      data: result['data']
    };
    return res.status(HttpStatus.CREATED).json(finalResponse);
  }

  /**
   * Get ecosystem organizations
   */
  @Get('/:id/organizations')
  @ApiOperation({
    summary: 'Get ecosystem organizations',
    description: 'Retrieve all organizations in an ecosystem'
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Ecosystem ID'
  })
  @ApiQuery({
    name: 'pageNumber',
    type: Number,
    required: false,
    description: 'Page number (default: 1)'
  })
  @ApiQuery({
    name: 'pageSize',
    type: Number,
    required: false,
    description: 'Number of items per page (default: 10)'
  })
  @ApiQuery({
    name: 'search',
    type: String,
    required: false,
    description: 'Search term'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Success',
    type: ApiResponseDto
  })
  async getEcosystemOrganizations(
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: (): Error => {
          throw new BadRequestException('Invalid ecosystem ID');
        }
      })
    )
    id: string,
    @Res() res: Response,
    @Query('pageNumber') pageNumber = 1,
    @Query('pageSize') pageSize = 10,
    @Query('search') search = ''
  ): Promise<Response> {
    const organizations = await this.ecosystemService.getEcosystemOrganizations(
      id,
      Number(pageNumber),
      Number(pageSize),
      search
    );
    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: 'Organizations retrieved successfully',
      data: organizations
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }

  /**
   * Remove organization from ecosystem
   */
  @Delete('/:id/organizations/:orgId')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Remove organization from ecosystem',
    description: 'Remove an organization from the ecosystem'
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Ecosystem ID'
  })
  @ApiParam({
    name: 'orgId',
    type: String,
    description: 'Organization ID'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Success',
    type: ApiResponseDto
  })
  async removeOrganizationFromEcosystem(
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: (): Error => {
          throw new BadRequestException('Invalid ecosystem ID');
        }
      })
    )
    id: string,
    @Param(
      'orgId',
      new ParseUUIDPipe({
        exceptionFactory: (): Error => {
          throw new BadRequestException('Invalid organization ID');
        }
      })
    )
    orgId: string,
    @User() user: user,
    @Res() res: Response
  ): Promise<Response> {
    const result = await this.ecosystemService.removeOrganizationFromEcosystem(id, orgId, user.id);
    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: result['message'],
      data: null
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }

  /**
   * Add schema to ecosystem
   */
  @Post('/:id/schemas')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Add schema to ecosystem',
    description: 'Add a schema with pricing to the ecosystem'
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Ecosystem ID'
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Success',
    type: ApiResponseDto
  })
  async addSchemaToEcosystem(
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: (): Error => {
          throw new BadRequestException('Invalid ecosystem ID');
        }
      })
    )
    id: string,
    @Body() addSchemaDto: object,
    @User() user: user,
    @Res() res: Response
  ): Promise<Response> {
    const result = await this.ecosystemService.addSchemaToEcosystem(addSchemaDto, id, user.id);
    const finalResponse: IResponse = {
      statusCode: HttpStatus.CREATED,
      message: result['message'],
      data: result['data']
    };
    return res.status(HttpStatus.CREATED).json(finalResponse);
  }

  /**
   * Get ecosystem schemas
   */
  @Get('/:id/schemas')
  @ApiOperation({
    summary: 'Get ecosystem schemas',
    description: 'Retrieve all schemas in an ecosystem'
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Ecosystem ID'
  })
  @ApiQuery({
    name: 'pageNumber',
    type: Number,
    required: false,
    description: 'Page number (default: 1)'
  })
  @ApiQuery({
    name: 'pageSize',
    type: Number,
    required: false,
    description: 'Number of items per page (default: 10)'
  })
  @ApiQuery({
    name: 'search',
    type: String,
    required: false,
    description: 'Search term'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Success',
    type: ApiResponseDto
  })
  async getEcosystemSchemas(
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: (): Error => {
          throw new BadRequestException('Invalid ecosystem ID');
        }
      })
    )
    id: string,
    @Res() res: Response,
    @Query('pageNumber') pageNumber = 1,
    @Query('pageSize') pageSize = 10,
    @Query('search') search = ''
  ): Promise<Response> {
    const schemas = await this.ecosystemService.getEcosystemSchemas(id, Number(pageNumber), Number(pageSize), search);
    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: 'Schemas retrieved successfully',
      data: schemas
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }

  /**
   * Update schema pricing
   */
  @Put('/:id/schemas/:schemaId/pricing')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Update schema pricing',
    description: 'Update pricing for a schema in the ecosystem'
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Ecosystem ID'
  })
  @ApiParam({
    name: 'schemaId',
    type: String,
    description: 'Schema ID'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Success',
    type: ApiResponseDto
  })
  async updateSchemaPricing(
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: (): Error => {
          throw new BadRequestException('Invalid ecosystem ID');
        }
      })
    )
    id: string,
    @Param(
      'schemaId',
      new ParseUUIDPipe({
        exceptionFactory: (): Error => {
          throw new BadRequestException('Invalid schema ID');
        }
      })
    )
    schemaId: string,
    @Body() updatePricingDto: object,
    @User() user: user,
    @Res() res: Response
  ): Promise<Response> {
    const result = await this.ecosystemService.updateSchemaPricing(updatePricingDto, id, schemaId, user.id);
    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: result['message'],
      data: result['data']
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }

  /**
   * Create ecosystem invitation
   */
  @Post('/:id/users/invitations')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Create ecosystem invitation',
    description: 'Send an invitation to join the ecosystem'
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Ecosystem ID'
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Success',
    type: ApiResponseDto
  })
  async createEcosystemInvitation(
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: (): Error => {
          throw new BadRequestException('Invalid ecosystem ID');
        }
      })
    )
    id: string,
    @Body() invitationDto: object,
    @User() user: user,
    @Res() res: Response
  ): Promise<Response> {
    const result = await this.ecosystemService.createEcosystemInvitation(invitationDto, id, user.id);
    const finalResponse: IResponse = {
      statusCode: HttpStatus.CREATED,
      message: result['message'],
      data: result['data']
    };
    return res.status(HttpStatus.CREATED).json(finalResponse);
  }

  /**
   * Get ecosystem invitations - THIS FIXES THE 404 ERROR
   */
  @Get('/:id/users/invitations')
  @ApiOperation({
    summary: 'Get ecosystem invitations',
    description: 'Retrieve all invitations for an ecosystem'
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Ecosystem ID'
  })
  @ApiQuery({
    name: 'pageNumber',
    type: Number,
    required: false,
    description: 'Page number (default: 1)'
  })
  @ApiQuery({
    name: 'pageSize',
    type: Number,
    required: false,
    description: 'Number of items per page (default: 10)'
  })
  @ApiQuery({
    name: 'search',
    type: String,
    required: false,
    description: 'Search term'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Success',
    type: ApiResponseDto
  })
  async getEcosystemInvitations(
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: (): Error => {
          throw new BadRequestException('Invalid ecosystem ID');
        }
      })
    )
    id: string,
    @Res() res: Response,
    @Query('pageNumber') pageNumber = 1,
    @Query('pageSize') pageSize = 10,
    @Query('search') search = ''
  ): Promise<Response> {
    const invitations = await this.ecosystemService.getEcosystemInvitations(
      id,
      Number(pageNumber),
      Number(pageSize),
      search
    );
    const finalResponse: IResponse = {
      statusCode: HttpStatus.OK,
      message: 'Invitations retrieved successfully',
      data: invitations
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }
}
