import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  UseGuards,
  UseFilters,
  HttpStatus,
  Logger
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse
} from '@nestjs/swagger';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { User } from '../authz/decorators/user.decorator';
import { PlatformAdminGuard } from '../authz/guards/platform-admin.guard';
import { PlatformAdminWalletService } from './platform-admin-wallet.service';
import {
  CreatePlatformAdminWalletDto,
  ConfigurePlatformAdminWalletDto,
  PlatformAdminWalletStatusDto
} from './dto/platform-admin-wallet.dto';
import { CustomExceptionFilter } from 'apps/api-gateway/common/exception-handler';
import { IResponse } from '@credebl/common/interfaces/response.interface';
import { ApiResponseDto } from '../dtos/apiResponse.dto';
import { UnauthorizedErrorDto } from '../dtos/unauthorized-error.dto';
import { ForbiddenErrorDto } from '../dtos/forbidden-error.dto';

interface IUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

@Controller('platform-admin')
@ApiTags('platform-admin-wallet')
@ApiBearerAuth()
@UseFilters(CustomExceptionFilter)
@UseGuards(AuthGuard('jwt'), PlatformAdminGuard)
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
export class PlatformAdminWalletController {
  private readonly logger = new Logger('PlatformAdminWalletController');

  constructor(
    private readonly platformAdminWalletService: PlatformAdminWalletService
  ) {}

  /**
   * Create Platform Admin Wallet
   * @param createWalletDto Wallet creation details
   * @param user Platform admin user
   * @param res Response object
   * @returns Wallet creation status
   */
  @Post('/wallet/create')
  @ApiOperation({
    summary: 'Create Platform Admin Wallet',
    description: 'Create a new wallet for platform administration purposes'
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Platform admin wallet created successfully',
    type: ApiResponseDto
  })
  async createPlatformAdminWallet(
    @Body() createWalletDto: CreatePlatformAdminWalletDto,
    @User() user: IUser,
    @Res() res: Response
  ): Promise<Response> {
    try {
      this.logger.log(
        `🚀 Creating platform admin wallet for user: ${user?.email}`
      );

      const walletDetails =
        await this.platformAdminWalletService.createPlatformAdminWallet(
          createWalletDto,
          user
        );

      const finalResponse: IResponse = {
        statusCode: HttpStatus.CREATED,
        message: 'Platform admin wallet created successfully',
        data: walletDetails
      };

      this.logger.log(
        `✅ Platform admin wallet creation initiated for user: ${user?.email}`
      );
      return res.status(HttpStatus.CREATED).json(finalResponse);
    } catch (error) {
      this.logger.error(
        `❌ Error creating platform admin wallet for user ${user?.email}: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Get Platform Admin Wallet Status
   * @param user Platform admin user
   * @param res Response object
   * @returns Wallet status
   */
  @Get('/wallet/status')
  @ApiOperation({
    summary: 'Get Platform Admin Wallet Status',
    description: 'Retrieve the current status of platform admin wallet'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Platform admin wallet status retrieved successfully',
    type: PlatformAdminWalletStatusDto
  })
  async getPlatformAdminWalletStatus(
    @User() user: IUser,
    @Res() res: Response
  ): Promise<Response> {
    try {
      this.logger.log(
        `🔍 Getting platform admin wallet status for user: ${user?.email}`
      );

      const walletStatus =
        await this.platformAdminWalletService.getPlatformAdminWalletStatus(
          user
        );

      const finalResponse: IResponse = {
        statusCode: HttpStatus.OK,
        message: 'Platform admin wallet status retrieved successfully',
        data: walletStatus
      };

      this.logger.log(
        `✅ Platform admin wallet status retrieved for user: ${user?.email}`
      );
      return res.status(HttpStatus.OK).json(finalResponse);
    } catch (error) {
      this.logger.error(
        `❌ Error getting platform admin wallet status for user ${user?.email}: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Configure Platform Admin Wallet
   * @param configureWalletDto Configuration details
   * @param user Platform admin user
   * @param res Response object
   * @returns Configuration status
   */
  @Post('/wallet/configure')
  @ApiOperation({
    summary: 'Configure Platform Admin Wallet',
    description: 'Configure advanced settings for platform admin wallet'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Platform admin wallet configured successfully',
    type: ApiResponseDto
  })
  async configurePlatformAdminWallet(
    @Body() configureWalletDto: ConfigurePlatformAdminWalletDto,
    @User() user: IUser,
    @Res() res: Response
  ): Promise<Response> {
    try {
      this.logger.log(
        `⚙️ Configuring platform admin wallet for user: ${user?.email}`
      );

      const configurationResult =
        await this.platformAdminWalletService.configurePlatformAdminWallet(
          configureWalletDto,
          user
        );

      const finalResponse: IResponse = {
        statusCode: HttpStatus.OK,
        message: 'Platform admin wallet configured successfully',
        data: configurationResult
      };

      this.logger.log(
        `✅ Platform admin wallet configured for user: ${user?.email}`
      );
      return res.status(HttpStatus.OK).json(finalResponse);
    } catch (error) {
      this.logger.error(
        `❌ Error configuring platform admin wallet for user ${user?.email}: ${error.message}`
      );
      throw error;
    }
  }
}
