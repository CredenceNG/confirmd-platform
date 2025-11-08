# Ecosystem Microservice Implementation Guide

## Overview
This guide provides step-by-step instructions to implement the Ecosystem microservice following existing patterns in the ConfirmD platform.

## Requirements Summary

### Core Features
1. **Ecosystem Management**: Create, read, update, delete ecosystems with name and logo
2. **Organization Management**: Add/remove organizations as issuers or verifiers (many-to-many)
3. **Schema Management**: Add schemas with pricing for issuance and verification
4. **Transaction Tracking**: Record issuance/verification transactions with revenue sharing
5. **Invitations**: Manage ecosystem user invitations
6. **Access Control**: Platform admin role required for management

### Critical Endpoint to Fix
- `GET /ecosystem/:ecosystemId/users/invitations` (currently returns 404)

---

## Implementation Steps

### Step 1: Database Schema (Prisma)

Add to `libs/prisma-service/prisma/schema.prisma`:

```prisma
model ecosystem {
  id                  String    @id @default(uuid()) @db.Uuid
  name                String    @db.VarChar(255)
  logo                String?   @db.VarChar(500)
  description         String?
  createdBy           String    @db.Uuid
  lastChangedBy       String    @db.Uuid
  createDateTime      DateTime  @default(now()) @db.Timestamptz(6)
  lastChangedDateTime DateTime  @default(now()) @db.Timestamptz(6)
  deletedAt           DateTime? @db.Timestamptz(6)

  organizations ecosystem_orgs[]
  schemas       ecosystem_schemas[]
  transactions  ecosystem_transactions[]
  invitations   ecosystem_invitations[]
}

model ecosystem_orgs {
  id              String    @id @default(uuid()) @db.Uuid
  ecosystemId     String    @db.Uuid
  orgId           String    @db.Uuid
  ecosystemRole   EcosystemRole[]
  createDateTime  DateTime  @default(now()) @db.Timestamptz(6)
  createdBy       String    @db.Uuid
  deletedAt       DateTime? @db.Timestamptz(6)

  ecosystem       ecosystem    @relation(fields: [ecosystemId], references: [id], onDelete: Cascade)
  organisation    organisation @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@unique([ecosystemId, orgId])
  @@index([ecosystemId])
  @@index([orgId])
}

model ecosystem_schemas {
  id                    String    @id @default(uuid()) @db.Uuid
  ecosystemId           String    @db.Uuid
  schemaLedgerId        String    @db.VarChar(255)

  // Pricing
  issuancePrice         Decimal   @default(0) @db.Decimal(10, 2)
  verificationPrice     Decimal   @default(0) @db.Decimal(10, 2)
  revocationPrice       Decimal   @default(0) @db.Decimal(10, 2)
  currency              String    @default("USD") @db.VarChar(10)

  // Issuance Revenue Sharing (must total 100%)
  issuancePlatformShare   Decimal   @default(10) @db.Decimal(5, 2)
  issuanceEcosystemShare  Decimal   @default(5) @db.Decimal(5, 2)
  issuanceIssuerShare     Decimal   @default(85) @db.Decimal(5, 2)

  // Verification Revenue Sharing (must total 100%)
  verificationPlatformShare   Decimal   @default(10) @db.Decimal(5, 2)
  verificationEcosystemShare  Decimal   @default(5) @db.Decimal(5, 2)
  verificationVerifierShare   Decimal   @default(85) @db.Decimal(5, 2)

  // Revocation Revenue Sharing (must total 100%)
  revocationPlatformShare   Decimal   @default(10) @db.Decimal(5, 2)
  revocationEcosystemShare  Decimal   @default(5) @db.Decimal(5, 2)
  revocationIssuerShare     Decimal   @default(85) @db.Decimal(5, 2)

  createDateTime        DateTime  @default(now()) @db.Timestamptz(6)
  createdBy             String    @db.Uuid
  lastChangedDateTime   DateTime  @default(now()) @db.Timestamptz(6)
  lastChangedBy         String    @db.Uuid
  deletedAt             DateTime? @db.Timestamptz(6)

  ecosystem ecosystem @relation(fields: [ecosystemId], references: [id], onDelete: Cascade)

  @@unique([ecosystemId, schemaLedgerId])
  @@index([ecosystemId])
}

model ecosystem_transactions {
  id              String   @id @default(uuid()) @db.Uuid
  ecosystemId     String   @db.Uuid
  orgId           String   @db.Uuid
  schemaLedgerId  String   @db.VarChar(255)
  transactionType String   @db.VarChar(50)
  amount          Decimal  @db.Decimal(10, 2)
  issuerShare     Decimal? @db.Decimal(10, 2)
  platformShare   Decimal? @db.Decimal(10, 2)
  credentialId    String?  @db.VarChar(255)
  createDateTime  DateTime @default(now()) @db.Timestamptz(6)

  ecosystem ecosystem @relation(fields: [ecosystemId], references: [id])

  @@index([ecosystemId, createDateTime])
  @@index([orgId, createDateTime])
  @@index([schemaLedgerId])
}

model ecosystem_invitations {
  id              String    @id @default(uuid()) @db.Uuid
  ecosystemId     String    @db.Uuid
  email           String    @db.VarChar(255)
  orgId           String?   @db.Uuid
  ecosystemRole   EcosystemRole[]
  status          InvitationStatus @default(PENDING)
  createDateTime  DateTime  @default(now()) @db.Timestamptz(6)
  createdBy       String    @db.Uuid
  deletedAt       DateTime? @db.Timestamptz(6)

  ecosystem ecosystem @relation(fields: [ecosystemId], references: [id], onDelete: Cascade)

  @@unique([ecosystemId, email])
  @@index([ecosystemId])
  @@index([email])
}

enum EcosystemRole {
  ECOSYSTEM_LEAD
  ECOSYSTEM_MEMBER
  ECOSYSTEM_ISSUER
  ECOSYSTEM_VERIFIER
}

enum InvitationStatus {
  PENDING
  ACCEPTED
  REJECTED
}
```

Run migration:
```bash
npx prisma migrate dev --name add_ecosystem_tables
npx prisma generate
```

---

### Step 2: Create Ecosystem Microservice

**Folder Structure:**
```
apps/ecosystem/
├── src/
│   ├── main.ts
│   ├── ecosystem.module.ts
│   ├── ecosystem.controller.ts
│   ├── ecosystem.service.ts
│   ├── dtos/
│   │   ├── create-ecosystem.dto.ts
│   │   ├── update-ecosystem.dto.ts
│   │   ├── add-org-to-ecosystem.dto.ts
│   │   ├── add-schema-to-ecosystem.dto.ts
│   │   └── create-invitation.dto.ts
│   ├── interfaces/
│   │   └── ecosystem.interface.ts
│   └── repositories/
│       └── ecosystem.repository.ts
├── test/
└── tsconfig.json
```

**Reference Pattern:**
- Copy structure from `apps/organization/`
- Use similar NATS message patterns
- Follow repository pattern like organization service

---

### Step 3: NATS Message Patterns

```typescript
// In ecosystem.controller.ts
@MessagePattern({ cmd: 'create-ecosystem' })
@MessagePattern({ cmd: 'get-ecosystem-by-id' })
@MessagePattern({ cmd: 'get-all-ecosystems' })
@MessagePattern({ cmd: 'update-ecosystem' })
@MessagePattern({ cmd: 'delete-ecosystem' })
@MessagePattern({ cmd: 'add-org-to-ecosystem' })
@MessagePattern({ cmd: 'remove-org-from-ecosystem' })
@MessagePattern({ cmd: 'get-ecosystem-orgs' })
@MessagePattern({ cmd: 'add-schema-to-ecosystem' })
@MessagePattern({ cmd: 'update-schema-pricing' })
@MessagePattern({ cmd: 'get-ecosystem-schemas' })
@MessagePattern({ cmd: 'get-ecosystem-invitations' })
@MessagePattern({ cmd: 'create-ecosystem-invitation' })
```

---

### Step 4: API Gateway Proxy Module

**Create:**
```
apps/api-gateway/src/ecosystem/
├── ecosystem.controller.ts
├── ecosystem.service.ts
└── ecosystem.module.ts
```

**REST Endpoints:**
- `POST /ecosystem`
- `GET /ecosystem/:id`
- `GET /ecosystem`
- `PUT /ecosystem/:id`
- `DELETE /ecosystem/:id`
- `POST /ecosystem/:id/organizations`
- `GET /ecosystem/:id/organizations`
- `DELETE /ecosystem/:id/organizations/:orgId`
- `POST /ecosystem/:id/schemas`
- `GET /ecosystem/:id/schemas`
- `PUT /ecosystem/:id/schemas/:schemaId/pricing`
- `GET /ecosystem/:id/users/invitations` ← **Critical fix**
- `POST /ecosystem/:id/users/invitations`

---

### Step 5: Docker Configuration

Add to `docker-compose-dev.yml`:

```yaml
ecosystem:
  container_name: ecosystem-service
  build:
    context: .
    dockerfile: Dockerfile
    args:
      - APP_NAME=ecosystem
  ports:
    - "4009:4009"
  volumes:
    - ./apps/ecosystem:/app/apps/ecosystem
    - ./libs:/app/libs
  environment:
    - NATS_URL=nats://nats:4222
    - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/credebl
  depends_on:
    - postgres
    - nats
```

Add to `nest-cli.json`:
```json
{
  "ecosystem": {
    "type": "application",
    "root": "apps/ecosystem",
    "entryFile": "main",
    "sourceRoot": "apps/ecosystem/src",
    "compilerOptions": {
      "tsConfigPath": "apps/ecosystem/tsconfig.app.json"
    }
  }
}
```

---

### Step 6: Update API Gateway app.module.ts

```typescript
import { EcosystemModule } from './ecosystem/ecosystem.module';

@Module({
  imports: [
    // ... existing modules
    EcosystemModule,
  ],
})
```

---

## Testing Checklist

- [ ] Database migrations run successfully
- [ ] Ecosystem service starts without errors
- [ ] API Gateway can communicate with ecosystem service via NATS
- [ ] `GET /ecosystem/:id/users/invitations` returns 200 (fixes 404 error)
- [ ] Can create ecosystem
- [ ] Can add organizations to ecosystem
- [ ] Can add schemas with pricing
- [ ] Can send invitations

---

## Files to Reference

**Follow these existing implementations:**
- Organization service: `apps/organization/src/organization.service.ts`
- Organization repository: `apps/organization/repositories/organization.repository.ts`
- Organization controller: `apps/organization/src/organization.controller.ts`
- API Gateway proxy: `apps/api-gateway/src/organization/`

---

## Next Steps

1. Start implementation with database schema
2. Create ecosystem microservice
3. Create API Gateway proxy
4. Test all endpoints
5. Deploy and verify frontend no longer gets 404

---

## Pricing Model Update (November 2025)

### Overview
The ecosystem pricing model has been redesigned to support granular three-way revenue sharing for each credential operation type: issuance, verification, and revocation.

### Changes Summary

**Previous Model:**
- Simple pricing: `issuancePrice`, `verificationPrice`
- Single revenue share: `issuerRevenueShare` (0-100%)
- Implied platform takes remainder

**New Model:**
- Comprehensive pricing: `issuancePrice`, `verificationPrice`, `revocationPrice`, `currency`
- Three-way revenue splits for each operation:
  - **Issuance**: Platform % + Ecosystem % + Issuer % = 100%
  - **Verification**: Platform % + Ecosystem % + Verifier % = 100%
  - **Revocation**: Platform % + Ecosystem % + Issuer % = 100%

### Database Fields Added

**To `ecosystem_schemas` table:**
```prisma
revocationPrice       Decimal   @default(0) @db.Decimal(10, 2)
currency              String    @default("USD") @db.VarChar(10)

// Issuance Revenue Sharing
issuancePlatformShare   Decimal   @default(10) @db.Decimal(5, 2)
issuanceEcosystemShare  Decimal   @default(5) @db.Decimal(5, 2)
issuanceIssuerShare     Decimal   @default(85) @db.Decimal(5, 2)

// Verification Revenue Sharing
verificationPlatformShare   Decimal   @default(10) @db.Decimal(5, 2)
verificationEcosystemShare  Decimal   @default(5) @db.Decimal(5, 2)
verificationVerifierShare   Decimal   @default(85) @db.Decimal(5, 2)

// Revocation Revenue Sharing
revocationPlatformShare   Decimal   @default(10) @db.Decimal(5, 2)
revocationEcosystemShare  Decimal   @default(5) @db.Decimal(5, 2)
revocationIssuerShare     Decimal   @default(85) @db.Decimal(5, 2)
```

### DTO Updates

**AddSchemaToEcosystemDto** - All fields required:
```typescript
{
  schemaLedgerId: string;
  issuancePrice: number;
  verificationPrice: number;
  revocationPrice: number;
  currency: string;
  issuancePlatformShare: number;
  issuanceEcosystemShare: number;
  issuanceIssuerShare: number;
  verificationPlatformShare: number;
  verificationEcosystemShare: number;
  verificationVerifierShare: number;
  revocationPlatformShare: number;
  revocationEcosystemShare: number;
  revocationIssuerShare: number;
}
```

**UpdateSchemaPricingDto** - All fields optional:
```typescript
{
  issuancePrice?: number;
  verificationPrice?: number;
  revocationPrice?: number;
  currency?: string;
  issuancePlatformShare?: number;
  issuanceEcosystemShare?: number;
  issuanceIssuerShare?: number;
  verificationPlatformShare?: number;
  verificationEcosystemShare?: number;
  verificationVerifierShare?: number;
  revocationPlatformShare?: number;
  revocationEcosystemShare?: number;
  revocationIssuerShare?: number;
}
```

### Validation Rules

**Service Layer Validation:**
1. All percentage fields must be between 0-100
2. For each operation type, the three shares must total exactly 100%
3. Validation occurs when:
   - Creating a schema (all shares required)
   - Updating a schema (only if all three shares for an operation are provided)

**Implementation:**
```typescript
// In ecosystem.service.ts - addSchemaToEcosystem()
const issuanceTotal = data.issuancePlatformShare + data.issuanceEcosystemShare + data.issuanceIssuerShare;
if (Math.abs(issuanceTotal - 100) > 0.01) {
  throw new BadRequestException('Issuance revenue shares must total 100%');
}
// Similar validation for verification and revocation
```

### Files Modified

**Backend:**
1. `libs/prisma-service/prisma/schema.prisma` - Database schema
2. `apps/ecosystem/interfaces/ecosystem.interface.ts` - TypeScript interfaces
3. `apps/ecosystem/dtos/add-schema-to-ecosystem.dto.ts` - Create DTO
4. `apps/ecosystem/dtos/update-schema-pricing.dto.ts` - Update DTO
5. `apps/ecosystem/repositories/ecosystem.repository.ts` - Data access layer
6. `apps/ecosystem/src/ecosystem.service.ts` - Business logic with validation
7. `apps/ecosystem/src/ecosystem.controller.ts` - NATS message handlers

**Documentation:**
1. `docs/ECOSYSTEM_FRONTEND_GUIDE.md` - Frontend API documentation
2. `docs/ECOSYSTEM_IMPLEMENTATION_GUIDE.md` - This file

### Migration Steps

**For New Deployments:**
- Run `npx prisma db push --schema=libs/prisma-service/prisma/schema.prisma`
- Run `npx prisma generate --schema=libs/prisma-service/prisma/schema.prisma`
- Rebuild ecosystem service: `nest build ecosystem`
- Restart ecosystem Docker container

**For Existing Deployments:**
1. Existing schemas will have default values:
   - Platform: 10%, Ecosystem: 5%, Issuer/Verifier: 85%
   - Currency: "USD"
   - Revocation price: 0
2. Frontend should be updated to support new fields
3. API clients should send all required fields when creating new schemas

### Frontend Integration

**When Creating a Schema:**
```javascript
const schemaData = {
  schemaLedgerId: 'schema-id',
  issuancePrice: 10.00,
  verificationPrice: 5.00,
  revocationPrice: 2.00,
  currency: 'USD',
  issuancePlatformShare: 10,
  issuanceEcosystemShare: 5,
  issuanceIssuerShare: 85,
  verificationPlatformShare: 10,
  verificationEcosystemShare: 5,
  verificationVerifierShare: 85,
  revocationPlatformShare: 10,
  revocationEcosystemShare: 5,
  revocationIssuerShare: 85
};
```

**When Updating Pricing:**
```javascript
// Update only prices (revenue shares unchanged)
{ issuancePrice: 12.00 }

// Update only issuance revenue split (all three required)
{
  issuancePlatformShare: 15,
  issuanceEcosystemShare: 10,
  issuanceIssuerShare: 75
}
```

### Testing Checklist

- [ ] Create schema with valid revenue shares (totaling 100% for each operation)
- [ ] Create schema with invalid shares (should fail validation)
- [ ] Update schema pricing without changing shares
- [ ] Update schema shares (all three for one operation)
- [ ] Verify database stores all fields correctly
- [ ] Test different currencies
- [ ] Test decimal precision for percentages (e.g., 33.33%)

---

**Estimated Implementation Time: 4-6 hours**
**Pricing Model Update Time: 3-4 hours (completed November 2025)**
