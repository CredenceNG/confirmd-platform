# Microservices Integration Guide

## Geo-Location & Organization Services

This guide provides comprehensive information for integrating with the enhanced geo-location and organization microservices in the ConfirmD platform.

## Table of Contents

- [Overview](#overview)
- [Geo-Location Service](#geo-location-service)
- [Organization Service](#organization-service)
- [Service Communication](#service-communication)
- [Docker Deployment](#docker-deployment)
- [API Integration Examples](#api-integration-examples)
- [Error Handling](#error-handling)
- [Testing](#testing)

---

## Overview

The ConfirmD platform uses a microservices architecture with NATS messaging for inter-service communication. This guide covers the enhanced geo-location service and organization service integration patterns.

### Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   API Gateway   │────│   NATS Message   │────│   Client Apps   │
│                 │    │      Broker      │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌────────▼────────┐             │
         │              │                 │             │
         ▼              ▼                 ▼             ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Organization   │ │  Geo-Location   │ │  Other Services │
│    Service      │ │    Service      │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘
         │                       │                       │
         └───────────────────────▼───────────────────────┘
                          PostgreSQL Database
```

---

## Geo-Location Service

The geo-location service provides geographic data management with both ID-based (legacy) and code-based (enhanced) endpoints.

### Service Configuration

- **Port**: Internal microservice communication via NATS
- **Database**: PostgreSQL with geographic data tables
- **Dependencies**: NATS, API Gateway

### Available Endpoints

#### Legacy ID-Based Endpoints

These endpoints maintain backward compatibility:

| Message Pattern     | Description                        | Payload                                | Response             |
| ------------------- | ---------------------------------- | -------------------------------------- | -------------------- |
| `get-all-countries` | Get all countries                  | `{}`                                   | `CountryInterface[]` |
| `get-all-states`    | Get states by country ID           | `{countryId: number}`                  | `StateInterface[]`   |
| `get-all-cities`    | Get cities by state and country ID | `{countryId: number, stateId: number}` | `CityInterface[]`    |

#### Enhanced Code-Based Endpoints

New endpoints using geographic codes for improved usability:

| Message Pattern                | Description                           | Payload                                    | Response             |
| ------------------------------ | ------------------------------------- | ------------------------------------------ | -------------------- |
| `get-all-countries-with-codes` | Get all countries with codes          | `{}`                                       | `CountryInterface[]` |
| `get-states-by-country-code`   | Get states by country code            | `{countryCode: string}`                    | `StateInterface[]`   |
| `get-cities-by-state-code`     | Get cities by state code              | `{stateCode: string}`                      | `CityInterface[]`    |
| `get-cities-by-codes`          | Get cities by country and state codes | `{countryCode: string, stateCode: string}` | `CityInterface[]`    |

#### Validation Endpoints

For data validation and lookups:

| Message Pattern       | Description           | Payload                 | Response                   |
| --------------------- | --------------------- | ----------------------- | -------------------------- |
| `get-country-by-code` | Validate country code | `{countryCode: string}` | `CountryInterface \| null` |
| `get-state-by-code`   | Validate state code   | `{stateCode: string}`   | `StateInterface \| null`   |
| `get-city-by-code`    | Validate city code    | `{cityCode: string}`    | `CityInterface \| null`    |

### Data Interfaces

```typescript
interface CountryInterface {
  id: number;
  name: string;
  countryCode: string;
}

interface StateInterface {
  id: number;
  name: string;
  countryId: number;
  countryCode: string;
  stateCode: string;
}

interface CityInterface {
  id: number;
  name: string;
  stateId: number;
  stateCode: string;
  countryId: number;
  countryCode: string;
  cityCode: string;
}
```

---

## Organization Service

The organization service handles organization registration and management with enhanced geographic data integration.

### Service Configuration

- **Port**: Internal microservice communication via NATS
- **Database**: PostgreSQL with organization data
- **Dependencies**: NATS, API Gateway, User Service, Connection Service, Issuance Service, Ledger Service

### Key Features

- Organization registration with geographic data
- Integration with geo-location service for address validation
- Support for both ID-based and code-based geographic references

---

## Service Communication

### NATS Message Patterns

#### From Client to Geo-Location Service

```typescript
// Get states by country code
const states = await this.natsClient.send({ cmd: 'get-states-by-country-code' }, { countryCode: 'US' }).toPromise();

// Get cities by state code
const cities = await this.natsClient.send({ cmd: 'get-cities-by-state-code' }, { stateCode: 'CA' }).toPromise();

// Validate geographic codes
const country = await this.natsClient.send({ cmd: 'get-country-by-code' }, { countryCode: 'US' }).toPromise();
```

#### From Organization Service to Geo-Location Service

```typescript
// Example: Validate organization address during registration
async validateOrganizationAddress(countryCode: string, stateCode: string, cityCode: string) {
  // Validate country
  const country = await this.natsClient.send(
    { cmd: 'get-country-by-code' },
    { countryCode }
  ).toPromise();

  if (!country) {
    throw new BadRequestException('Invalid country code');
  }

  // Validate state
  const state = await this.natsClient.send(
    { cmd: 'get-state-by-code' },
    { stateCode }
  ).toPromise();

  if (!state || state.countryCode !== countryCode) {
    throw new BadRequestException('Invalid state code for the specified country');
  }

  // Validate city
  const city = await this.natsClient.send(
    { cmd: 'get-city-by-code' },
    { cityCode }
  ).toPromise();

  if (!city || city.stateCode !== stateCode || city.countryCode !== countryCode) {
    throw new BadRequestException('Invalid city code for the specified state and country');
  }

  return { country, state, city };
}
```

---

## Docker Deployment

### Building Services

```bash
# Build both services
docker-compose -f docker-compose-dev.yml build geolocation organization

# Build individual services
docker-compose -f docker-compose-dev.yml build geolocation
docker-compose -f docker-compose-dev.yml build organization
```

### Running Services

```bash
# Start all services
docker-compose -f docker-compose-dev.yml up -d

# Start specific services
docker-compose -f docker-compose-dev.yml up -d geolocation organization

# Restart services after code changes
docker-compose -f docker-compose-dev.yml restart geolocation organization
```

### Service Dependencies

The organization service depends on:

- NATS message broker
- API Gateway
- User Service
- Connection Service
- Issuance Service
- Ledger Service

The geo-location service depends on:

- NATS message broker
- API Gateway

### Environment Configuration

Both services use the shared `.env` file for configuration:

```env
# Database
DATABASE_URL=postgresql://username:password@postgres:5432/database_name

# NATS
NATS_URL=nats://nats:4222

# Other service-specific configurations...
```

---

## API Integration Examples

## Frontend Client API Endpoints

## Frontend Client API Endpoints

### Available Geo-Location REST Endpoints

The following endpoints are exposed through the API Gateway for frontend consumption:

#### ID-Based Endpoints (Legacy/Compatibility)

| Method | Endpoint                                       | Description                                | Response             |
| ------ | ---------------------------------------------- | ------------------------------------------ | -------------------- |
| `GET`  | `/countries`                                   | Get all countries (includes country codes) | `CountryInterface[]` |
| `GET`  | `/countries/:countryId/states`                 | Get states by country ID                   | `StateInterface[]`   |
| `GET`  | `/countries/:countryId/states/:stateId/cities` | Get cities by country and state ID         | `CityInterface[]`    |

#### Code-Based Endpoints (Enhanced)

| Method | Endpoint                                              | Description                                         | Response             |
| ------ | ----------------------------------------------------- | --------------------------------------------------- | -------------------- |
| `GET`  | `/countries-with-codes`                               | Get all countries with codes (alternative endpoint) | `CountryInterface[]` |
| `GET`  | `/country-code/:countryCode/states`                   | Get states by country code (e.g., "NG")             | `StateInterface[]`   |
| `GET`  | `/states/:stateCode/cities`                           | Get cities by state code (e.g., "LA")               | `CityInterface[]`    |
| `GET`  | `/country-code/:countryCode/states/:stateCode/cities` | Get cities by country and state codes               | `CityInterface[]`    |

#### Validation Endpoints

| Method | Endpoint                         | Description           | Response                   |
| ------ | -------------------------------- | --------------------- | -------------------------- |
| `GET`  | `/validate/country/:countryCode` | Validate country code | `CountryInterface \| null` |
| `GET`  | `/validate/state/:stateCode`     | Validate state code   | `StateInterface \| null`   |
| `GET`  | `/validate/city/:cityCode`       | Validate city code    | `CityInterface \| null`    |

#### Location Service Endpoints (Alternative API)

| Method | Endpoint                                                 | Description                                | Response               |
| ------ | -------------------------------------------------------- | ------------------------------------------ | ---------------------- |
| `GET`  | `/locations/countries`                                   | Get countries                              | `CountryInterface[]`   |
| `GET`  | `/locations/states?countryId=X`                          | Get states by country ID                   | `StateInterface[]`     |
| `GET`  | `/locations/cities?stateId=X`                            | Get cities by state ID                     | `CityInterface[]`      |
| `GET`  | `/locations/regulators?countryId=X` OR `?countryCode=NG` | Get regulators (supports both ID and code) | `RegulatorInterface[]` |

### Frontend Integration (React/Angular)

#### Country, State, City Dropdowns

`````typescript
// GeographicService.ts
class GeographicService {
  // Primary endpoint - includes country codes in response
  async getCountries(): Promise<CountryInterface[]> {
    return this.http.get<CountryInterface[]>('/countries').toPromise();
  }

  // Alternative endpoint (newly added)
  async getCountriesWithCodes(): Promise<CountryInterface[]> {
    return this.http.get<CountryInterface[]>('/countries-with-codes').toPromise();
  }

  // ID-based navigation (legacy)
  async getStatesByCountryId(countryId: number): Promise<StateInterface[]> {
    return this.http.get<StateInterface[]>(`/countries/${countryId}/states`).toPromise();
  }

  async getCitiesByCountryAndStateId(countryId: number, stateId: number): Promise<CityInterface[]> {
    return this.http.get<CityInterface[]>(`/countries/${countryId}/states/${stateId}/cities`).toPromise();
  }

  // CODE-BASED navigation (enhanced)
  async getStatesByCountryCode(countryCode: string): Promise<StateInterface[]> {
    return this.http.get<StateInterface[]>(`/country-code/${countryCode}/states`).toPromise();
  }

  async getCitiesByStateCode(stateCode: string): Promise<CityInterface[]> {
    return this.http.get<CityInterface[]>(`/states/${stateCode}/cities`).toPromise();
  }

  async getCitiesByCountryAndStateCode(countryCode: string, stateCode: string): Promise<CityInterface[]> {
    return this.http.get<CityInterface[]>(`/country-code/${countryCode}/states/${stateCode}/cities`).toPromise();
  }

  // Validation methods
  async validateCountryCode(countryCode: string): Promise<CountryInterface | null> {
    return this.http.get<CountryInterface | null>(`/validate/country/${countryCode}`).toPromise();
  }

  async validateStateCode(stateCode: string): Promise<StateInterface | null> {
    return this.http.get<StateInterface | null>(`/validate/state/${stateCode}`).toPromise();
  }

  async validateCityCode(cityCode: string): Promise<CityInterface | null> {
    return this.http.get<CityInterface | null>(`/validate/city/${cityCode}`).toPromise();
  }
}

### Frontend Integration (React/Angular)

#### Country, State, City Dropdowns

````typescript
// GeographicService.ts
class GeographicService {
  // Primary endpoint - includes country codes in response
  async getCountries(): Promise<CountryInterface[]> {
    return this.http.get<CountryInterface[]>('/countries').toPromise();
  }

  // Alternative endpoint (newly added)
  async getCountriesWithCodes(): Promise<CountryInterface[]> {
    return this.http.get<CountryInterface[]>('/countries-with-codes').toPromise();
  }

  // Get states by country ID (numeric)
  async getStatesByCountryId(countryId: number): Promise<StateInterface[]> {
    return this.http.get<StateInterface[]>(`/countries/${countryId}/states`).toPromise();
  }

  // Get cities by country and state ID (numeric)
  async getCitiesByCountryAndStateId(countryId: number, stateId: number): Promise<CityInterface[]> {
    return this.http.get<CityInterface[]>(`/countries/${countryId}/states/${stateId}/cities`).toPromise();
  }
}

// Component usage - ID-based approach (existing approach)
class OrganizationRegistrationComponent {
  countries: CountryInterface[] = [];
  states: StateInterface[] = [];
  cities: CityInterface[] = [];
  selectedCountryId: number;
  selectedStateId: number;

  async ngOnInit() {
    // Load countries (both endpoints work, but /countries is the main one)
    this.countries = await this.geoService.getCountries();
  }

  async onCountryChange(countryId: number) {
    this.selectedCountryId = countryId;
    this.states = await this.geoService.getStatesByCountryId(countryId);
    this.cities = []; // Clear cities when country changes
  }

  async onStateChange(stateId: number) {
    this.selectedStateId = stateId;
    this.cities = await this.geoService.getCitiesByCountryAndStateId(this.selectedCountryId, stateId);
  }
}

// Component usage - CODE-based approach (enhanced approach)
class EnhancedOrganizationRegistrationComponent {
  countries: CountryInterface[] = [];
  states: StateInterface[] = [];
  cities: CityInterface[] = [];
  selectedCountryCode: string;
  selectedStateCode: string;

  async ngOnInit() {
    // Load countries with codes
    this.countries = await this.geoService.getCountriesWithCodes();
  }

  async onCountryChange(countryCode: string) {
    this.selectedCountryCode = countryCode;
    this.states = await this.geoService.getStatesByCountryCode(countryCode);
    this.cities = []; // Clear cities when country changes
  }

  async onStateChange(stateCode: string) {
    this.selectedStateCode = stateCode;
    this.cities = await this.geoService.getCitiesByStateCode(stateCode);
    // Alternative: get cities by both codes for extra validation
    // this.cities = await this.geoService.getCitiesByCountryAndStateCode(this.selectedCountryCode, stateCode);
  }

  // Validation during form submission
  async validateSelection() {
    const isCountryValid = await this.geoService.validateCountryCode(this.selectedCountryCode);
    const isStateValid = await this.geoService.validateStateCode(this.selectedStateCode);

    if (!isCountryValid || !isStateValid) {
      throw new Error('Invalid geographic selection');
    }
  }
}

### Response Format

All endpoints return data in the following format:

```typescript
// Response wrapper
interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
}

// Example response for /countries
{
  "statusCode": 200,
  "message": "Countries fetched successfully",
  "data": [
    {
      "id": 1,
      "name": "United States",
      "countryCode": "US",
      "phonecode": "+1",
      "capital": "Washington"
    },
    {
      "id": 2,
      "name": "Nigeria",
      "countryCode": "NG",
      "phonecode": "+234",
      "capital": "Abuja"
    }
  ]
}
`````

### Important Notes for Frontend Developers

1. **Dual Approach Available**: You can now use either ID-based or code-based navigation:
   - **ID-based** (numeric IDs): Traditional approach, maintains backward compatibility
   - **Code-based** (string codes): Enhanced approach, more user-friendly and internationally standardized

2. **Country Codes Available**: All endpoints return country codes (`countryCode`), state codes (`stateCode`), and city codes (`cityCode`)

3. **Choose Your Navigation Style**:
   - **ID-based**: Store numeric IDs, navigate using `/countries/{id}/states`, `/countries/{id}/states/{id}/cities`
   - **Code-based**: Store string codes, navigate using `/countries/{code}/states`, `/states/{code}/cities`

4. **Validation Endpoints**: Use validation endpoints to verify codes before submitting forms

5. **Authentication**: These geo-location endpoints are public and don't require authentication

6. **Alternative Location API**: The `/locations/*` endpoints provide an alternative API with query parameters

7. **Error Handling**: All endpoints return standardized error responses:
   ```typescript
   {
     "statusCode": 400|404|500,
     "message": "Error description",
     "data": null
   }
   ```

````

#### Organization Registration with Validation

```typescript
// OrganizationService.ts
class OrganizationService {
  async registerOrganization(organizationData: {
    name: string;
    countryCode: string;
    stateCode: string;
    cityCode: string;
    address: string;
    // ... other fields
  }) {
    // Client-side validation (optional)
    await this.validateGeographicCodes(
      organizationData.countryCode,
      organizationData.stateCode,
      organizationData.cityCode
    );

    // Submit registration
    return this.http.post('/api/organizations/register', organizationData).toPromise();
  }

  private async validateGeographicCodes(countryCode: string, stateCode: string, cityCode: string) {
    // Validate country
    const country = await this.http.get(`/api/geo/validate/country/${countryCode}`).toPromise();
    if (!country) {
      throw new Error('Invalid country code');
    }

    // Validate state
    const state = await this.http.get(`/api/geo/validate/state/${stateCode}`).toPromise();
    if (!state) {
      throw new Error('Invalid state code');
    }

    // Validate city
    const city = await this.http.get(`/api/geo/validate/city/${cityCode}`).toPromise();
    if (!city) {
      throw new Error('Invalid city code');
    }
  }
}
````

### Backend Service Integration

#### NestJS Client Service

```typescript
// GeolocationClientService.ts
@Injectable()
export class GeolocationClientService {
  constructor(@Inject('NATS_SERVICE') private readonly natsClient: ClientProxy) {}

  async getCountriesWithCodes(): Promise<CountryInterface[]> {
    return this.natsClient.send({ cmd: 'get-all-countries-with-codes' }, {}).toPromise();
  }

  async getStatesByCountryCode(countryCode: string): Promise<StateInterface[]> {
    return this.natsClient.send({ cmd: 'get-states-by-country-code' }, { countryCode }).toPromise();
  }

  async validateGeographicCodes(countryCode: string, stateCode: string, cityCode: string) {
    const [country, state, city] = await Promise.all([
      this.natsClient.send({ cmd: 'get-country-by-code' }, { countryCode }).toPromise(),
      this.natsClient.send({ cmd: 'get-state-by-code' }, { stateCode }).toPromise(),
      this.natsClient.send({ cmd: 'get-city-by-code' }, { cityCode }).toPromise()
    ]);

    if (!country) {
      throw new BadRequestException('Invalid country code');
    }
    if (!state || state.countryCode !== countryCode) {
      throw new BadRequestException('Invalid state code for the specified country');
    }
    if (!city || city.stateCode !== stateCode || city.countryCode !== countryCode) {
      throw new BadRequestException('Invalid city code for the specified state and country');
    }

    return { country, state, city };
  }
}
```

---

## Error Handling

### Common Error Scenarios

#### Geo-Location Service Errors

```typescript
// Error types and handling
try {
  const states = await this.geolocationClient.getStatesByCountryCode('INVALID');
} catch (error) {
  if (error.message.includes('Invalid country code')) {
    // Handle invalid country code
  } else if (error.message.includes('Database connection')) {
    // Handle database connectivity issues
  } else {
    // Handle generic errors
  }
}
```

#### Organization Service Errors

```typescript
// Registration validation errors
try {
  await this.organizationService.register(orgData);
} catch (error) {
  switch (error.statusCode) {
    case 400:
      // Bad request - validation errors
      console.error('Validation errors:', error.message);
      break;
    case 409:
      // Conflict - organization already exists
      console.error('Organization already exists');
      break;
    case 500:
      // Internal server error
      console.error('Server error during registration');
      break;
  }
}
```

### Retry Logic

```typescript
// Implement retry logic for service communication
async function withRetry<T>(operation: () => Promise<T>, maxRetries: number = 3, delay: number = 1000): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
    }
  }
  throw new Error('Max retries exceeded');
}

// Usage
const states = await withRetry(() => this.geolocationClient.getStatesByCountryCode('US'));
```

---

## Testing

### Unit Tests

#### Geo-Location Service Tests

```typescript
// geolocation.service.spec.ts
describe('GeolocationService', () => {
  let service: GeolocationService;
  let repository: jest.Mocked<GeolocationRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        GeolocationService,
        {
          provide: GeolocationRepository,
          useValue: {
            findStatesByCountryCode: jest.fn(),
            findCountryByCode: jest.fn()
          }
        }
      ]
    }).compile();

    service = module.get<GeolocationService>(GeolocationService);
    repository = module.get(GeolocationRepository);
  });

  it('should get states by country code', async () => {
    const mockStates = [{ id: 1, name: 'California', countryCode: 'US', stateCode: 'CA' }];
    repository.findStatesByCountryCode.mockResolvedValue(mockStates);

    const result = await service.getStatesByCountryCode('US');

    expect(repository.findStatesByCountryCode).toHaveBeenCalledWith('US');
    expect(result).toEqual(mockStates);
  });
});
```

#### Organization Service Tests

```typescript
// organization.service.spec.ts
describe('OrganizationService', () => {
  let service: OrganizationService;
  let geolocationClient: jest.Mocked<any>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OrganizationService,
        {
          provide: 'GEOLOCATION_CLIENT',
          useValue: {
            send: jest.fn()
          }
        }
      ]
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
    geolocationClient = module.get('GEOLOCATION_CLIENT');
  });

  it('should validate organization address', async () => {
    const mockCountry = { id: 1, name: 'United States', countryCode: 'US' };
    const mockState = { id: 1, name: 'California', countryCode: 'US', stateCode: 'CA' };
    const mockCity = { id: 1, name: 'Los Angeles', countryCode: 'US', stateCode: 'CA', cityCode: 'LA' };

    geolocationClient.send
      .mockReturnValueOnce(of(mockCountry))
      .mockReturnValueOnce(of(mockState))
      .mockReturnValueOnce(of(mockCity));

    const result = await service.validateOrganizationAddress('US', 'CA', 'LA');

    expect(result).toEqual({ country: mockCountry, state: mockState, city: mockCity });
  });
});
```

### Integration Tests

#### Docker Compose Test Environment

```bash
# Run integration tests with Docker
docker-compose -f docker-compose-test.yml up --build --abort-on-container-exit
```

#### E2E API Tests

```typescript
// e2e/geolocation.e2e-spec.ts
describe('Geolocation API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/geo/countries (GET)', () => {
    return request(app.getHttpServer())
      .get('/geo/countries')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
        expect(res.body[0]).toHaveProperty('countryCode');
      });
  });

  it('/geo/states/:countryCode (GET)', () => {
    return request(app.getHttpServer())
      .get('/geo/states/US')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
        if (res.body.length > 0) {
          expect(res.body[0]).toHaveProperty('stateCode');
          expect(res.body[0].countryCode).toBe('US');
        }
      });
  });
});
```

---

## Performance Considerations

### Caching Strategies

```typescript
// Implement Redis caching for frequently accessed data
@Injectable()
export class GeolocationCacheService {
  constructor(
    private readonly redisService: RedisService,
    private readonly geolocationService: GeolocationService
  ) {}

  async getCountriesWithCache(): Promise<CountryInterface[]> {
    const cacheKey = 'geo:countries';
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const countries = await this.geolocationService.getAllCountriesWithCodes();
    await this.redisService.setex(cacheKey, 3600, JSON.stringify(countries)); // Cache for 1 hour

    return countries;
  }
}
```

### Database Optimization

- Add indexes on frequently queried fields (countryCode, stateCode, cityCode)
- Consider read replicas for geo-location queries
- Implement connection pooling

### Monitoring and Logging

```typescript
// Add performance monitoring
@Injectable()
export class GeolocationService {
  private readonly logger = new Logger(GeolocationService.name);

  async getStatesByCountryCode(countryCode: string): Promise<StateInterface[]> {
    const start = Date.now();
    try {
      const result = await this.repository.findStatesByCountryCode(countryCode);
      const duration = Date.now() - start;
      this.logger.log(`getStatesByCountryCode completed in ${duration}ms for country: ${countryCode}`);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.logger.error(`getStatesByCountryCode failed after ${duration}ms for country: ${countryCode}`, error);
      throw error;
    }
  }
}
```

---

## Troubleshooting

### Common Issues

1. **Service Discovery Issues**
   - Verify NATS connection
   - Check service registration
   - Ensure proper message patterns

2. **Database Connection Problems**
   - Verify PostgreSQL connection string
   - Check database migrations
   - Ensure proper schema setup

3. **Geographic Data Inconsistencies**
   - Validate data integrity
   - Check for missing relationships
   - Verify code uniqueness

### Debugging Commands

```bash
# Check service logs
docker-compose -f docker-compose-dev.yml logs geolocation
docker-compose -f docker-compose-dev.yml logs organization

# Check service status
docker-compose -f docker-compose-dev.yml ps

# Access service containers
docker-compose -f docker-compose-dev.yml exec geolocation sh
docker-compose -f docker-compose-dev.yml exec organization sh

# Monitor NATS messages
nats sub ">"
```

---

## Conclusion

This integration guide provides comprehensive information for working with the enhanced geo-location and organization microservices. The code-based geographic system improves usability while maintaining backward compatibility with the existing ID-based system.

For additional support or questions, refer to the individual service documentation or contact the development team.
