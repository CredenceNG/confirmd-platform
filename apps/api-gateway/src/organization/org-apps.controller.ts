import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, HttpStatus, Res, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { OrgAppsService } from './org-apps.service';

@ApiTags('Organization Apps')
@ApiBearerAuth()
@Controller('orgs/:orgId/apps')
@UseGuards(AuthGuard('jwt'))
export class OrgAppsController {
  private readonly logger = new Logger('OrgAppsController');

  constructor(private readonly orgAppsService: OrgAppsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all apps for an organization' })
  @ApiResponse({ status: 200, description: 'Apps retrieved successfully' })
  async getOrgApps(@Param('orgId') orgId: string, @Res() res: Response): Promise<Response> {
    try {
      this.logger.log(`Getting apps for organization: ${orgId}`);

      const apps = await this.orgAppsService.getOrgApps(orgId);

      return res.status(HttpStatus.OK).json({
        statusCode: HttpStatus.OK,
        message: 'Apps retrieved successfully',
        data: apps
      });
    } catch (error) {
      this.logger.error(`Error getting apps: ${error.message}`, error.stack);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: error.message
      });
    }
  }

  @Get(':appId')
  @ApiOperation({ summary: 'Get app by ID' })
  @ApiResponse({ status: 200, description: 'App retrieved successfully' })
  async getAppById(
    @Param('orgId') orgId: string,
    @Param('appId') appId: string,
    @Res() res: Response
  ): Promise<Response> {
    try {
      this.logger.log(`Getting app ${appId} for organization: ${orgId}`);

      const app = await this.orgAppsService.getAppById(orgId, appId);

      if (!app) {
        return res.status(HttpStatus.NOT_FOUND).json({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'App not found'
        });
      }

      return res.status(HttpStatus.OK).json({
        statusCode: HttpStatus.OK,
        message: 'App retrieved successfully',
        data: app
      });
    } catch (error) {
      this.logger.error(`Error getting app: ${error.message}`, error.stack);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: error.message
      });
    }
  }

  @Post()
  @ApiOperation({ summary: 'Create a new app for organization' })
  @ApiResponse({ status: 201, description: 'App created successfully' })
  async createApp(
    @Param('orgId') orgId: string,
    @Body() createAppDto: Record<string, unknown>,
    @Res() res: Response
  ): Promise<Response> {
    try {
      this.logger.log(`Creating app for organization: ${orgId}`);

      const app = await this.orgAppsService.createApp(orgId, createAppDto);

      return res.status(HttpStatus.CREATED).json({
        statusCode: HttpStatus.CREATED,
        message: 'App created successfully',
        data: app
      });
    } catch (error) {
      this.logger.error(`Error creating app: ${error.message}`, error.stack);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: error.message
      });
    }
  }

  @Put(':appId')
  @ApiOperation({ summary: 'Update an app' })
  @ApiResponse({ status: 200, description: 'App updated successfully' })
  async updateApp(
    @Param('orgId') orgId: string,
    @Param('appId') appId: string,
    @Body() updateAppDto: Record<string, unknown>,
    @Res() res: Response
  ): Promise<Response> {
    try {
      this.logger.log(`Updating app ${appId} for organization: ${orgId}`);

      const app = await this.orgAppsService.updateApp(orgId, appId, updateAppDto);

      return res.status(HttpStatus.OK).json({
        statusCode: HttpStatus.OK,
        message: 'App updated successfully',
        data: app
      });
    } catch (error) {
      this.logger.error(`Error updating app: ${error.message}`, error.stack);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: error.message
      });
    }
  }

  @Delete(':appId')
  @ApiOperation({ summary: 'Delete an app' })
  @ApiResponse({ status: 200, description: 'App deleted successfully' })
  async deleteApp(
    @Param('orgId') orgId: string,
    @Param('appId') appId: string,
    @Res() res: Response
  ): Promise<Response> {
    try {
      this.logger.log(`Deleting app ${appId} for organization: ${orgId}`);

      await this.orgAppsService.deleteApp(orgId, appId);

      return res.status(HttpStatus.OK).json({
        statusCode: HttpStatus.OK,
        message: 'App deleted successfully'
      });
    } catch (error) {
      this.logger.error(`Error deleting app: ${error.message}`, error.stack);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: error.message
      });
    }
  }
}
