import {
  CountryInterface,
  StateInterface,
  CityInterface
} from '@credebl/common/interfaces/geolocation.interface';
import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { BaseService } from 'libs/service/base.service';
import { NATSClient } from '@credebl/common/NATSClient';

@Injectable()
export class GeoLocationService extends BaseService {
  constructor(
    @Inject('NATS_CLIENT') private readonly serviceProxy: ClientProxy,
    private readonly natsClient: NATSClient
  ) {
    super('GeoLocationService');
  }

  /**
   *
   * @param
   * @returns Get all Countries list
   */
  async getAllCountries(): Promise<CountryInterface[]> {
    this.logger.log(
      `Finding all countries,GeoLocationService::getAllCountries`
    );
    return this.natsClient.sendNatsMessage(
      this.serviceProxy as any,
      'get-all-countries',
      ''
    );
  }

  /**
   *
   * @param
   * @returns Get all states list by using countryId
   */
  async getStatesByCountryId(countryId: number): Promise<StateInterface[]> {
    const payload = { countryId };
    this.logger.log(
      `Finding cities for countryId= ${countryId},GeoLocationService::getCitiesByStateAndCountry`
    );
    return this.natsClient.sendNatsMessage(
      this.serviceProxy as any,
      'get-all-states',
      payload
    );
  }

  /**
   *
   * @param
   * @returns Get all cities list by using stateId and countryId
   */

  async getCitiesByStateAndCountry(
    countryId: number,
    stateId: number
  ): Promise<CityInterface[]> {
    const payload = { countryId, stateId };
    this.logger.log(
      `Finding cities for stateId= ${stateId} and countryId= ${countryId},GeoLocationService::getCitiesByStateAndCountry`
    );
    return this.natsClient.sendNatsMessage(
      this.serviceProxy as any,
      'get-all-cities',
      payload
    );
  }

  /**
   *
   * @param
   * @returns Get all Countries list with codes
   */
  async getCountriesWithCodes(): Promise<CountryInterface[]> {
    this.logger.log(
      `Finding all countries with codes,GeoLocationService::getCountriesWithCodes`
    );
    return this.natsClient.sendNatsMessage(
      this.serviceProxy as any,
      'get-all-countries-with-codes',
      ''
    );
  }

  /**
   * Get states by country code
   * @param countryCode ISO country code (e.g., "NG", "US")
   * @returns States list for the specified country code
   */
  async getStatesByCountryCode(countryCode: string): Promise<StateInterface[]> {
    this.logger.log(
      `Finding states for countryCode= ${countryCode},GeoLocationService::getStatesByCountryCode`
    );
    return this.natsClient.sendNatsMessage(
      this.serviceProxy as any,
      'get-states-by-country-code',
      { countryCode }
    );
  }

  /**
   * Get cities by state code
   * @param stateCode State code (e.g., "LA", "CA")
   * @returns Cities list for the specified state code
   */
  async getCitiesByStateCode(stateCode: string): Promise<CityInterface[]> {
    this.logger.log(
      `Finding cities for stateCode= ${stateCode},GeoLocationService::getCitiesByStateCode`
    );
    return this.natsClient.sendNatsMessage(
      this.serviceProxy as any,
      'get-cities-by-state-code',
      { stateCode }
    );
  }

  /**
   * Get cities by country and state codes
   * @param countryCode ISO country code
   * @param stateCode State code
   * @returns Cities list for the specified country and state codes
   */
  async getCitiesByCountryAndStateCode(
    countryCode: string,
    stateCode: string
  ): Promise<CityInterface[]> {
    this.logger.log(
      `Finding cities for countryCode= ${countryCode} and stateCode= ${stateCode},GeoLocationService::getCitiesByCountryAndStateCode`
    );
    return this.natsClient.sendNatsMessage(
      this.serviceProxy as any,
      'get-cities-by-codes',
      { countryCode, stateCode }
    );
  }

  /**
   * Validate country code and get country details
   * @param countryCode ISO country code
   * @returns Country details if valid, null if not found
   */
  async getCountryByCode(
    countryCode: string
  ): Promise<CountryInterface | null> {
    this.logger.log(
      `Validating countryCode= ${countryCode},GeoLocationService::getCountryByCode`
    );
    return this.natsClient.sendNatsMessage(
      this.serviceProxy as any,
      'get-country-by-code',
      { countryCode }
    );
  }

  /**
   * Validate state code and get state details
   * @param stateCode State code
   * @returns State details if valid, null if not found
   */
  async getStateByCode(stateCode: string): Promise<StateInterface | null> {
    this.logger.log(
      `Validating stateCode= ${stateCode},GeoLocationService::getStateByCode`
    );
    return this.natsClient.sendNatsMessage(
      this.serviceProxy as any,
      'get-state-by-code',
      { stateCode }
    );
  }

  /**
   * Validate city code and get city details
   * @param cityCode City code
   * @returns City details if valid, null if not found
   */
  async getCityByCode(cityCode: string): Promise<CityInterface | null> {
    this.logger.log(
      `Validating cityCode= ${cityCode},GeoLocationService::getCityByCode`
    );
    return this.natsClient.sendNatsMessage(
      this.serviceProxy as any,
      'get-city-by-code',
      { cityCode }
    );
  }
}
