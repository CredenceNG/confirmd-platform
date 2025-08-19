import {
  Controller,
  Get,
  HttpStatus,
  Logger,
  Param,
  Res,
  UseFilters
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GeoLocationService } from './geo-location.service';
import { ApiResponseDto } from '../dtos/apiResponse.dto';
import IResponseType from '@credebl/common/interfaces/response.interface';
import { ResponseMessages } from '@credebl/common/response-messages';
import { Response } from 'express';
import { CustomExceptionFilter } from 'apps/api-gateway/common/exception-handler';

@UseFilters(CustomExceptionFilter)
@Controller('/')
@ApiTags('geolocation')
export class GeoLocationController {
  constructor(
    private readonly geolocationService: GeoLocationService,
    private readonly logger: Logger
  ) {}

  /**
   * Retrieve a list of all countries
   * @returns A list of all available countries
   */
  @Get('countries')
  @ApiOperation({
    summary: 'Retrieve a list of all countries',
    description: 'Fetches and returns the details of all available countries.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Success',
    type: ApiResponseDto
  })
  async getAllCountries(@Res() res: Response): Promise<Response> {
    const countriesDetails = await this.geolocationService.getAllCountries();
    const finalResponse: IResponseType = {
      statusCode: HttpStatus.OK,
      message: ResponseMessages.geolocation.success.countriesVerificationCode,
      data: countriesDetails
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }

  /**
   * Retrieve a list of all states within a specified country
   * @param countryId The ID of the country
   * @returns A list of all states associated with the given countryId
   */
  @Get('countries/:countryId/states')
  @ApiOperation({
    summary: 'Retrieve a list of all states within a specified country',
    description:
      'Fetches and returns the details of all states associated with a given countryId.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Success',
    type: ApiResponseDto
  })
  async getStatesByCountryId(
    @Param('countryId') countryId: number,
    @Res() res: Response
  ): Promise<Response> {
    const statesDetails = await this.geolocationService.getStatesByCountryId(
      countryId
    );
    const finalResponse: IResponseType = {
      statusCode: HttpStatus.OK,
      message: ResponseMessages.geolocation.success.stateVerificationCode,
      data: statesDetails
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }

  /**
   * Retrieve a list of all cities within a specified state and country
   * @param countryId The ID of the country
   * @param stateId The ID of the state
   * @returns A list of all cities associated with the given countryId and stateId
   */
  @Get('countries/:countryId/states/:stateId/cities')
  @ApiOperation({
    summary:
      'Retrieve a list of all cities within a specified state and country',
    description:
      'Fetches and returns the details of all cities associated with a given countryId and stateId.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Success',
    type: ApiResponseDto
  })
  async getCitiesByStateAndCountry(
    @Param('countryId') countryId: number,
    @Param('stateId') stateId: number,
    @Res() res: Response
  ): Promise<Response> {
    const citiesDetails =
      await this.geolocationService.getCitiesByStateAndCountry(
        countryId,
        stateId
      );
    const finalResponse: IResponseType = {
      statusCode: HttpStatus.OK,
      message: ResponseMessages.geolocation.success.cityVerificationCode,
      data: citiesDetails
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }

  /**
   * Retrieve a list of all countries with codes
   * @returns A list of all available countries with their codes
   */
  @Get('countries-with-codes')
  @ApiOperation({
    summary: 'Retrieve a list of all countries with codes',
    description:
      'Fetches and returns the details of all available countries with their country codes.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Success',
    type: ApiResponseDto
  })
  async getCountriesWithCodes(@Res() res: Response): Promise<Response> {
    const countriesDetails =
      await this.geolocationService.getCountriesWithCodes();
    const finalResponse: IResponseType = {
      statusCode: HttpStatus.OK,
      message: ResponseMessages.geolocation.success.countriesVerificationCode,
      data: countriesDetails
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }

  /**
   * Retrieve states by country code
   * @param countryCode The ISO code of the country (e.g., "NG", "US")
   * @returns A list of states for the specified country code
   */
  @Get('country-code/:countryCode/states')
  @ApiOperation({
    summary: 'Retrieve states by country code',
    description: 'Fetches and returns states for the specified country code.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Success',
    type: ApiResponseDto
  })
  async getStatesByCountryCode(
    @Param('countryCode') countryCode: string,
    @Res() res: Response
  ): Promise<Response> {
    const statesDetails = await this.geolocationService.getStatesByCountryCode(
      countryCode
    );
    const finalResponse: IResponseType = {
      statusCode: HttpStatus.OK,
      message: ResponseMessages.geolocation.success.stateVerificationCode,
      data: statesDetails
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }

  /**
   * Retrieve cities by state code
   * @param stateCode The code of the state (e.g., "LA", "CA")
   * @returns A list of cities for the specified state code
   */
  @Get('states/:stateCode/cities')
  @ApiOperation({
    summary: 'Retrieve cities by state code',
    description: 'Fetches and returns cities for the specified state code.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Success',
    type: ApiResponseDto
  })
  async getCitiesByStateCode(
    @Param('stateCode') stateCode: string,
    @Res() res: Response
  ): Promise<Response> {
    const citiesDetails = await this.geolocationService.getCitiesByStateCode(
      stateCode
    );
    const finalResponse: IResponseType = {
      statusCode: HttpStatus.OK,
      message: ResponseMessages.geolocation.success.cityVerificationCode,
      data: citiesDetails
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }

  /**
   * Retrieve cities by country and state codes
   * @param countryCode The ISO code of the country
   * @param stateCode The code of the state
   * @returns A list of cities for the specified country and state codes
   */
  @Get('country-code/:countryCode/states/:stateCode/cities')
  @ApiOperation({
    summary: 'Retrieve cities by country and state codes',
    description:
      'Fetches and returns cities for the specified country and state codes.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Success',
    type: ApiResponseDto
  })
  async getCitiesByCountryAndStateCode(
    @Param('countryCode') countryCode: string,
    @Param('stateCode') stateCode: string,
    @Res() res: Response
  ): Promise<Response> {
    const citiesDetails =
      await this.geolocationService.getCitiesByCountryAndStateCode(
        countryCode,
        stateCode
      );
    const finalResponse: IResponseType = {
      statusCode: HttpStatus.OK,
      message: ResponseMessages.geolocation.success.cityVerificationCode,
      data: citiesDetails
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }

  /**
   * Validate and get country by code
   * @param countryCode The ISO code of the country
   * @returns Country details if valid, null if not found
   */
  @Get('validate/country/:countryCode')
  @ApiOperation({
    summary: 'Validate country code',
    description:
      'Validates and returns country details for the specified country code.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Success',
    type: ApiResponseDto
  })
  async validateCountryCode(
    @Param('countryCode') countryCode: string,
    @Res() res: Response
  ): Promise<Response> {
    const countryDetails = await this.geolocationService.getCountryByCode(
      countryCode
    );
    const finalResponse: IResponseType = {
      statusCode: HttpStatus.OK,
      message: countryDetails ? 'Country found' : 'Country not found',
      data: countryDetails
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }

  /**
   * Validate and get state by code
   * @param stateCode The code of the state
   * @returns State details if valid, null if not found
   */
  @Get('validate/state/:stateCode')
  @ApiOperation({
    summary: 'Validate state code',
    description:
      'Validates and returns state details for the specified state code.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Success',
    type: ApiResponseDto
  })
  async validateStateCode(
    @Param('stateCode') stateCode: string,
    @Res() res: Response
  ): Promise<Response> {
    const stateDetails = await this.geolocationService.getStateByCode(
      stateCode
    );
    const finalResponse: IResponseType = {
      statusCode: HttpStatus.OK,
      message: stateDetails ? 'State found' : 'State not found',
      data: stateDetails
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }

  /**
   * Validate and get city by code
   * @param cityCode The code of the city
   * @returns City details if valid, null if not found
   */
  @Get('validate/city/:cityCode')
  @ApiOperation({
    summary: 'Validate city code',
    description:
      'Validates and returns city details for the specified city code.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Success',
    type: ApiResponseDto
  })
  async validateCityCode(
    @Param('cityCode') cityCode: string,
    @Res() res: Response
  ): Promise<Response> {
    const cityDetails = await this.geolocationService.getCityByCode(cityCode);
    const finalResponse: IResponseType = {
      statusCode: HttpStatus.OK,
      message: cityDetails ? 'City found' : 'City not found',
      data: cityDetails
    };
    return res.status(HttpStatus.OK).json(finalResponse);
  }
}
