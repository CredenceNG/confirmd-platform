# Confirmd Platform Setup Guide

This document provides a comprehensive setup guide for the Confirmd platform based on the actual implementation found in the repository.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Platform Initialization](#platform-initialization)
- [Agent Configuration](#agent-configuration)
- [Service Configuration](#service-configuration)
- [Verification and Testing](#verification-and-testing)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Services

- PostgreSQL 13+ (for main database and agent wallets)
- NATS Server (for microservice communication)
- Redis (for caching)
- Keycloak (for authentication)
- Docker and Docker Compose

### Required External Services

- SendGrid API key (for email notifications)
- AWS S3 (for file storage and URL shortening)
- Schema File Server (for credential schemas)

## Environment Configuration

### Core Environment Variables

Based on the codebase, the following environment variables are **required** for platform setup:

```bash
# Platform Configuration
PLATFORM_ADMIN_EMAIL=admin@yourdomain.com
PLATFORM_ADMIN_PASSWORD=your_encrypted_password
CRYPTO_PRIVATE_KEY=dzIvVU5uMa0R3sYwdjEEuT4id17mPpjr

# Database Configuration
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/credebl"
POOL_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/credebl"

# Wallet Storage Configuration
WALLET_STORAGE_HOST=localhost
WALLET_STORAGE_PORT=5432
WALLET_STORAGE_USER=postgres
WALLET_STORAGE_PASSWORD=postgres

# Platform URLs and Endpoints
API_ENDPOINT=your-ip:5000
PLATFORM_URL=https://devapi.credebl.id
SOCKET_HOST=ws://your-ip:5000

# Communication Services
NATS_URL=nats://your-ip:4222
REDIS_HOST=your-ip
REDIS_PORT=6379

# Email Configuration
SENDGRID_API_KEY=your_sendgrid_key

# Keycloak Configuration
KEYCLOAK_DOMAIN=http://localhost:8080/
KEYCLOAK_MANAGEMENT_CLIENT_ID=adminClient
KEYCLOAK_MANAGEMENT_CLIENT_SECRET=your_client_secret
KEYCLOAK_REALM=credebl-platform

# Agent Configuration
AFJ_VERSION=ghcr.io/credebl/credo-controller:latest
PLATFORM_WALLET_NAME=platform-admin
PLATFORM_WALLET_PASSWORD='U2FsdGVkX19l6w/PpuicnGBYThBHolzF27oN0JwfWkc='

# Schema and Geo Data Scripts
GEO_LOCATION_MASTER_DATA_IMPORT_SCRIPT=/prisma/scripts/geo_location_data_import.sh
UPDATE_CLIENT_CREDENTIAL_SCRIPT=/prisma/scripts/update_client_credential_data.sh
```

## Database Setup

### 1. Initialize Database Schema

The platform uses Prisma for database management. Run migrations to create the schema:

```bash
cd libs/prisma-service
npx prisma migrate deploy
```

### 2. Seed Initial Data

The platform requires specific seed data as defined in `libs/prisma-service/prisma/seed.ts`. Run the seeding process:

```bash
cd libs/prisma-service
npx prisma db seed
```

### Seed Data Components

The seeding process creates the following essential data:

#### Platform Configuration (`platform_config`)

- External IP and endpoint configuration
- Email settings (SendGrid integration)
- API endpoints
- Tails file server configuration

#### Organization Roles (`org_roles`)

- `owner` - Organization Owner
- `admin` - Organization Admin
- `issuer` - Organization Credential Issuer
- `verifier` - Organization Credential Verifier
- `holder` - Credential Holder
- `member` - Organization Member
- `super_admin` - Administrative privileges
- `platform_admin` - Platform setup role

#### Agent Types (`agents_type`)

- `AFJ` - Aries Framework JavaScript
- `ACAPY` - Aries Cloud Agent Python

#### Organization Agent Types (`org_agents_type`)

- `DEDICATED` - Dedicated agent per organization
- `SHARED` - Shared agent across organizations

#### Ledger Configuration (`ledgers`)

Pre-configured ledger networks:

- Bcovrin Testnet
- Indicio Testnet/Demonet/Mainnet
- Polygon Testnet/Mainnet
- No Ledger (for did:key, did:web)

#### Ledger Config (`ledgerConfig`)

DID method configurations:

- `indy` - For Indy-based ledgers
- `polygon` - For Polygon-based DIDs
- `noLedger` - For non-ledger DIDs

#### Platform Admin User (`user`)

Creates the platform administrator user with:

- Email from `PLATFORM_ADMIN_EMAIL`
- Encrypted password
- Email verification status
- Supabase user ID

#### Platform Organization (`organisation`)

Creates the "Platform-admin" organization for platform management.

#### User Roles (`user_role`)

- `HOLDER` - Default wallet holder role
- `DEFAULT_USER` - Standard user role

## Platform Initialization

### 1. Start Core Services

Start the required infrastructure services:

```bash
# Start PostgreSQL, NATS, Redis
docker-compose -f docker-compose-dev.yml up -d postgres nats redis
```

### 2. Initialize Keycloak

Set up Keycloak authentication:

```bash
# Start Keycloak (if using Docker)
docker-compose -f docker-compose-dev.yml up -d keycloak

# Configure realm and clients (manual setup required)
```

### 3. Run Database Seeding

Execute the complete seeding process:

```bash
cd libs/prisma-service
npm run seed
```

This will:

- Create platform configuration
- Set up organization roles and agent types
- Create platform admin user and organization
- Configure ledger settings
- Import geo-location master data
- Update client credentials

## Agent Configuration

### Base Wallet Configuration

After seeding, configure the base wallet entry in `cloud_wallet_user_info`:

```sql
INSERT INTO cloud_wallet_user_info (
    id,
    user_id,
    wallet_id,
    wallet_label,
    agent_spin_up_status,
    agent_endpoint,
    wallet_status,
    tenant_id,
    created_date,
    last_changed_date,
    created_by,
    last_changed_by,
    wallet_type
) VALUES (
    'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    (SELECT id FROM "user" WHERE email = $PLATFORM_ADMIN_EMAIL),
    'platform-admin',
    'Platform Admin Wallet',
    2,  -- AgentSpinUpStatus.PROCESSED
    'http://agent-service:8001',
    'ACTIVE',
    'platform-admin',
    NOW(),
    NOW(),
    (SELECT id FROM "user" WHERE email = $PLATFORM_ADMIN_EMAIL),
    (SELECT id FROM "user" WHERE email = $PLATFORM_ADMIN_EMAIL),
    'SHARED'
);
```

### Agent API Key Management

The agent API key is generated automatically when the AFJ agent starts. Monitor agent logs for the API key:

```bash
# Watch agent logs for API key
docker-compose -f docker-compose-dev.yml logs -f agent-service | grep "API Key"
```

The API key must be encrypted and stored in the `org_agents` table:

```javascript
// Encryption script (based on fix-api-key-encryption.js)
const CryptoJS = require('crypto-js');

function encryptApiKey(apiKey, cryptoKey) {
  return CryptoJS.AES.encrypt(apiKey, cryptoKey).toString();
}

// Use the extracted API key
const encryptedKey = encryptApiKey(extractedApiKey, process.env.CRYPTO_PRIVATE_KEY);
```

## Service Configuration

### 1. Start Application Services

Start the microservices in dependency order:

```bash
# Start core services first
docker-compose -f docker-compose-dev.yml up -d agent-service

# Wait for agent to initialize and generate API key
sleep 30

# Start remaining services
docker-compose -f docker-compose-dev.yml up -d user organization verification issuance connection cloud-wallet

# Start API Gateway
docker-compose -f docker-compose-dev.yml up -d api-gateway

# Start nginx proxy
docker-compose -f docker-compose-dev.yml up -d nginx-proxy
```

### 2. Socket.IO Configuration

The platform uses Socket.IO for real-time communication. Key events include:

- `bulk-issuance-process-completed`
- `bulk-issuance-process-failed`
- `bulk-verification-process-completed`
- `bulk-verification-process-failed`

Socket.IO server runs on the API Gateway and connects to clients via the configured `SOCKET_HOST`.

## Verification and Testing

### 1. Health Checks

Verify all services are running:

```bash
# Check service status
docker-compose -f docker-compose-dev.yml ps

# Check specific service logs
docker-compose -f docker-compose-dev.yml logs service-name
```

### 2. Database Verification

Verify essential database entries:

```sql
-- Check platform config
SELECT * FROM platform_config;

-- Check platform admin user
SELECT * FROM "user" WHERE email = $PLATFORM_ADMIN_EMAIL;

-- Check base wallet configuration
SELECT * FROM cloud_wallet_user_info WHERE wallet_id = 'platform-admin';

-- Check org agents (should have encrypted API key)
SELECT id, wallet_name, agent_api_key FROM org_agents WHERE wallet_name = 'platform-admin';
```

### 3. Agent Connectivity

Test agent endpoint connectivity:

```bash
# Test agent health endpoint
curl http://localhost:8001/health

# Test agent configuration
curl http://localhost:8001/agent/config
```

### 4. Authentication Testing

Test Keycloak authentication:

```bash
# Test platform admin login
curl -X POST "$KEYCLOAK_DOMAIN/realms/credebl-platform/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&client_id=platform-admin&username=$PLATFORM_ADMIN_EMAIL&password=$PLATFORM_ADMIN_PASSWORD"
```

## Troubleshooting

### Common Issues

1. **Agent API Key Missing/Invalid**
   - Check agent-service logs for generated API key
   - Verify encryption using correct `CRYPTO_PRIVATE_KEY`
   - Update `org_agents` table with encrypted key

2. **Database Connection Issues**
   - Verify `DATABASE_URL` format and credentials
   - Ensure PostgreSQL is running and accessible
   - Check firewall/network configuration

3. **Socket.IO Connection Failures**
   - Verify `SOCKET_HOST` configuration
   - Check CORS settings in `ENABLE_CORS_IP_LIST`
   - Ensure API Gateway is running

4. **Authentication Failures**
   - Verify Keycloak configuration and realm setup
   - Check client credentials encryption
   - Validate user credentials in database

### Diagnostic Scripts

Use the provided diagnostic scripts:

```bash
# Test platform admin authentication
./scripts/test-platform-admin-auth.sh

# Check overall platform status
./scripts/test-platform-admin.sh

# Investigate specific issues
./scripts/investigate-platform-admin.sh
```

### Log Analysis

Monitor key log files:

```bash
# Agent service logs (for API key generation)
docker-compose -f docker-compose-dev.yml logs -f agent-service

# User service logs (for authentication)
docker-compose -f docker-compose-dev.yml logs -f user

# API Gateway logs (for Socket.IO events)
docker-compose -f docker-compose-dev.yml logs -f api-gateway
```

## Expected Log Messages

### Normal "Error" Messages

After platform setup, you will see recurring log messages that appear to be errors but are **normal and expected behavior**:

```
ERROR [,SchemaService] Error in retrieving schemas by org id: NotFoundException: Schema records not found
ERROR [,CredentialDefinitionService] Error in retrieving credential definitions: NotFoundException: No credential definitions found.
```

**These are NOT actual errors.** They occur because:

1. **Schema Records**: The platform attempts to retrieve credential schemas for organizations, but no schemas have been created yet. This is normal for a fresh installation.

2. **Credential Definitions**: Similarly, the platform looks for credential definitions, but none exist until schemas are created and credential definitions are generated from them.

3. **Polling Behavior**: These messages appear regularly because the frontend or API calls periodically check for available schemas and credential definitions.

### Why This Happens

The platform architecture separates the creation of schemas and credential definitions from their retrieval:

- **Schemas** must be created through the platform UI or API calls after setup
- **Credential Definitions** are generated from existing schemas
- The platform proactively checks for these resources even when they don't exist yet

### When to Be Concerned

These messages become concerning only if:

- They persist **after** you've successfully created schemas through the UI
- They're accompanied by actual functional issues (UI not loading, API calls failing)
- The HTTP status codes change from 404 to 500 or other error codes

### Normal Platform State

A properly functioning platform will show:

- Services running without critical errors
- Successful API responses for platform health checks
- Schema/credential definition "not found" messages (which are expected)
- Successful authentication and wallet operations

## Additional Configuration

### Mobile App Integration

Configure mobile app settings:

```bash
MOBILE_APP=ADEYA
MOBILE_APP_NAME=ADEYA SSI App
MOBILE_APP_DOWNLOAD_URL='https://blockster.global/products/adeya'
```

### Schema File Server

Configure schema file server for credential definitions:

```bash
SCHEMA_FILE_SERVER_URL='https://schema.credebl.id/schemas/'
SCHEMA_FILE_SERVER_TOKEN=your_token
```

### Production Considerations

For production deployment:

1. Use secure passwords and encryption keys
2. Configure SSL/TLS certificates
3. Set up proper backup procedures
4. Monitor resource usage and scaling
5. Implement proper logging and monitoring
6. Configure external load balancers

## Next Steps After Setup

Once the platform is properly configured:

1. **Access the Platform UI**: Navigate to your configured platform URL
2. **Create Your First Schema**: Use the schema creation interface to define credential schemas
3. **Generate Credential Definitions**: Create credential definitions from your schemas
4. **Set Up Organizations**: Configure organizations that will issue/verify credentials
5. **Test Credential Flows**: Issue and verify credentials to ensure proper operation

The "error" messages for missing schemas and credential definitions will decrease as you populate the platform with actual credential schemas and definitions.

This setup guide reflects the actual implementation in the Confirmd platform codebase and should be followed in sequence for successful platform initialization.
