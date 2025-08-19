import { Injectable } from '@nestjs/common';
import { PrismaService } from '@credebl/prisma-service';

@Injectable()
export class LocationService {
  constructor(private readonly prisma: PrismaService) {}

  async getCountries() {
    try {
      const countries = await this.prisma.countries.findMany({
        select: {
          id: true,
          name: true
        },
        orderBy: {
          name: 'asc'
        }
      });

      return countries;
    } catch (error) {
      throw new Error(`Failed to retrieve countries: ${error.message}`);
    }
  }

  async getStatesByCountry(countryId: number) {
    try {
      const states = await this.prisma.states.findMany({
        where: {
          countryId
        },
        select: {
          id: true,
          name: true,
          countryId: true,
          countryCode: true
        },
        orderBy: {
          name: 'asc'
        }
      });

      return states;
    } catch (error) {
      throw new Error(
        `Failed to retrieve states for country ${countryId}: ${error.message}`
      );
    }
  }

  async getCitiesByState(stateId: number) {
    try {
      const cities = await this.prisma.cities.findMany({
        where: {
          stateId
        },
        select: {
          id: true,
          name: true,
          stateId: true,
          stateCode: true,
          countryId: true,
          countryCode: true
        },
        orderBy: {
          name: 'asc'
        }
      });

      return cities;
    } catch (error) {
      throw new Error(
        `Failed to retrieve cities for state ${stateId}: ${error.message}`
      );
    }
  }

  async validateLocation(
    countryId: number,
    stateId: number,
    cityId: number
  ): Promise<boolean> {
    try {
      // Check if country exists
      const country = await this.prisma.countries.findUnique({
        where: { id: countryId }
      });

      if (!country) {
        return false;
      }

      // Check if state exists and belongs to the country
      const state = await this.prisma.states.findFirst({
        where: {
          id: stateId,
          countryId
        }
      });

      if (!state) {
        return false;
      }

      // Check if city exists and belongs to the state
      const city = await this.prisma.cities.findFirst({
        where: {
          id: cityId,
          stateId,
          countryId
        }
      });

      return Boolean(city);
    } catch (error) {
      throw new Error(`Failed to validate location: ${error.message}`);
    }
  }

  async getRegulatorsByCountry(countryId: number) {
    try {
      // First get the country code from the country ID
      const country = await this.prisma.countries.findUnique({
        where: { id: countryId },
        select: { countryCode: true }
      } as any);

      if (!country) {
        throw new Error(`Country with ID ${countryId} not found`);
      }

      const regulators = await (this.prisma as any).regulators.findMany({
        where: {
          countryCode: country.countryCode,
          isActive: true
        },
        select: {
          id: true,
          name: true,
          abbreviation: true,
          sector: true,
          description: true,
          countryCode: true
        },
        orderBy: [{ sector: 'asc' }, { name: 'asc' }]
      });

      // Add countryId to the response for backward compatibility
      return regulators.map((regulator) => ({
        ...regulator,
        countryId
      }));
    } catch (error) {
      throw new Error(
        `Failed to retrieve regulators for country ${countryId}: ${error.message}`
      );
    }
  }

  async getRegulators(params: { countryId?: number; countryCode?: string }) {
    try {
      const { countryId, countryCode } = params;

      let targetCountryCode: string;
      let targetCountryId: number;

      if (countryId) {
        // Get country code from country ID
        const country = await this.prisma.countries.findUnique({
          where: { id: countryId },
          select: { countryCode: true }
        } as any);

        if (!country) {
          throw new Error(`Country with ID ${countryId} not found`);
        }

        targetCountryCode = country.countryCode;
        targetCountryId = countryId;
      } else if (countryCode) {
        // Get country ID from country code
        const country = await this.prisma.countries.findUnique({
          where: { countryCode },
          select: { id: true }
        } as any);

        if (!country) {
          throw new Error(`Country with code ${countryCode} not found`);
        }

        targetCountryCode = countryCode;
        targetCountryId = country.id;
      } else {
        throw new Error('Either countryId or countryCode must be provided');
      }

      const regulators = await (this.prisma as any).regulators.findMany({
        where: {
          countryCode: targetCountryCode,
          isActive: true
        },
        select: {
          id: true,
          name: true,
          abbreviation: true,
          sector: true,
          description: true,
          countryCode: true
        },
        orderBy: [{ sector: 'asc' }, { name: 'asc' }]
      });

      // Add countryId to the response for consistency
      return regulators.map((regulator) => ({
        ...regulator,
        countryId: targetCountryId
      }));
    } catch (error) {
      const identifier = params.countryId || params.countryCode;
      throw new Error(
        `Failed to retrieve regulators for country ${identifier}: ${error.message}`
      );
    }
  }

  async validateRegulator(
    regulatorId: string,
    countryId: number
  ): Promise<boolean> {
    try {
      // First get the country code from the country ID
      const country = await this.prisma.countries.findUnique({
        where: { id: countryId },
        select: { countryCode: true }
      } as any);

      if (!country) {
        return false;
      }

      const regulator = await (this.prisma as any).regulators.findFirst({
        where: {
          id: regulatorId,
          countryCode: country.countryCode,
          isActive: true
        }
      });

      return Boolean(regulator);
    } catch (error) {
      throw new Error(`Failed to validate regulator: ${error.message}`);
    }
  }
}
