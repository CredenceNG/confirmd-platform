# Ecosystem API - Frontend Developer Guide

## Overview
This guide provides comprehensive documentation for frontend developers to integrate with the Ecosystem API endpoints. The Ecosystem feature allows platform administrators to create and manage ecosystems where multiple organizations can collaborate with defined roles, schemas, and pricing.

## Base URL
```
https://api.confamd.com
```
or for local development:
```
http://localhost:5000
```

## Authentication
All endpoints (except GET endpoints) require JWT Bearer token authentication.

```javascript
headers: {
  'Authorization': 'Bearer YOUR_JWT_TOKEN',
  'Content-Type': 'application/json'
}
```

---

## Endpoints

### 1. Create Ecosystem
Create a new ecosystem with name, logo, and description.

**Endpoint:** `POST /ecosystem`

**Authentication:** Required (Bearer Token)

**Request Body:**
```json
{
  "name": "Healthcare Ecosystem",
  "logo": "https://example.com/logo.png",
  "description": "A collaborative ecosystem for healthcare credentials"
}
```

**Response:** `201 Created`
```json
{
  "statusCode": 201,
  "message": "Ecosystem created successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Healthcare Ecosystem",
    "logo": "https://example.com/logo.png",
    "description": "A collaborative ecosystem for healthcare credentials",
    "createdBy": "user-id",
    "lastChangedBy": "user-id",
    "createDateTime": "2025-11-04T10:30:00.000Z",
    "lastChangedDateTime": "2025-11-04T10:30:00.000Z",
    "deletedAt": null
  }
}
```

**Example (JavaScript/Fetch):**
```javascript
async function createEcosystem(token, ecosystemData) {
  const response = await fetch('https://api.confamd.com/ecosystem', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(ecosystemData)
  });

  return await response.json();
}

// Usage
const newEcosystem = await createEcosystem(userToken, {
  name: "Healthcare Ecosystem",
  logo: "https://example.com/logo.png",
  description: "A collaborative ecosystem for healthcare credentials"
});
```

**Example (Axios):**
```javascript
import axios from 'axios';

const createEcosystem = async (token, ecosystemData) => {
  try {
    const response = await axios.post(
      'https://api.confamd.com/ecosystem',
      ecosystemData,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error creating ecosystem:', error.response?.data);
    throw error;
  }
};
```

---

### 2. Get All Ecosystems
Retrieve a paginated list of all ecosystems.

**Endpoint:** `GET /ecosystem`

**Authentication:** Optional (Public endpoint)

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| pageNumber | number | No | 1 | Page number for pagination |
| pageSize | number | No | 10 | Number of items per page |
| search | string | No | "" | Search term for filtering |

**Response:** `200 OK`
```json
{
  "statusCode": 200,
  "message": "Ecosystems retrieved successfully",
  "data": {
    "ecosystems": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Healthcare Ecosystem",
        "logo": "https://example.com/logo.png",
        "description": "A collaborative ecosystem for healthcare credentials",
        "createDateTime": "2025-11-04T10:30:00.000Z",
        "organizations": [
          {
            "id": "org-ecosystem-id",
            "ecosystemRole": ["ECOSYSTEM_ISSUER"],
            "organisation": {
              "id": "org-id",
              "name": "Hospital ABC",
              "logoUrl": "https://example.com/hospital-logo.png"
            }
          }
        ]
      }
    ],
    "totalCount": 25,
    "totalPages": 3
  }
}
```

**Example:**
```javascript
async function getAllEcosystems(pageNumber = 1, pageSize = 10, search = '') {
  const params = new URLSearchParams({
    pageNumber: pageNumber.toString(),
    pageSize: pageSize.toString(),
    search
  });

  const response = await fetch(
    `https://api.confamd.com/ecosystem?${params}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );

  return await response.json();
}

// Usage with pagination
const ecosystems = await getAllEcosystems(1, 20, 'healthcare');
```

---

### 3. Get Ecosystem by ID
Retrieve detailed information about a specific ecosystem.

**Endpoint:** `GET /ecosystem/:id`

**Authentication:** Optional (Public endpoint)

**Path Parameters:**
- `id` (UUID) - The ecosystem ID

**Response:** `200 OK`
```json
{
  "statusCode": 200,
  "message": "Ecosystem retrieved successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Healthcare Ecosystem",
    "logo": "https://example.com/logo.png",
    "description": "A collaborative ecosystem for healthcare credentials",
    "createDateTime": "2025-11-04T10:30:00.000Z",
    "organizations": [
      {
        "id": "org-ecosystem-id",
        "ecosystemRole": ["ECOSYSTEM_ISSUER", "ECOSYSTEM_VERIFIER"],
        "createDateTime": "2025-11-04T10:35:00.000Z",
        "organisation": {
          "id": "org-id",
          "name": "Hospital ABC",
          "description": "Leading healthcare provider",
          "logoUrl": "https://example.com/hospital-logo.png",
          "website": "https://hospitalabc.com"
        }
      }
    ],
    "schemas": [
      {
        "id": "schema-id",
        "schemaLedgerId": "did:indy:sovrin:123/schema/medical-license/1.0",
        "issuancePrice": 10.00,
        "verificationPrice": 5.00,
        "revocationPrice": 2.00,
        "currency": "USD",
        "issuancePlatformShare": 10,
        "issuanceEcosystemShare": 5,
        "issuanceIssuerShare": 85,
        "verificationPlatformShare": 10,
        "verificationEcosystemShare": 5,
        "verificationVerifierShare": 85,
        "revocationPlatformShare": 10,
        "revocationEcosystemShare": 5,
        "revocationIssuerShare": 85,
        "createDateTime": "2025-11-04T10:40:00.000Z"
      }
    ],
    "invitations": [
      {
        "id": "invitation-id",
        "email": "user@example.com",
        "ecosystemRole": ["ECOSYSTEM_MEMBER"],
        "status": "PENDING",
        "createDateTime": "2025-11-04T10:45:00.000Z"
      }
    ]
  }
}
```

**Example:**
```javascript
async function getEcosystemById(ecosystemId) {
  const response = await fetch(
    `https://api.confamd.com/ecosystem/${ecosystemId}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}

// Usage
const ecosystem = await getEcosystemById('550e8400-e29b-41d4-a716-446655440000');
```

---

### 4. Update Ecosystem
Update ecosystem information (name, logo, description).

**Endpoint:** `PUT /ecosystem/:id`

**Authentication:** Required (Bearer Token)

**Path Parameters:**
- `id` (UUID) - The ecosystem ID

**Request Body:**
```json
{
  "name": "Updated Healthcare Ecosystem",
  "logo": "https://example.com/new-logo.png",
  "description": "Updated description"
}
```

**Note:** All fields are optional. Only include fields you want to update.

**Response:** `200 OK`
```json
{
  "statusCode": 200,
  "message": "Ecosystem updated successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Updated Healthcare Ecosystem",
    "logo": "https://example.com/new-logo.png",
    "description": "Updated description",
    "lastChangedDateTime": "2025-11-04T11:00:00.000Z"
  }
}
```

**Example:**
```javascript
async function updateEcosystem(token, ecosystemId, updates) {
  const response = await fetch(
    `https://api.confamd.com/ecosystem/${ecosystemId}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    }
  );

  return await response.json();
}

// Usage - Update only the name
const updated = await updateEcosystem(
  userToken,
  '550e8400-e29b-41d4-a716-446655440000',
  { name: "New Ecosystem Name" }
);
```

---

### 5. Delete Ecosystem
Soft delete an ecosystem (marks as deleted, doesn't remove from database).

**Endpoint:** `DELETE /ecosystem/:id`

**Authentication:** Required (Bearer Token)

**Path Parameters:**
- `id` (UUID) - The ecosystem ID

**Response:** `200 OK`
```json
{
  "statusCode": 200,
  "message": "Ecosystem deleted successfully",
  "data": null
}
```

**Example:**
```javascript
async function deleteEcosystem(token, ecosystemId) {
  const response = await fetch(
    `https://api.confamd.com/ecosystem/${ecosystemId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );

  return await response.json();
}

// Usage
await deleteEcosystem(userToken, '550e8400-e29b-41d4-a716-446655440000');
```

---

### 6. Add Organization to Ecosystem
Add an organization to the ecosystem with specific roles.

**Endpoint:** `POST /ecosystem/:id/organizations`

**Authentication:** Required (Bearer Token)

**Path Parameters:**
- `id` (UUID) - The ecosystem ID

**Request Body:**
```json
{
  "orgId": "organization-uuid",
  "ecosystemRole": ["ECOSYSTEM_ISSUER", "ECOSYSTEM_VERIFIER"]
}
```

**Ecosystem Roles:**
- `ECOSYSTEM_LEAD` - Leadership role with full permissions
- `ECOSYSTEM_MEMBER` - Basic membership
- `ECOSYSTEM_ISSUER` - Can issue credentials
- `ECOSYSTEM_VERIFIER` - Can verify credentials

**Response:** `201 Created`
```json
{
  "statusCode": 201,
  "message": "Organization added to ecosystem successfully",
  "data": {
    "id": "ecosystem-org-id",
    "ecosystemId": "550e8400-e29b-41d4-a716-446655440000",
    "orgId": "organization-uuid",
    "ecosystemRole": ["ECOSYSTEM_ISSUER", "ECOSYSTEM_VERIFIER"],
    "createDateTime": "2025-11-04T11:00:00.000Z",
    "createdBy": "user-id"
  }
}
```

**Example:**
```javascript
async function addOrganizationToEcosystem(token, ecosystemId, orgData) {
  const response = await fetch(
    `https://api.confamd.com/ecosystem/${ecosystemId}/organizations`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orgData)
    }
  );

  return await response.json();
}

// Usage
const result = await addOrganizationToEcosystem(
  userToken,
  '550e8400-e29b-41d4-a716-446655440000',
  {
    orgId: 'org-uuid-123',
    ecosystemRole: ['ECOSYSTEM_ISSUER', 'ECOSYSTEM_VERIFIER']
  }
);
```

---

### 7. Get Ecosystem Organizations
Retrieve all organizations in an ecosystem with pagination.

**Endpoint:** `GET /ecosystem/:id/organizations`

**Authentication:** Optional (Public endpoint)

**Path Parameters:**
- `id` (UUID) - The ecosystem ID

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| pageNumber | number | No | 1 | Page number for pagination |
| pageSize | number | No | 10 | Number of items per page |
| search | string | No | "" | Search by organization name |

**Response:** `200 OK`
```json
{
  "statusCode": 200,
  "message": "Organizations retrieved successfully",
  "data": {
    "organizations": [
      {
        "id": "ecosystem-org-id",
        "ecosystemRole": ["ECOSYSTEM_ISSUER"],
        "createDateTime": "2025-11-04T10:00:00.000Z",
        "organisation": {
          "id": "org-id",
          "name": "Hospital ABC",
          "description": "Leading healthcare provider",
          "logoUrl": "https://example.com/logo.png",
          "website": "https://hospitalabc.com"
        }
      }
    ],
    "totalCount": 15
  }
}
```

**Example:**
```javascript
async function getEcosystemOrganizations(ecosystemId, pageNumber = 1, pageSize = 10, search = '') {
  const params = new URLSearchParams({
    pageNumber: pageNumber.toString(),
    pageSize: pageSize.toString(),
    search
  });

  const response = await fetch(
    `https://api.confamd.com/ecosystem/${ecosystemId}/organizations?${params}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );

  return await response.json();
}

// Usage
const orgs = await getEcosystemOrganizations(
  '550e8400-e29b-41d4-a716-446655440000',
  1,
  20,
  'hospital'
);
```

---

### 8. Remove Organization from Ecosystem
Remove an organization from the ecosystem.

**Endpoint:** `DELETE /ecosystem/:id/organizations/:orgId`

**Authentication:** Required (Bearer Token)

**Path Parameters:**
- `id` (UUID) - The ecosystem ID
- `orgId` (UUID) - The organization ID

**Response:** `200 OK`
```json
{
  "statusCode": 200,
  "message": "Organization removed from ecosystem successfully",
  "data": null
}
```

**Example:**
```javascript
async function removeOrganizationFromEcosystem(token, ecosystemId, orgId) {
  const response = await fetch(
    `https://api.confamd.com/ecosystem/${ecosystemId}/organizations/${orgId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );

  return await response.json();
}

// Usage
await removeOrganizationFromEcosystem(
  userToken,
  '550e8400-e29b-41d4-a716-446655440000',
  'org-uuid-123'
);
```

---

### 9. Add Schema to Ecosystem
Add a schema to the ecosystem with comprehensive pricing and revenue sharing configuration.

**Endpoint:** `POST /ecosystem/:id/schemas`

**Authentication:** Required (Bearer Token)

**Path Parameters:**
- `id` (UUID) - The ecosystem ID

**Request Body:**
```json
{
  "schemaLedgerId": "did:indy:sovrin:123/schema/medical-license/1.0",
  "issuancePrice": 10.00,
  "verificationPrice": 5.00,
  "revocationPrice": 2.00,
  "currency": "USD",
  "issuancePlatformShare": 10,
  "issuanceEcosystemShare": 5,
  "issuanceIssuerShare": 85,
  "verificationPlatformShare": 10,
  "verificationEcosystemShare": 5,
  "verificationVerifierShare": 85,
  "revocationPlatformShare": 10,
  "revocationEcosystemShare": 5,
  "revocationIssuerShare": 85
}
```

**Field Descriptions:**

**Pricing:**
- `schemaLedgerId` - The ledger ID of the schema
- `issuancePrice` - Price charged for issuing a credential
- `verificationPrice` - Price charged for verifying a credential
- `revocationPrice` - Price charged for revoking a credential
- `currency` - Currency code (e.g., "USD", "EUR")

**Revenue Sharing (must total 100% for each operation):**
- `issuancePlatformShare` - Platform's share of issuance revenue (%)
- `issuanceEcosystemShare` - Ecosystem's share of issuance revenue (%)
- `issuanceIssuerShare` - Issuer's share of issuance revenue (%)
- `verificationPlatformShare` - Platform's share of verification revenue (%)
- `verificationEcosystemShare` - Ecosystem's share of verification revenue (%)
- `verificationVerifierShare` - Verifier's share of verification revenue (%)
- `revocationPlatformShare` - Platform's share of revocation revenue (%)
- `revocationEcosystemShare` - Ecosystem's share of revocation revenue (%)
- `revocationIssuerShare` - Issuer's share of revocation revenue (%)

**Validation Rules:**
- All prices must be non-negative
- All percentage shares must be between 0-100
- For each operation (issuance/verification/revocation), the three shares must total exactly 100%

**Response:** `201 Created`
```json
{
  "statusCode": 201,
  "message": "Schema added to ecosystem successfully",
  "data": {
    "id": "schema-ecosystem-id",
    "ecosystemId": "550e8400-e29b-41d4-a716-446655440000",
    "schemaLedgerId": "did:indy:sovrin:123/schema/medical-license/1.0",
    "issuancePrice": 10.00,
    "verificationPrice": 5.00,
    "revocationPrice": 2.00,
    "currency": "USD",
    "issuancePlatformShare": 10,
    "issuanceEcosystemShare": 5,
    "issuanceIssuerShare": 85,
    "verificationPlatformShare": 10,
    "verificationEcosystemShare": 5,
    "verificationVerifierShare": 85,
    "revocationPlatformShare": 10,
    "revocationEcosystemShare": 5,
    "revocationIssuerShare": 85,
    "createDateTime": "2025-11-04T11:00:00.000Z",
    "createdBy": "user-id"
  }
}
```

**Example:**
```javascript
async function addSchemaToEcosystem(token, ecosystemId, schemaData) {
  const response = await fetch(
    `https://api.confamd.com/ecosystem/${ecosystemId}/schemas`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(schemaData)
    }
  );

  return await response.json();
}

// Usage - Basic example with default 10/5/85 split
const result = await addSchemaToEcosystem(
  userToken,
  '550e8400-e29b-41d4-a716-446655440000',
  {
    schemaLedgerId: 'did:indy:sovrin:123/schema/medical-license/1.0',
    issuancePrice: 10.00,
    verificationPrice: 5.00,
    revocationPrice: 2.00,
    currency: 'USD',
    // Issuance revenue split: Platform 10%, Ecosystem 5%, Issuer 85%
    issuancePlatformShare: 10,
    issuanceEcosystemShare: 5,
    issuanceIssuerShare: 85,
    // Verification revenue split: Platform 10%, Ecosystem 5%, Verifier 85%
    verificationPlatformShare: 10,
    verificationEcosystemShare: 5,
    verificationVerifierShare: 85,
    // Revocation revenue split: Platform 10%, Ecosystem 5%, Issuer 85%
    revocationPlatformShare: 10,
    revocationEcosystemShare: 5,
    revocationIssuerShare: 85
  }
);

// Usage - Custom revenue split example
const customResult = await addSchemaToEcosystem(
  userToken,
  '550e8400-e29b-41d4-a716-446655440000',
  {
    schemaLedgerId: 'did:indy:sovrin:456/schema/vaccination/2.0',
    issuancePrice: 15.00,
    verificationPrice: 3.00,
    revocationPrice: 5.00,
    currency: 'EUR',
    // Custom issuance split: Platform 15%, Ecosystem 10%, Issuer 75%
    issuancePlatformShare: 15,
    issuanceEcosystemShare: 10,
    issuanceIssuerShare: 75,
    // Custom verification split: Platform 5%, Ecosystem 5%, Verifier 90%
    verificationPlatformShare: 5,
    verificationEcosystemShare: 5,
    verificationVerifierShare: 90,
    // Custom revocation split: Platform 20%, Ecosystem 10%, Issuer 70%
    revocationPlatformShare: 20,
    revocationEcosystemShare: 10,
    revocationIssuerShare: 70
  }
);
```

---

### 10. Get Ecosystem Schemas
Retrieve all schemas in an ecosystem with pricing.

**Endpoint:** `GET /ecosystem/:id/schemas`

**Authentication:** Optional (Public endpoint)

**Path Parameters:**
- `id` (UUID) - The ecosystem ID

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| pageNumber | number | No | 1 | Page number for pagination |
| pageSize | number | No | 10 | Number of items per page |
| search | string | No | "" | Search by schema ledger ID |

**Response:** `200 OK`
```json
{
  "statusCode": 200,
  "message": "Schemas retrieved successfully",
  "data": {
    "schemas": [
      {
        "id": "schema-ecosystem-id",
        "ecosystemId": "550e8400-e29b-41d4-a716-446655440000",
        "schemaLedgerId": "did:indy:sovrin:123/schema/medical-license/1.0",
        "issuancePrice": 10.00,
        "verificationPrice": 5.00,
        "revocationPrice": 2.00,
        "currency": "USD",
        "issuancePlatformShare": 10,
        "issuanceEcosystemShare": 5,
        "issuanceIssuerShare": 85,
        "verificationPlatformShare": 10,
        "verificationEcosystemShare": 5,
        "verificationVerifierShare": 85,
        "revocationPlatformShare": 10,
        "revocationEcosystemShare": 5,
        "revocationIssuerShare": 85,
        "createDateTime": "2025-11-04T10:00:00.000Z"
      }
    ],
    "totalCount": 8
  }
}
```

**Example:**
```javascript
async function getEcosystemSchemas(ecosystemId, pageNumber = 1, pageSize = 10, search = '') {
  const params = new URLSearchParams({
    pageNumber: pageNumber.toString(),
    pageSize: pageSize.toString(),
    search
  });

  const response = await fetch(
    `https://api.confamd.com/ecosystem/${ecosystemId}/schemas?${params}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );

  return await response.json();
}

// Usage
const schemas = await getEcosystemSchemas(
  '550e8400-e29b-41d4-a716-446655440000',
  1,
  20,
  'medical'
);
```

---

### 11. Update Schema Pricing
Update pricing and revenue sharing configuration for a schema in the ecosystem.

**Endpoint:** `PUT /ecosystem/:id/schemas/:schemaId/pricing`

**Authentication:** Required (Bearer Token)

**Path Parameters:**
- `id` (UUID) - The ecosystem ID
- `schemaId` (UUID) - The schema ID

**Request Body:**
```json
{
  "issuancePrice": 12.00,
  "verificationPrice": 6.00,
  "revocationPrice": 3.00,
  "currency": "EUR",
  "issuancePlatformShare": 15,
  "issuanceEcosystemShare": 10,
  "issuanceIssuerShare": 75,
  "verificationPlatformShare": 12,
  "verificationEcosystemShare": 8,
  "verificationVerifierShare": 80,
  "revocationPlatformShare": 20,
  "revocationEcosystemShare": 10,
  "revocationIssuerShare": 70
}
```

**Note:** All fields are optional. Only include fields you want to update.

**Important:** When updating revenue shares for any operation type, you must provide all three shares for that operation (Platform, Ecosystem, and Issuer/Verifier) and they must total 100%.

**Response:** `200 OK`
```json
{
  "statusCode": 200,
  "message": "Schema pricing updated successfully",
  "data": {
    "id": "schema-ecosystem-id",
    "issuancePrice": 12.00,
    "verificationPrice": 6.00,
    "revocationPrice": 3.00,
    "currency": "EUR",
    "issuancePlatformShare": 15,
    "issuanceEcosystemShare": 10,
    "issuanceIssuerShare": 75,
    "verificationPlatformShare": 12,
    "verificationEcosystemShare": 8,
    "verificationVerifierShare": 80,
    "revocationPlatformShare": 20,
    "revocationEcosystemShare": 10,
    "revocationIssuerShare": 70,
    "lastChangedDateTime": "2025-11-04T11:30:00.000Z"
  }
}
```

**Example:**
```javascript
async function updateSchemaPricing(token, ecosystemId, schemaId, pricing) {
  const response = await fetch(
    `https://api.confamd.com/ecosystem/${ecosystemId}/schemas/${schemaId}/pricing`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(pricing)
    }
  );

  return await response.json();
}

// Usage - Update only issuance price (revenue shares unchanged)
const result1 = await updateSchemaPricing(
  userToken,
  '550e8400-e29b-41d4-a716-446655440000',
  'schema-id-123',
  { issuancePrice: 15.00 }
);

// Usage - Update issuance revenue shares (all three required)
const result2 = await updateSchemaPricing(
  userToken,
  '550e8400-e29b-41d4-a716-446655440000',
  'schema-id-123',
  {
    issuancePlatformShare: 20,
    issuanceEcosystemShare: 10,
    issuanceIssuerShare: 70  // Total: 100%
  }
);

// Usage - Update multiple operation types
const result3 = await updateSchemaPricing(
  userToken,
  '550e8400-e29b-41d4-a716-446655440000',
  'schema-id-123',
  {
    // Update prices
    issuancePrice: 12.00,
    verificationPrice: 6.00,
    // Update issuance revenue split
    issuancePlatformShare: 15,
    issuanceEcosystemShare: 10,
    issuanceIssuerShare: 75,
    // Update verification revenue split
    verificationPlatformShare: 10,
    verificationEcosystemShare: 5,
    verificationVerifierShare: 85
  }
);
```

---

### 12. Create Ecosystem Invitation
Send an invitation to a user to join the ecosystem.

**Endpoint:** `POST /ecosystem/:id/users/invitations`

**Authentication:** Required (Bearer Token)

**Path Parameters:**
- `id` (UUID) - The ecosystem ID

**Request Body:**
```json
{
  "email": "user@example.com",
  "orgId": "organization-uuid",
  "ecosystemRole": ["ECOSYSTEM_MEMBER"]
}
```

**Field Descriptions:**
- `email` - Email address of the user to invite
- `orgId` - (Optional) Organization ID if inviting to specific org
- `ecosystemRole` - Array of roles to assign

**Response:** `201 Created`
```json
{
  "statusCode": 201,
  "message": "Ecosystem invitation created successfully",
  "data": {
    "id": "invitation-id",
    "ecosystemId": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "orgId": "organization-uuid",
    "ecosystemRole": ["ECOSYSTEM_MEMBER"],
    "status": "PENDING",
    "createDateTime": "2025-11-04T11:00:00.000Z",
    "createdBy": "user-id"
  }
}
```

**Example:**
```javascript
async function createEcosystemInvitation(token, ecosystemId, invitationData) {
  const response = await fetch(
    `https://api.confamd.com/ecosystem/${ecosystemId}/users/invitations`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(invitationData)
    }
  );

  return await response.json();
}

// Usage
const invitation = await createEcosystemInvitation(
  userToken,
  '550e8400-e29b-41d4-a716-446655440000',
  {
    email: 'newuser@example.com',
    ecosystemRole: ['ECOSYSTEM_MEMBER']
  }
);
```

---

### 13. Get Ecosystem Invitations ⭐ (FIXES 404)
Retrieve all invitations for an ecosystem.

**Endpoint:** `GET /ecosystem/:id/users/invitations`

**Authentication:** Optional (Public endpoint)

**Path Parameters:**
- `id` (UUID) - The ecosystem ID

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| pageNumber | number | No | 1 | Page number for pagination |
| pageSize | number | No | 10 | Number of items per page |
| search | string | No | "" | Search by email address |

**Response:** `200 OK`
```json
{
  "statusCode": 200,
  "message": "Invitations retrieved successfully",
  "data": {
    "invitations": [
      {
        "id": "invitation-id",
        "ecosystemId": "550e8400-e29b-41d4-a716-446655440000",
        "email": "user@example.com",
        "orgId": "organization-uuid",
        "ecosystemRole": ["ECOSYSTEM_MEMBER"],
        "status": "PENDING",
        "createDateTime": "2025-11-04T10:00:00.000Z"
      }
    ],
    "totalCount": 12
  }
}
```

**Example:**
```javascript
async function getEcosystemInvitations(ecosystemId, pageNumber = 1, pageSize = 10, search = '') {
  const params = new URLSearchParams({
    pageNumber: pageNumber.toString(),
    pageSize: pageSize.toString(),
    search
  });

  const response = await fetch(
    `https://api.confamd.com/ecosystem/${ecosystemId}/users/invitations?${params}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );

  return await response.json();
}

// Usage
const invitations = await getEcosystemInvitations(
  '550e8400-e29b-41d4-a716-446655440000',
  1,
  20,
  'example.com'
);
```

---

## Error Handling

All endpoints return standard error responses:

### Common Error Responses

**400 Bad Request** - Invalid input data
```json
{
  "statusCode": 400,
  "message": "Invalid ecosystem ID",
  "error": "Bad Request"
}
```

**401 Unauthorized** - Missing or invalid authentication token
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

**404 Not Found** - Resource not found
```json
{
  "statusCode": 404,
  "message": "Ecosystem not found",
  "error": "Not Found"
}
```

**409 Conflict** - Resource already exists
```json
{
  "statusCode": 409,
  "message": "Ecosystem with this name already exists",
  "error": "Conflict"
}
```

**500 Internal Server Error** - Server error
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

### Error Handling Example
```javascript
async function handleEcosystemRequest() {
  try {
    const ecosystem = await createEcosystem(token, ecosystemData);
    console.log('Success:', ecosystem);
  } catch (error) {
    if (error.response) {
      // The request was made and server responded with error status
      switch (error.response.status) {
        case 400:
          console.error('Invalid data provided');
          break;
        case 401:
          console.error('Please log in');
          break;
        case 404:
          console.error('Ecosystem not found');
          break;
        case 409:
          console.error('Ecosystem already exists');
          break;
        default:
          console.error('An error occurred');
      }
    } else {
      // Network error or request setup error
      console.error('Network error:', error.message);
    }
  }
}
```

---

## Complete React/TypeScript Example

Here's a complete example using React with TypeScript and a custom hook:

```typescript
// types/ecosystem.ts
export interface Ecosystem {
  id: string;
  name: string;
  logo?: string;
  description?: string;
  createDateTime: string;
  organizations?: EcosystemOrganization[];
  schemas?: EcosystemSchema[];
  invitations?: EcosystemInvitation[];
}

export interface EcosystemOrganization {
  id: string;
  ecosystemRole: EcosystemRole[];
  organisation: {
    id: string;
    name: string;
    description?: string;
    logoUrl?: string;
    website?: string;
  };
}

export interface EcosystemSchema {
  id: string;
  schemaLedgerId: string;

  // Pricing
  issuancePrice: number;
  verificationPrice: number;
  revocationPrice: number;
  currency: string;

  // Issuance Revenue Sharing
  issuancePlatformShare: number;
  issuanceEcosystemShare: number;
  issuanceIssuerShare: number;

  // Verification Revenue Sharing
  verificationPlatformShare: number;
  verificationEcosystemShare: number;
  verificationVerifierShare: number;

  // Revocation Revenue Sharing
  revocationPlatformShare: number;
  revocationEcosystemShare: number;
  revocationIssuerShare: number;

  createDateTime: string;
}

export interface EcosystemInvitation {
  id: string;
  email: string;
  orgId?: string;
  ecosystemRole: EcosystemRole[];
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createDateTime: string;
}

export type EcosystemRole =
  | 'ECOSYSTEM_LEAD'
  | 'ECOSYSTEM_MEMBER'
  | 'ECOSYSTEM_ISSUER'
  | 'ECOSYSTEM_VERIFIER';

export interface CreateEcosystemDto {
  name: string;
  logo?: string;
  description?: string;
}

export interface UpdateEcosystemDto {
  name?: string;
  logo?: string;
  description?: string;
}
```

```typescript
// hooks/useEcosystem.ts
import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'https://api.confamd.com';

export const useEcosystem = (token: string) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const getAllEcosystems = async (
    pageNumber = 1,
    pageSize = 10,
    search = ''
  ) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE_URL}/ecosystem`, {
        params: { pageNumber, pageSize, search }
      });
      return response.data.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch ecosystems');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getEcosystemById = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE_URL}/ecosystem/${id}`);
      return response.data.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch ecosystem');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const createEcosystem = async (data: CreateEcosystemDto) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/ecosystem', data);
      return response.data.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create ecosystem');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateEcosystem = async (id: string, data: UpdateEcosystemDto) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.put(`/ecosystem/${id}`, data);
      return response.data.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update ecosystem');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteEcosystem = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/ecosystem/${id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete ecosystem');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const addOrganizationToEcosystem = async (
    ecosystemId: string,
    orgId: string,
    roles: EcosystemRole[]
  ) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(
        `/ecosystem/${ecosystemId}/organizations`,
        { orgId, ecosystemRole: roles }
      );
      return response.data.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add organization');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getEcosystemInvitations = async (
    ecosystemId: string,
    pageNumber = 1,
    pageSize = 10,
    search = ''
  ) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(
        `${API_BASE_URL}/ecosystem/${ecosystemId}/users/invitations`,
        { params: { pageNumber, pageSize, search } }
      );
      return response.data.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch invitations');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    getAllEcosystems,
    getEcosystemById,
    createEcosystem,
    updateEcosystem,
    deleteEcosystem,
    addOrganizationToEcosystem,
    getEcosystemInvitations
  };
};
```

```typescript
// components/EcosystemList.tsx
import React, { useState, useEffect } from 'react';
import { useEcosystem } from '../hooks/useEcosystem';
import { Ecosystem } from '../types/ecosystem';

interface Props {
  token: string;
}

export const EcosystemList: React.FC<Props> = ({ token }) => {
  const { loading, error, getAllEcosystems } = useEcosystem(token);
  const [ecosystems, setEcosystems] = useState<Ecosystem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadEcosystems();
  }, [currentPage, search]);

  const loadEcosystems = async () => {
    try {
      const data = await getAllEcosystems(currentPage, 10, search);
      setEcosystems(data.ecosystems);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error('Error loading ecosystems:', err);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="ecosystem-list">
      <h2>Ecosystems</h2>

      <input
        type="text"
        placeholder="Search ecosystems..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setCurrentPage(1);
        }}
      />

      <div className="ecosystems">
        {ecosystems.map((ecosystem) => (
          <div key={ecosystem.id} className="ecosystem-card">
            {ecosystem.logo && (
              <img src={ecosystem.logo} alt={ecosystem.name} />
            )}
            <h3>{ecosystem.name}</h3>
            <p>{ecosystem.description}</p>
            <p>
              Organizations: {ecosystem.organizations?.length || 0}
            </p>
          </div>
        ))}
      </div>

      <div className="pagination">
        <button
          disabled={currentPage === 1}
          onClick={() => setCurrentPage(currentPage - 1)}
        >
          Previous
        </button>
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <button
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage(currentPage + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
};
```

---

## Testing with cURL

### Create Ecosystem
```bash
curl -X POST https://api.confamd.com/ecosystem \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Ecosystem",
    "description": "Testing the API"
  }'
```

### Get All Ecosystems
```bash
curl -X GET "https://api.confamd.com/ecosystem?pageNumber=1&pageSize=10&search=test"
```

### Get Ecosystem by ID
```bash
curl -X GET https://api.confamd.com/ecosystem/550e8400-e29b-41d4-a716-446655440000
```

### Add Organization
```bash
curl -X POST https://api.confamd.com/ecosystem/550e8400-e29b-41d4-a716-446655440000/organizations \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orgId": "org-uuid",
    "ecosystemRole": ["ECOSYSTEM_ISSUER"]
  }'
```

### Get Invitations (Fixed 404)
```bash
curl -X GET "https://api.confamd.com/ecosystem/550e8400-e29b-41d4-a716-446655440000/users/invitations?pageNumber=1&pageSize=10"
```

---

## Best Practices

1. **Token Management**
   - Store JWT tokens securely (localStorage or httpOnly cookies)
   - Implement token refresh logic
   - Clear tokens on logout

2. **Error Handling**
   - Always wrap API calls in try-catch blocks
   - Provide user-friendly error messages
   - Log errors for debugging

3. **Loading States**
   - Show loading indicators during API calls
   - Disable buttons to prevent duplicate requests
   - Provide feedback after actions

4. **Data Validation**
   - Validate data on the frontend before sending
   - Check for required fields
   - Validate email formats, UUID formats, etc.

5. **Pagination**
   - Implement infinite scroll or pagination UI
   - Cache previous pages to reduce API calls
   - Show total count to users

6. **Search/Filter**
   - Debounce search inputs (300-500ms)
   - Clear search when unmounting
   - Show "no results" states

---

## Support

For questions or issues:
- API Documentation: https://api.confamd.com/docs
- GitHub Issues: https://github.com/anthropics/claude-code/issues
- Email: support@confamd.com

---

**Version:** 1.1.0
**Last Updated:** November 6, 2025
**API Version:** 2.1.0

**Changelog:**
- v1.1.0 (Nov 6, 2025): Added comprehensive pricing model with three-way revenue sharing for issuance, verification, and revocation operations
- v1.0.0 (Nov 4, 2025): Initial release
