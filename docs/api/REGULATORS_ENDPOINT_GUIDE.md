# Enhanced Regulators Lookup Endpoint Guide

## 🏛️ **Regulators Lookup API**

The regulators endpoint has been enhanced to support both **countryId** and **countryCode** parameters for maximum flexibility.

---

## **Endpoint Details**

### **Base Endpoint**

```http
GET /locations/regulators
```

### **Supported Query Parameters**

You can use **either** (but not both) of the following parameters:

| Parameter     | Type     | Required   | Description               | Example |
| ------------- | -------- | ---------- | ------------------------- | ------- |
| `countryId`   | `number` | Optional\* | Numeric country ID        | `161`   |
| `countryCode` | `string` | Optional\* | ISO 2-letter country code | `"NG"`  |

\*At least one parameter is required

---

## **Usage Examples**

### **1. Using Country ID (Original Method)**

```bash
# Get regulators for Nigeria using country ID
GET /locations/regulators?countryId=161

# Get regulators for United States using country ID
GET /locations/regulators?countryId=1
```

### **2. Using Country Code (New Enhancement)**

```bash
# Get regulators for Nigeria using country code
GET /locations/regulators?countryCode=NG

# Get regulators for United States using country code
GET /locations/regulators?countryCode=US

# Get regulators for United Kingdom using country code
GET /locations/regulators?countryCode=GB
```

---

## **Response Format**

### **Success Response (200 OK)**

```json
{
  "statusCode": 200,
  "message": "Regulators retrieved successfully",
  "data": [
    {
      "id": "ng-cbn",
      "name": "Central Bank of Nigeria",
      "abbreviation": "CBN",
      "sector": "Banking & Finance",
      "description": "Regulates banking and financial institutions in Nigeria",
      "countryId": 161,
      "countryCode": "NG"
    },
    {
      "id": "ng-sec",
      "name": "Securities and Exchange Commission",
      "abbreviation": "SEC",
      "sector": "Capital Markets",
      "description": "Regulates capital market operations in Nigeria",
      "countryId": 161,
      "countryCode": "NG"
    },
    {
      "id": "ng-naicom",
      "name": "National Insurance Commission",
      "abbreviation": "NAICOM",
      "sector": "Insurance",
      "description": "Regulates insurance and reinsurance business in Nigeria",
      "countryId": 161,
      "countryCode": "NG"
    }
  ]
}
```

### **Error Responses**

#### **Bad Request (400) - Missing Parameters**

```json
{
  "statusCode": 400,
  "message": "Either countryId or countryCode must be provided"
}
```

#### **Bad Request (400) - Both Parameters Provided**

```json
{
  "statusCode": 400,
  "message": "Please provide either countryId or countryCode, not both"
}
```

#### **Not Found (500) - Invalid Country**

```json
{
  "statusCode": 500,
  "message": "Failed to retrieve regulators for country XX: Country with code XX not found"
}
```

---

## **Frontend Integration Examples**

### **JavaScript/TypeScript**

#### **Using Fetch API**

```typescript
// Function to get regulators by country code
async function getRegulatorsByCountryCode(countryCode: string) {
  try {
    const response = await fetch(`/api/locations/regulators?countryCode=${countryCode}`);
    const result = await response.json();

    if (result.statusCode === 200) {
      return result.data;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Error fetching regulators:', error);
    throw error;
  }
}

// Function to get regulators by country ID
async function getRegulatorsByCountryId(countryId: number) {
  try {
    const response = await fetch(`/api/locations/regulators?countryId=${countryId}`);
    const result = await response.json();

    if (result.statusCode === 200) {
      return result.data;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Error fetching regulators:', error);
    throw error;
  }
}

// Usage examples
const nigerianRegulators = await getRegulatorsByCountryCode('NG');
const usRegulators = await getRegulatorsByCountryId(1);
```

#### **Using Axios**

```typescript
import axios from 'axios';

// Service class for regulators
class RegulatorsService {
  private baseURL = '/api/locations/regulators';

  async getByCountryCode(countryCode: string) {
    const response = await axios.get(this.baseURL, {
      params: { countryCode: countryCode.toUpperCase() }
    });
    return response.data.data;
  }

  async getByCountryId(countryId: number) {
    const response = await axios.get(this.baseURL, {
      params: { countryId }
    });
    return response.data.data;
  }
}

// Usage
const regulatorsService = new RegulatorsService();
const regulators = await regulatorsService.getByCountryCode('NG');
```

### **React Component Example**

```tsx
import React, { useState, useEffect } from 'react';

interface Regulator {
  id: string;
  name: string;
  abbreviation: string;
  sector: string;
  description: string;
  countryId: number;
  countryCode: string;
}

const RegulatorsDropdown: React.FC<{ countryCode?: string }> = ({ countryCode }) => {
  const [regulators, setRegulators] = useState<Regulator[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (countryCode) {
      fetchRegulators();
    }
  }, [countryCode]);

  const fetchRegulators = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/locations/regulators?countryCode=${countryCode}`);
      const result = await response.json();

      if (result.statusCode === 200) {
        setRegulators(result.data);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Failed to fetch regulators');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading regulators...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <select name="regulatorId" required>
      <option value="">Select a regulator</option>
      {regulators.map((regulator) => (
        <option key={regulator.id} value={regulator.id}>
          {regulator.name} ({regulator.abbreviation})
        </option>
      ))}
    </select>
  );
};

export default RegulatorsDropdown;
```

---

## **Backend Integration Examples**

### **NestJS Service**

```typescript
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class RegulatorsClientService {
  constructor(private readonly httpService: HttpService) {}

  async getRegulatorsByCountryCode(countryCode: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get('/locations/regulators', {
          params: { countryCode: countryCode.toUpperCase() }
        })
      );

      return response.data.data;
    } catch (error) {
      throw new HttpException(
        `Failed to fetch regulators for country ${countryCode}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async getRegulatorsByCountryId(countryId: number) {
    try {
      const response = await firstValueFrom(
        this.httpService.get('/locations/regulators', {
          params: { countryId }
        })
      );

      return response.data.data;
    } catch (error) {
      throw new HttpException(
        `Failed to fetch regulators for country ID ${countryId}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async validateRegulator(regulatorId: string, countryCode: string): Promise<boolean> {
    const regulators = await this.getRegulatorsByCountryCode(countryCode);
    return regulators.some((regulator) => regulator.id === regulatorId);
  }
}
```

---

## **Migration Guide**

### **For Existing Applications**

If you're currently using the `countryId` parameter, **no changes are required**. The endpoint maintains full backward compatibility.

#### **Option 1: Keep Using Country ID (No Changes)**

```typescript
// This continues to work exactly as before
const regulators = await fetch('/api/locations/regulators?countryId=161');
```

#### **Option 2: Migrate to Country Code (Optional)**

```typescript
// Old way
const regulators = await fetch('/api/locations/regulators?countryId=161');

// New way (if you prefer using country codes)
const regulators = await fetch('/api/locations/regulators?countryCode=NG');
```

### **Benefits of Using Country Code**

1. **More Intuitive**: Country codes are human-readable (NG, US, GB)
2. **Consistent**: Aligns with ISO standards
3. **Easier Integration**: No need to map country names to IDs
4. **Better UX**: Can be derived from user location or preferences

---

## **Database Schema**

### **Regulators Table Structure**

```sql
CREATE TABLE regulators (
  id VARCHAR PRIMARY KEY,                    -- e.g., "ng-cbn", "us-sec"
  name VARCHAR NOT NULL,                     -- Full regulator name
  abbreviation VARCHAR,                      -- Short form (CBN, SEC, etc.)
  country_code VARCHAR(2) NOT NULL,          -- ISO country code (NG, US, etc.)
  sector VARCHAR,                            -- Industry sector
  description TEXT,                          -- Detailed description
  is_active BOOLEAN DEFAULT true,            -- Active status
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX regulators_countryCode_idx ON regulators(country_code);
CREATE INDEX regulators_isActive_idx ON regulators(is_active);
```

### **Countries Table Relationship**

```sql
-- The regulators table relates to countries via country_code
ALTER TABLE regulators
ADD FOREIGN KEY (country_code)
REFERENCES countries(country_code)
ON DELETE CASCADE;
```

---

## **Testing Examples**

### **cURL Commands**

```bash
# Test with country code
curl -X GET "http://localhost:5000/locations/regulators?countryCode=NG" \
  -H "Content-Type: application/json"

# Test with country ID
curl -X GET "http://localhost:5000/locations/regulators?countryId=161" \
  -H "Content-Type: application/json"

# Test error case - missing parameters
curl -X GET "http://localhost:5000/locations/regulators" \
  -H "Content-Type: application/json"

# Test error case - both parameters
curl -X GET "http://localhost:5000/locations/regulators?countryId=161&countryCode=NG" \
  -H "Content-Type: application/json"
```

### **Postman Collection**

```json
{
  "name": "Regulators API Tests",
  "requests": [
    {
      "name": "Get Regulators by Country Code",
      "method": "GET",
      "url": "{{baseUrl}}/locations/regulators?countryCode=NG"
    },
    {
      "name": "Get Regulators by Country ID",
      "method": "GET",
      "url": "{{baseUrl}}/locations/regulators?countryId=161"
    },
    {
      "name": "Test Missing Parameters",
      "method": "GET",
      "url": "{{baseUrl}}/locations/regulators"
    }
  ]
}
```

---

## **Performance Considerations**

### **Caching Strategy**

```typescript
// Example Redis caching implementation
class CachedRegulatorsService {
  async getRegulators(countryCode: string) {
    const cacheKey = `regulators:${countryCode}`;

    // Check cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from API
    const regulators = await this.fetchFromAPI(countryCode);

    // Cache for 1 hour
    await redis.setex(cacheKey, 3600, JSON.stringify(regulators));

    return regulators;
  }
}
```

### **Database Optimization**

- **Indexes**: Created on `country_code` and `is_active` for fast queries
- **Query Performance**: Uses single table lookup with proper indexing
- **Response Size**: Only returns active regulators to minimize payload

---

## **API Documentation**

The endpoint is fully documented in Swagger/OpenAPI with:

- ✅ Parameter descriptions and examples
- ✅ Response schemas and examples
- ✅ Error response documentation
- ✅ Usage examples and constraints

Access the interactive API documentation at: `/api-docs`

---

## **Common Country Codes**

| Country        | Code | Country ID | Example Usage     |
| -------------- | ---- | ---------- | ----------------- |
| Nigeria        | `NG` | 161        | `?countryCode=NG` |
| United States  | `US` | 1          | `?countryCode=US` |
| United Kingdom | `GB` | 2          | `?countryCode=GB` |
| Canada         | `CA` | 3          | `?countryCode=CA` |
| Australia      | `AU` | 4          | `?countryCode=AU` |

---

## **Summary**

The enhanced regulators endpoint provides:

✅ **Backward Compatibility**: Existing `countryId` usage continues to work  
✅ **New Flexibility**: Support for `countryCode` parameter  
✅ **Better UX**: Human-readable country codes  
✅ **Comprehensive Validation**: Proper error handling and validation  
✅ **Complete Documentation**: Full Swagger/OpenAPI documentation  
✅ **Performance Optimized**: Efficient database queries with proper indexing

Choose the parameter that best fits your application's needs! 🚀
