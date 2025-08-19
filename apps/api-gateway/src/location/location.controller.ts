import {
  Controller,
  Get,
  Query,
  HttpStatus,
  BadRequestException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { LocationService } from './location.service';

@ApiTags('locations')
@Controller('locations')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Get('/countries')
  @ApiOperation({
    summary: 'Get list of supported countries',
    description: 'Retrieve all countries available in the platform'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Countries retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        message: {
          type: 'string',
          example: 'Countries retrieved successfully'
        },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', example: 101 },
              name: { type: 'string', example: 'Nigeria' },
              code: { type: 'string', example: 'NG' }
            }
          }
        }
      }
    }
  })
  async getCountries() {
    const countries = await this.locationService.getCountries();
    return {
      statusCode: HttpStatus.OK,
      message: 'Countries retrieved successfully',
      data: countries
    };
  }

  @Get('/states')
  @ApiOperation({
    summary: 'Get states for a specific country',
    description: 'Retrieve all states for the specified country'
  })
  @ApiQuery({
    name: 'countryId',
    required: true,
    type: 'number',
    description: 'Country ID',
    example: 101
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'States retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        message: { type: 'string', example: 'States retrieved successfully' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', example: 4008 },
              name: { type: 'string', example: 'Lagos' },
              countryId: { type: 'number', example: 101 },
              countryCode: { type: 'string', example: 'NG' }
            }
          }
        }
      }
    }
  })
  async getStates(@Query('countryId') countryId: number) {
    const states = await this.locationService.getStatesByCountry(countryId);
    return {
      statusCode: HttpStatus.OK,
      message: 'States retrieved successfully',
      data: states
    };
  }

  @Get('/cities')
  @ApiOperation({
    summary: 'Get cities for a specific state',
    description: 'Retrieve all cities for the specified state'
  })
  @ApiQuery({
    name: 'stateId',
    required: true,
    type: 'number',
    description: 'State ID',
    example: 4008
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cities retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        message: { type: 'string', example: 'Cities retrieved successfully' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', example: 1000 },
              name: { type: 'string', example: 'Lagos Island' },
              stateId: { type: 'number', example: 4008 },
              stateCode: { type: 'string', example: 'LA' },
              countryId: { type: 'number', example: 101 },
              countryCode: { type: 'string', example: 'NG' }
            }
          }
        }
      }
    }
  })
  async getCities(@Query('stateId') stateId: number) {
    const cities = await this.locationService.getCitiesByState(stateId);
    return {
      statusCode: HttpStatus.OK,
      message: 'Cities retrieved successfully',
      data: cities
    };
  }

  @Get('/regulators')
  @ApiOperation({
    summary: 'Get regulatory bodies for a specific country',
    description:
      'Retrieve all active regulatory bodies for the specified country using either countryId or countryCode'
  })
  @ApiQuery({
    name: 'countryId',
    description: 'Country ID to get regulators for',
    required: false,
    type: Number,
    example: 161
  })
  @ApiQuery({
    name: 'countryCode',
    description: 'Country code to get regulators for (ISO 2-letter code)',
    required: false,
    type: String,
    example: 'NG'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Regulators retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        message: {
          type: 'string',
          example: 'Regulators retrieved successfully'
        },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'ng-cbn' },
              name: { type: 'string', example: 'Central Bank of Nigeria' },
              abbreviation: { type: 'string', example: 'CBN' },
              sector: { type: 'string', example: 'Banking & Finance' },
              description: {
                type: 'string',
                example:
                  'Regulates banking and financial institutions in Nigeria'
              },
              countryId: { type: 'number', example: 161 }
            }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad request - missing or invalid parameters',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          example: 'Either countryId or countryCode must be provided'
        }
      }
    }
  })
  async getRegulators(
    @Query('countryId') countryId?: number,
    @Query('countryCode') countryCode?: string
  ) {
    // Validate that at least one parameter is provided
    if (!countryId && !countryCode) {
      throw new BadRequestException(
        'Either countryId or countryCode must be provided'
      );
    }

    // Validate that both parameters are not provided
    if (countryId && countryCode) {
      throw new BadRequestException(
        'Please provide either countryId or countryCode, not both'
      );
    }

    const regulators = await this.locationService.getRegulators({
      countryId,
      countryCode: countryCode?.toUpperCase()
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Regulators retrieved successfully',
      data: regulators
    };
  }
}
