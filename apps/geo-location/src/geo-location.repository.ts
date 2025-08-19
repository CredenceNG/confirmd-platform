import {
  CountryInterface,
  StateInterface,
  CityInterface
} from '@credebl/common/interfaces/geolocation.interface';
import { PrismaService } from '@credebl/prisma-service';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class GeoLocationRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger
  ) {}

  async findAllCountries(): Promise<CountryInterface[]> {
    try {
      return (await this.prisma.countries.findMany({
        select: {
          id: true,
          name: true,
          countryCode: true
        }
      } as any)) as CountryInterface[];
    } catch (error) {
      this.logger.error(
        `Error in GeoLocationRepository::[findAllCountries]: ${error}`
      );
      throw error;
    }
  }

  async findStatesByCountryId(countryId: number): Promise<StateInterface[]> {
    try {
      return (await this.prisma.states.findMany({
        where: { countryId: Number(countryId) },
        select: {
          id: true,
          name: true,
          countryId: true,
          countryCode: true,
          stateCode: true
        }
      } as any)) as StateInterface[];
    } catch (error) {
      this.logger.error(
        `Error in GeoLocationRepository::[findStatesByCountryId]: ${error} `
      );
      throw error;
    }
  }

  async findCitiesByStateAndCountry(
    countryId: number,
    stateId: number
  ): Promise<CityInterface[]> {
    try {
      return (await this.prisma.cities.findMany({
        where: {
          stateId: Number(stateId),
          countryId: Number(countryId)
        },
        select: {
          id: true,
          name: true,
          stateId: true,
          stateCode: true,
          countryId: true,
          countryCode: true,
          cityCode: true
        }
      } as any)) as CityInterface[];
    } catch (error) {
      this.logger.error(
        `Error finding cities for stateId ${stateId} and countryId ${countryId}: ${error}`
      );
      throw error;
    }
  }

  // ======= NEW CODE-BASED REPOSITORY METHODS =======
  async findAllCountriesWithCodes(): Promise<CountryInterface[]> {
    try {
      return (await this.prisma.countries.findMany({
        select: {
          id: true,
          name: true,
          countryCode: true
        }
      } as any)) as CountryInterface[];
    } catch (error) {
      this.logger.error(
        `Error in GeoLocationRepository::[findAllCountriesWithCodes]: ${error}`
      );
      throw error;
    }
  }

  async findStatesByCountryCode(
    countryCode: string
  ): Promise<StateInterface[]> {
    try {
      return (await this.prisma.states.findMany({
        where: { countryCode: countryCode.toUpperCase() } as any,
        select: {
          id: true,
          name: true,
          countryId: true,
          countryCode: true,
          stateCode: true
        }
      } as any)) as StateInterface[];
    } catch (error) {
      this.logger.error(
        `Error in GeoLocationRepository::[findStatesByCountryCode]: ${error}`
      );
      throw error;
    }
  }

  async findCitiesByStateCode(stateCode: string): Promise<CityInterface[]> {
    try {
      return (await this.prisma.cities.findMany({
        where: { stateCode: stateCode.toUpperCase() } as any,
        select: {
          id: true,
          name: true,
          stateId: true,
          stateCode: true,
          countryId: true,
          countryCode: true,
          cityCode: true
        }
      } as any)) as CityInterface[];
    } catch (error) {
      this.logger.error(
        `Error in GeoLocationRepository::[findCitiesByStateCode]: ${error}`
      );
      throw error;
    }
  }

  async findCitiesByCountryAndStateCode(
    countryCode: string,
    stateCode: string
  ): Promise<CityInterface[]> {
    try {
      return (await this.prisma.cities.findMany({
        where: {
          countryCode: countryCode.toUpperCase(),
          stateCode: stateCode.toUpperCase()
        } as any,
        select: {
          id: true,
          name: true,
          stateId: true,
          stateCode: true,
          countryId: true,
          countryCode: true,
          cityCode: true
        }
      } as any)) as CityInterface[];
    } catch (error) {
      this.logger.error(
        `Error finding cities for countryCode ${countryCode} and stateCode ${stateCode}: ${error}`
      );
      throw error;
    }
  }

  async findCountryByCode(
    countryCode: string
  ): Promise<CountryInterface | null> {
    try {
      return (await this.prisma.countries.findUnique({
        where: { countryCode: countryCode.toUpperCase() } as any,
        select: {
          id: true,
          name: true,
          countryCode: true
        }
      } as any)) as CountryInterface | null;
    } catch (error) {
      this.logger.error(
        `Error in GeoLocationRepository::[findCountryByCode]: ${error}`
      );
      throw error;
    }
  }

  async findStateByCode(stateCode: string): Promise<StateInterface | null> {
    try {
      return (await this.prisma.states.findUnique({
        where: { stateCode: stateCode.toUpperCase() } as any,
        select: {
          id: true,
          name: true,
          countryId: true,
          countryCode: true,
          stateCode: true
        }
      } as any)) as StateInterface | null;
    } catch (error) {
      this.logger.error(
        `Error in GeoLocationRepository::[findStateByCode]: ${error}`
      );
      throw error;
    }
  }

  async findCityByCode(cityCode: string): Promise<CityInterface | null> {
    try {
      return (await this.prisma.cities.findUnique({
        where: { cityCode: cityCode.toUpperCase() } as any,
        select: {
          id: true,
          name: true,
          stateId: true,
          stateCode: true,
          countryId: true,
          countryCode: true,
          cityCode: true
        }
      } as any)) as CityInterface | null;
    } catch (error) {
      this.logger.error(
        `Error in GeoLocationRepository::[findCityByCode]: ${error}`
      );
      throw error;
    }
  }
}
