# Platform Admin Setup Guide

This document provides detailed information about the platform admin setup process.

## Overview

The platform admin is a special system-level account with full access to manage the Confirmd platform. It consists of:

1. **Keycloak User**: Authentication and authorization
2. **Database User Record**: Platform user profile
3. **Platform Organization**: System organization for platform operations
4. **Platform Agent**: SHARED agent for platform-level SSI operations

## Components

### 1. Keycloak User

**Purpose**: Authentication and role-based access control

**Details**:
- **Email**: admin@getconfirmd.com
- **Password**: PlatformAdmin123!
- **Keycloak User ID**: 1f7fafe5-9a0d-4f8e-9b60-d35f5b992973
- **Realm**: confirmd-bench
- **Client**: platform-admin (public client)
- **Roles**: platform_admin, default-roles-confirmd-bench

**Authentication Endpoint**:
```
POST https://manager.credence.ng/realms/confirmd-bench/protocol/openid-connect/token
```

**Grant Type**: Password (Resource Owner Password Credentials)

### 2. Database User Record

**Table**: `user`

**Key Fields**:
```sql
id: <generated UUID>
email: admin@getconfirmd.com
username: platformadmin
firstName: Platform
lastName: Admin
keycloakUserId: 1f7fafe5-9a0d-4f8e-9b60-d35f5b992973
clientId: platform-admin (plain text)
clientSecret: <AES encrypted> "public-client-no-secret"
isEmailVerified: true
publicProfile: true
```

**Encryption**: The `clientSecret` is encrypted using AES encryption with the platform's `CRYPTO_PRIVATE_KEY`.

### 3. Platform Admin Organization

**Table**: `organisation`

**Details**:
```sql
id: f856e3a4-b09c-4356-82de-b105594eec43
name: Platform Admin
description: System platform administrator organization
orgSlug: platform-admin
publicProfile: false
createdBy: 1f7fafe5-9a0d-4f8e-9b60-d35f5b992973
```

**Purpose**:
- System-level organization for platform operations
- Parent organization for platform-wide SSI operations
- Container for the platform admin agent

### 4. Platform Admin Agent

**Table**: `org_agents`

**Details**:
```sql
orgId: f856e3a4-b09c-4356-82de-b105594eec43
walletName: platform-admin
agentEndPoint: http://platform-admin-agent:8002
agentSpinUpStatus: 3 (complete)
apiKey: <AES encrypted JWT token>
tenantId: platform-admin-tenant
```

**Purpose**:
- SHARED agent for platform-level SSI operations (used by all organizations with SHARED agent type)
- Handles system-wide credential issuance
- Manages platform-level DIDs and schemas

## API Token Management

### Token Format

The platform admin agent uses JWT tokens for authentication:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZ2VudEluZm8iOiJhZ2VudEluZm8iLCJpYXQiOjE3NjMyMzE1OTB9.k72dqIRzNcNa9Le4wCvR7MYZdN3N_AZazCaVTCsF6eo
```

### Encryption Process

The token is encrypted before storage using:

```javascript
const CryptoJS = require('crypto-js');
const secretKey = process.env.CRYPTO_PRIVATE_KEY || 'defaultsecretkey';
const encryptedToken = CryptoJS.AES.encrypt(
    JSON.stringify(apiToken),
    secretKey
).toString();
```

### Updating the Token

The token is automatically updated during platform initialization. If you need to update it manually:

```bash
cd platform-initialization/scripts

# Auto-extract from agent logs (recommended)
node ./4-update-platform-token.js

# Or provide token manually
node ./4-update-platform-token.js "your-new-api-token"
```

This script:
1. Extracts the current JWT token from platform-admin-agent logs (or uses provided token)
2. Encrypts the token using CryptoJS AES (matching platform encryption)
3. Updates the `org_agents` table
4. Verifies encryption/decryption works correctly

## Agent Endpoint Configuration

The agent endpoint can be configured based on your deployment:

### Docker Compose (Default)
```
http://platform-admin-agent:8002
```

### External Agent
```
http://host.docker.internal:8002  (for local external agent)
https://your-agent-domain.com     (for remote agent)
```

Update in `platform-initialization/sql/create-platform-admin-org.sql` before running script 3.

## Security Considerations

### Password Security
- Default password should be changed in production
- Use strong passwords (minimum 12 characters, mixed case, numbers, symbols)
- Store securely using a password manager

### API Token Security
- Tokens are encrypted at rest in the database
- Use HTTPS for all agent communications
- Rotate tokens periodically (recommended: every 90 days)
- Never commit tokens to version control

### Client Secret
- The "public-client-no-secret" is a placeholder for public clients
- Keycloak public clients don't require a client secret
- The encrypted value in the database is for consistency

## Troubleshooting

### Authentication Fails

**Symptom**: Cannot authenticate as platform admin

**Checks**:
1. Verify Keycloak user exists: Check Keycloak admin console
2. Verify password is correct: Try resetting in Keycloak
3. Check database user record exists
4. Verify keycloakUserId matches between Keycloak and database

### Agent Token Issues

**Symptom**: Platform admin agent operations fail

**Checks**:
1. Verify org_agents record exists
2. Check API key is not 'ENCRYPTED_API_TOKEN_HERE' placeholder
3. Verify agent endpoint is accessible
4. Check agent logs for authentication errors

### Missing Organization

**Symptom**: No platform admin organization found

**Solution**:
```bash
cd platform-initialization/scripts
./3-create-platform-admin.sh
```

## Manual Setup (Advanced)

If you need to set up manually without scripts:

### 1. Create Keycloak User
- Access Keycloak admin console
- Create user with email: admin@getconfirmd.com
- Set password: PlatformAdmin123!
- Assign role: platform_admin

### 2. Create Database User
```sql
INSERT INTO "user" (
    id, "createDateTime", "lastChangedDateTime",
    "firstName", "lastName", email, username,
    "isEmailVerified", "keycloakUserId",
    "clientId", "clientSecret", "publicProfile"
) VALUES (
    gen_random_uuid(), NOW(), NOW(),
    'Platform', 'Admin',
    'admin@getconfirmd.com', 'platformadmin',
    true, '<keycloak-user-id>',
    'platform-admin',
    '<encrypted-secret>',
    true
);
```

### 3. Create Organization and Agent
Run the SQL script:
```bash
docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl \
    -f platform-initialization/sql/create-platform-admin-org.sql
```

### 4. Update API Token
Use the automated script:
```bash
node platform-initialization/scripts/4-update-platform-token.js
```

## References

- [INITIALIZATION_CHECKLIST.md](INITIALIZATION_CHECKLIST.md) - Step-by-step initialization
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues and solutions
- `../../docs/PLATFORM_ADMIN_LOGIN_GUIDE.md` - Original setup documentation
- `../../docs/PLATFORM_ADMIN_SUCCESS_SUMMARY.md` - Authentication details
