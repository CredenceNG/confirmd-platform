import { Controller } from '@nestjs/common';
import { GeoLocationService } from './geo-location.service';
import { MessagePattern } from '@nestjs/microservices';
import {
  CountryInterface,
  StateInterface,
  CityInterface
} from '@credebl/common/interfaces/geolocation.interface';

@Controller()
export class GeoLocationController {
  constructor(private readonly geoLocationService: GeoLocationService) {}

  // ======= EXISTING ID-BASED ENDPOINTS (for backward compatibility) =======
  @MessagePattern({ cmd: 'get-all-countries' })
  async getAllCountries(): Promise<CountryInterface[]> {
    return this.geoLocationService.getAllCountries();
  }

  @MessagePattern({ cmd: 'get-all-states' })
  async getStatesByCountryId(payload: {
    countryId: number;
  }): Promise<StateInterface[]> {
    return this.geoLocationService.getStatesByCountryId(payload.countryId);
  }

  @MessagePattern({ cmd: 'get-all-cities' })
  async getCitiesByStateAndCountry(payload: {
    countryId: number;
    stateId: number;
  }): Promise<CityInterface[]> {
    return this.geoLocationService.getCitiesByStateAndCountry(
      payload.countryId,
      payload.stateId
    );
  }

  // ======= NEW CODE-BASED ENDPOINTS =======
  @MessagePattern({ cmd: 'get-all-countries-with-codes' })
  async getAllCountriesWithCodes(): Promise<CountryInterface[]> {
    return this.geoLocationService.getAllCountriesWithCodes();
  }

  @MessagePattern({ cmd: 'get-states-by-country-code' })
  async getStatesByCountryCode(payload: {
    countryCode: string;
  }): Promise<StateInterface[]> {
    return this.geoLocationService.getStatesByCountryCode(payload.countryCode);
  }

  @MessagePattern({ cmd: 'get-cities-by-state-code' })
  async getCitiesByStateCode(payload: {
    stateCode: string;
  }): Promise<CityInterface[]> {
    return this.geoLocationService.getCitiesByStateCode(payload.stateCode);
  }

  @MessagePattern({ cmd: 'get-cities-by-codes' })
  async getCitiesByCountryAndStateCode(payload: {
    countryCode: string;
    stateCode: string;
  }): Promise<CityInterface[]> {
    return this.geoLocationService.getCitiesByCountryAndStateCode(
      payload.countryCode,
      payload.stateCode
    );
  }

  // ======= LOOKUP ENDPOINTS FOR VALIDATION =======
  @MessagePattern({ cmd: 'get-country-by-code' })
  async getCountryByCode(payload: {
    countryCode: string;
  }): Promise<CountryInterface | null> {
    return this.geoLocationService.getCountryByCode(payload.countryCode);
  }

  @MessagePattern({ cmd: 'get-state-by-code' })
  async getStateByCode(payload: {
    stateCode: string;
  }): Promise<StateInterface | null> {
    return this.geoLocationService.getStateByCode(payload.stateCode);
  }

  @MessagePattern({ cmd: 'get-city-by-code' })
  async getCityByCode(payload: {
    cityCode: string;
  }): Promise<CityInterface | null> {
    return this.geoLocationService.getCityByCode(payload.cityCode);
  }
}
