import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import {
  CountryInterface,
  StateInterface,
  CityInterface
} from '@credebl/common/interfaces/geolocation.interface';
import { GeoLocationRepository } from './geo-location.repository';
import { ResponseMessages } from '@credebl/common/response-messages';

@Injectable()
export class GeoLocationService {
  constructor(
    private readonly logger: Logger,
    private readonly geoLocationRepository: GeoLocationRepository
  ) {}

  async getAllCountries(): Promise<CountryInterface[]> {
    try {
      this.logger.log(
        `Inside Service: finding all countries,GeoLocationService::getAllCountries`
      );
      return this.geoLocationRepository.findAllCountries();
    } catch (error) {
      this.logger.error(
        `[getAllCountries] - error in get all countries:: ${JSON.stringify(
          error
        )}`
      );
      throw new RpcException(error);
    }
  }

  async getStatesByCountryId(countryId: number): Promise<StateInterface[]> {
    try {
      this.logger.log(
        `Inside Service: finding all states for countryId= ${countryId},GeoLocationService::getStatesByCountryId`
      );
      const states = await this.geoLocationRepository.findStatesByCountryId(
        countryId
      );

      if (!states.length) {
        throw new NotFoundException(
          ResponseMessages.geolocation.error.stateNotFound
        );
      }
      return states;
    } catch (error) {
      this.logger.error(
        `[getStatesByCountryId] - error in get states by countryId:: ${JSON.stringify(
          error
        )}`
      );
      throw new RpcException(error.response ? error.response : error);
    }
  }

  async getCitiesByStateAndCountry(
    countryId: number,
    stateId: number
  ): Promise<CityInterface[]> {
    try {
      this.logger.log(
        `Inside Service: finding all cities for stateId= ${stateId} and countryId= ${countryId},GeoLocationService::getCitiesByStateAndCountry`
      );
      const cities =
        await this.geoLocationRepository.findCitiesByStateAndCountry(
          countryId,
          stateId
        );
      if (!cities.length) {
        throw new NotFoundException(
          ResponseMessages.geolocation.error.citiesNotFound
        );
      }
      return cities;
    } catch (error) {
      this.logger.error(
        `[getCitiesByStateAndCountry] - error in get cities by using countryId and stateId:: ${JSON.stringify(
          error
        )}`
      );
      throw new RpcException(error.response ? error.response : error);
    }
  }

  // ======= NEW CODE-BASED METHODS =======
  async getAllCountriesWithCodes(): Promise<CountryInterface[]> {
    try {
      this.logger.log(
        `Inside Service: finding all countries with codes, GeoLocationService::getAllCountriesWithCodes`
      );
      return this.geoLocationRepository.findAllCountriesWithCodes();
    } catch (error) {
      this.logger.error(
        `[getAllCountriesWithCodes] - error in get all countries with codes:: ${JSON.stringify(
          error
        )}`
      );
      throw new RpcException(error);
    }
  }

  async getStatesByCountryCode(countryCode: string): Promise<StateInterface[]> {
    try {
      this.logger.log(
        `Inside Service: finding all states for countryCode= ${countryCode}, GeoLocationService::getStatesByCountryCode`
      );
      const states = await this.geoLocationRepository.findStatesByCountryCode(
        countryCode
      );
      if (!states.length) {
        throw new NotFoundException(
          ResponseMessages.geolocation.error.stateNotFound
        );
      }
      return states;
    } catch (error) {
      this.logger.error(
        `[getStatesByCountryCode] - error in get states by countryCode:: ${JSON.stringify(
          error
        )}`
      );
      throw new RpcException(error.response ? error.response : error);
    }
  }

  async getCitiesByStateCode(stateCode: string): Promise<CityInterface[]> {
    try {
      this.logger.log(
        `Inside Service: finding all cities for stateCode= ${stateCode}, GeoLocationService::getCitiesByStateCode`
      );
      const cities = await this.geoLocationRepository.findCitiesByStateCode(
        stateCode
      );
      if (!cities.length) {
        throw new NotFoundException(
          ResponseMessages.geolocation.error.citiesNotFound
        );
      }
      return cities;
    } catch (error) {
      this.logger.error(
        `[getCitiesByStateCode] - error in get cities by stateCode:: ${JSON.stringify(
          error
        )}`
      );
      throw new RpcException(error.response ? error.response : error);
    }
  }

  async getCitiesByCountryAndStateCode(
    countryCode: string,
    stateCode: string
  ): Promise<CityInterface[]> {
    try {
      this.logger.log(
        `Inside Service: finding all cities for countryCode= ${countryCode} and stateCode= ${stateCode}, GeoLocationService::getCitiesByCountryAndStateCode`
      );
      const cities =
        await this.geoLocationRepository.findCitiesByCountryAndStateCode(
          countryCode,
          stateCode
        );
      if (!cities.length) {
        throw new NotFoundException(
          ResponseMessages.geolocation.error.citiesNotFound
        );
      }
      return cities;
    } catch (error) {
      this.logger.error(
        `[getCitiesByCountryAndStateCode] - error in get cities by countryCode and stateCode:: ${JSON.stringify(
          error
        )}`
      );
      throw new RpcException(error.response ? error.response : error);
    }
  }

  async getCountryByCode(
    countryCode: string
  ): Promise<CountryInterface | null> {
    try {
      this.logger.log(
        `Inside Service: finding country by code= ${countryCode}, GeoLocationService::getCountryByCode`
      );
      return this.geoLocationRepository.findCountryByCode(countryCode);
    } catch (error) {
      this.logger.error(
        `[getCountryByCode] - error in get country by code:: ${JSON.stringify(
          error
        )}`
      );
      throw new RpcException(error.response ? error.response : error);
    }
  }

  async getStateByCode(stateCode: string): Promise<StateInterface | null> {
    try {
      this.logger.log(
        `Inside Service: finding state by code= ${stateCode}, GeoLocationService::getStateByCode`
      );
      return this.geoLocationRepository.findStateByCode(stateCode);
    } catch (error) {
      this.logger.error(
        `[getStateByCode] - error in get state by code:: ${JSON.stringify(
          error
        )}`
      );
      throw new RpcException(error.response ? error.response : error);
    }
  }

  async getCityByCode(cityCode: string): Promise<CityInterface | null> {
    try {
      this.logger.log(
        `Inside Service: finding city by code= ${cityCode}, GeoLocationService::getCityByCode`
      );
      return this.geoLocationRepository.findCityByCode(cityCode);
    } catch (error) {
      this.logger.error(
        `[getCityByCode] - error in get city by code:: ${JSON.stringify(error)}`
      );
      throw new RpcException(error.response ? error.response : error);
    }
  }
}
