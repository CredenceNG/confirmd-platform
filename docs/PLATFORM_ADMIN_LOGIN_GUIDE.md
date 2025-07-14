# Platform Admin Login Developer Guide

## Overview

This guide documents the investigation and resolution of platform admin login issues in the Confirmd Platform, including Keycloak configuration, troubleshooting steps, and authentication setup.

## Table of Contents

1. [Platform Admin Frontend Authentication](#platform-admin-frontend-authentication) **⭐ START HERE**
2. [Problem Description](#problem-description)
3. [Environment Configuration](#environment-configuration)
4. [Investigation Process](#investigation-process)
5. [Resolution Steps](#resolution-steps)
6. [Final Configuration](#final-configuration)
7. [Testing & Verification](#testing--verification)
8. [Troubleshooting Scripts](#troubleshooting-scripts)
9. [Common Issues & Solutions](#common-issues--solutions)
10. [Developer Notes](#developer-notes)
11. [ClientId and ClientSecret Usage Clarification](#clientid-and-clientsecret-usage-clarification)
12. [Platform Admin Frontend Authentication](#platform-admin-frontend-authentication)

---

## ⚡ EMERGENCY QUICK FIX SECTION ⚡

**If platform admin login is broken and you need it fixed IMMEDIATELY:**

### Step 1: Create/Fix Database User (2 minutes)

```bash
# Copy and paste this EXACT command:
docker exec -it confirmd-platform-postgres-1 psql -U postgres -d credebl -c "
INSERT INTO \"user\" (id, \"createDateTime\", \"lastChangedDateTime\", \"firstName\", \"lastName\", email, username, \"isEmailVerified\", \"keycloakUserId\", \"clientId\", \"clientSecret\", \"publicProfile\")
VALUES (gen_random_uuid(), NOW(), NOW(), 'Platform', 'Admin', 'admin@getconfirmd.com', 'platformadmin', true, '1f7fafe5-9a0d-4f8e-9b60-d35f5b992973', 'platform-admin', 'U2FsdGVkX18YqZjG2X6dHF+/CnR042luziiJoa+0P6AyZl1WOXU8GdkF796zMUX1', true)
ON CONFLICT (email) DO UPDATE SET
\"clientId\" = 'platform-admin',
\"clientSecret\" = 'U2FsdGVkX18YqZjG2X6dHF+/CnR042luziiJoa+0P6AyZl1WOXU8GdkF796zMUX1';"
```

### Step 2: Ensure Keycloak Client Exists (1 minute)

```bash
./create-platform-admin-client.sh
```

### Step 3: Reset Password (1 minute)

```bash
./reset-password.sh
```

### Step 4: Test Login

**Frontend credentials:**

- Email: `admin@getconfirmd.com`
- Password: `PlatformAdmin123!`

**✅ Should work immediately after running the above commands!**

---

## 🚀 QUICK 500 ERROR DIAGNOSTIC

**For rapid diagnosis of 500 errors in organization creation or other operations:**

```bash
# Run the quick diagnostic script (30 seconds)
./quick-500-debug.sh
```

**This script checks:**

- ✅ All critical services running
- ✅ Database connectivity
- ✅ Platform admin user exists
- ✅ NATS communication
- ✅ Recent error logs
- ✅ API Gateway health

**Provides instant fixes for common issues!**

---

## Problem Description

The platform admin user was unable to authenticate through the client application with the following credentials:

- **Email**: `admin@getconfirmd.com`
- **Password**: `PlatformAdmin123!`

### Initial Symptoms

- 404 "User not found" errors during login attempts
- Authentication failures even when user existed in Keycloak
- Missing or incorrect role assignments in JWT tokens
- Client configuration issues preventing direct access grants

## Environment Configuration

### Keycloak Setup

- **Keycloak Server**: `https://manager.credence.ng`
- **Realm**: `confirmd-bench`
- **Management Client**: `confirmd-bench-management`
- **Management Client Secret**: `APwJSRD9xjvfjTTZO0RoUz3y7sWej2eO`

### Platform Configuration (.env)

```properties
KEYCLOAK_DOMAIN=https://manager.credence.ng/
KEYCLOAK_ADMIN_URL=https://manager.credence.ng
KEYCLOAK_MASTER_REALM=master
KEYCLOAK_MANAGEMENT_CLIENT_ID=confirmd-bench-management
KEYCLOAK_MANAGEMENT_CLIENT_SECRET=APwJSRD9xjvfjTTZO0RoUz3y7sWej2eO
KEYCLOAK_MANAGEMENT_ADEYA_CLIENT_ID=adeya-client
KEYCLOAK_MANAGEMENT_ADEYA_CLIENT_SECRET=adeya-client-secret
KEYCLOAK_REALM=confirmd-bench
PLATFORM_ADMIN_EMAIL=itopamsule@gmail.com
```

## Investigation Process

### Step 1: Initial Diagnosis

Created comprehensive investigation script (`investigate-platform-admin.sh`) to check:

- Keycloak connectivity
- Admin token acquisition
- Realm existence
- User existence and details
- User credentials status
- Role assignments
- Client configuration
- Direct authentication testing

### Step 2: Issues Identified

1. **Missing Role Assignment**: User lacked `platform-admin` role
2. **Client Configuration**: Default `account` client had direct access grants disabled
3. **Role Mapping**: Realm roles not appearing in JWT tokens
4. **Token Claims**: `realm_access` missing from token payload

### Step 3: Root Cause Analysis

- User existed but had only default realm roles
- Account client configuration prevented password grant authentication
- Role mapper configuration was incomplete
- Client scope mappings were not properly configured for realm roles

## Resolution Steps

### Step 1: Role Assignment

```bash
# Assign platform-admin role to user
curl -X POST \
  "https://manager.credence.ng/admin/realms/confirmd-bench/users/1f7fafe5-9a0d-4f8e-9b60-d35f5b992973/role-mappings/realm" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[{"id":"7f904f45-5fe4-49cc-a83f-d192ea01776b","name":"platform-admin"}]'
```

### Step 2: Client Configuration

```bash
# Enable direct access grants for account client
curl -X PUT \
  "https://manager.credence.ng/admin/realms/confirmd-bench/clients/$CLIENT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"directAccessGrantsEnabled": true}'
```

### Step 3: Password Reset

```bash
# Reset password to ensure it's not temporary
curl -X PUT \
  "https://manager.credence.ng/admin/realms/confirmd-bench/users/$USER_ID/reset-password" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"password","value":"PlatformAdmin123!","temporary":false}'
```

### Step 4: Create Platform Admin User in Database

**CRITICAL**: The platform admin user must exist in both Keycloak AND the platform database. If the user only exists in Keycloak, you'll get "User not found" errors.

**⚠️ IMPORTANT**: Use the exact credentials below (client secret is pre-encrypted with the platform's crypto key):

```bash
# Create platform admin user in database (via Docker) - COPY EXACTLY
docker exec -it confirmd-platform-postgres-1 psql -U postgres -d credebl -c "
INSERT INTO \"user\" (
    id,
    \"createDateTime\",
    \"lastChangedDateTime\",
    \"firstName\",
    \"lastName\",
    email,
    username,
    \"isEmailVerified\",
    \"keycloakUserId\",
    \"clientId\",
    \"clientSecret\",
    \"publicProfile\"
) VALUES (
    gen_random_uuid(),
    NOW(),
    NOW(),
    'Platform',
    'Admin',
    'admin@getconfirmd.com',
    'platformadmin',
    true,
    '1f7fafe5-9a0d-4f8e-9b60-d35f5b992973',
    'platform-admin',
    'U2FsdGVkX18YqZjG2X6dHF+/CnR042luziiJoa+0P6AyZl1WOXU8GdkF796zMUX1',
    true
);"

# If user already exists but missing client credentials, update them:
docker exec -it confirmd-platform-postgres-1 psql -U postgres -d credebl -c "
UPDATE \"user\"
SET \"clientId\" = 'platform-admin',
    \"clientSecret\" = 'U2FsdGVkX18YqZjG2X6dHF+/CnR042luziiJoa+0P6AyZl1WOXU8GdkF796zMUX1'
WHERE email = 'admin@getconfirmd.com';"
```

**Note**: The credentials above are:

- `clientId`: `"platform-admin"` (plain text)
- `clientSecret`: `"public-client-no-secret"` (encrypted with platform's crypto key)

### Step 5: Create Dedicated Client

Created a dedicated `platform-admin` client with proper configuration:

```json
{
  "clientId": "platform-admin",
  "name": "Platform Admin Client",
  "enabled": true,
  "publicClient": true,
  "directAccessGrantsEnabled": true,
  "standardFlowEnabled": true,
  "fullScopeAllowed": true,
  "protocol": "openid-connect"
}
```

### Step 6: Fix Role Mapping

Updated realm roles mapper in the `roles` client scope:

```json
{
  "name": "realm roles",
  "protocolMapper": "oidc-usermodel-realm-role-mapper",
  "config": {
    "multivalued": "true",
    "userinfo.token.claim": "true",
    "id.token.claim": "true",
    "access.token.claim": "true",
    "claim.name": "realm_access.roles",
    "jsonType.label": "String"
  }
}
```

## Final Configuration

### Working Authentication Setup

- **Endpoint**: `https://manager.credence.ng/realms/confirmd-bench/protocol/openid-connect/token`
- **Client ID**: `platform-admin`
- **Grant Type**: `password`
- **Username**: `admin@getconfirmd.com`
- **Password**: `PlatformAdmin123!`
- **Scope**: `openid roles profile email`

### User Configuration

- **User ID**: `1f7fafe5-9a0d-4f8e-9b60-d35f5b992973`
- **Email**: `admin@getconfirmd.com`
- **Enabled**: `true`
- **Email Verified**: `true`
- **Assigned Roles**: `platform-admin`, `default-roles-confirmd-bench`

## Testing & Verification

### Authentication Test

```bash
curl -X POST \
  "https://manager.credence.ng/realms/confirmd-bench/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=platform-admin" \
  -d "username=admin@getconfirmd.com" \
  -d "password=PlatformAdmin123!" \
  -d "scope=openid roles profile email"
```

### Expected Token Claims

```json
{
  "realm_access": {
    "roles": ["offline_access", "platform-admin", "uma_authorization", "default-roles-confirmd-bench"]
  },
  "preferred_username": "admin@getconfirmd.com",
  "email": "admin@getconfirmd.com",
  "email_verified": true,
  "azp": "platform-admin"
}
```

## Troubleshooting Scripts

### Investigation Script

Location: `/scripts/investigate-platform-admin.sh`

- Comprehensive diagnostics
- Token validation
- Role verification
- Client configuration checks

### Fix Scripts

1. **Role Assignment**: `/scripts/fix-platform-admin.sh`
2. **Password Reset**: `/scripts/reset-password.sh`
3. **Client Creation**: `/scripts/create-platform-admin-client.sh`
4. **Mapper Fix**: `/scripts/fix-realm-roles-mapper.sh`

### Usage

```bash
chmod +x investigate-platform-admin.sh
./investigate-platform-admin.sh
```

## Common Issues & Solutions

### Issue 1: "User not found" Error

**Problem**: The API returns a 404 "User not found" error during login attempts
**Root Causes**:

- **MOST COMMON**: User doesn't exist in the platform database (even if they exist in Keycloak)
- User exists in Keycloak but wasn't properly synchronized to the platform database
- API endpoint routing issues preventing proper user lookup
- Mismatch between Keycloak user identifier and platform database user record

**Solutions**:

1. **Create User in Database**: Create the user record in the platform database with matching `keycloakUserId`
2. **Check User Existence**: Verify user exists in both Keycloak and platform database
3. **User Synchronization**: Ensure user was properly created/synchronized from Keycloak to platform
4. **API Endpoint**: Confirm frontend is calling the correct endpoint (`POST /auth/signin`)
5. **Database Integrity**: Check if user record exists with correct `keycloakUserId` field

**Troubleshooting Steps**:

```bash
# Check if user exists in Keycloak
curl -X GET \
  "https://manager.credence.ng/admin/realms/confirmd-bench/users?email=admin@getconfirmd.com" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Check platform database for user record
docker exec -it confirmd-platform-postgres-1 psql -U postgres -d credebl -c "
SELECT email, \"keycloakUserId\" FROM \"user\" WHERE email = 'admin@getconfirmd.com';"

# Create user if missing (use the keycloakUserId from Keycloak query above)
docker exec -it confirmd-platform-postgres-1 psql -U postgres -d credebl -c "
INSERT INTO \"user\" (id, \"createDateTime\", \"lastChangedDateTime\", \"firstName\", \"lastName\", email, username, \"isEmailVerified\", \"keycloakUserId\", \"publicProfile\")
VALUES (gen_random_uuid(), NOW(), NOW(), 'Platform', 'Admin', 'admin@getconfirmd.com', 'platformadmin', true, '1f7fafe5-9a0d-4f8e-9b60-d35f5b992973', true);"
```

### Issue 2: "invalid_client" Error

**Problem**: Management client credentials incorrect
**Solution**: Verify client ID and secret in `.env` file

### Issue 3: "Invalid user credentials"

**Problem**: Password issues or user disabled
**Solution**: Reset password and ensure user is enabled

### Issue 4: Missing Roles in Token

**Problem**: Role mapper not configured properly
**Solution**: Update realm roles mapper configuration

### Issue 5: "unauthorized_client" Error

**Problem**: Direct access grants disabled
**Solution**: Enable direct access grants for client

### Issue 6: Empty realm_access in Token

**Problem**: Client scopes not properly configured
**Solution**: Add roles scope to client default scopes

## Developer Notes

### Key Learnings

1. **Client Configuration**: Generic clients like `account` may not be suitable for admin authentication
2. **Role Mapping**: Realm roles require proper mapper configuration to appear in tokens
3. **Client Scopes**: Default scopes must include `roles` for role information
4. **Token Claims**: Different clients may produce different token structures

### Best Practices

1. Use dedicated clients for specific authentication purposes
2. Always verify token claims after configuration changes
3. Include comprehensive logging for authentication debugging
4. Test authentication flow end-to-end after changes

### Environment Variables

Ensure these are properly configured in your `.env`:

```properties
KEYCLOAK_DOMAIN=https://manager.credence.ng/
KEYCLOAK_REALM=confirmd-bench
KEYCLOAK_MANAGEMENT_CLIENT_ID=confirmd-bench-management
KEYCLOAK_MANAGEMENT_CLIENT_SECRET=APwJSRD9xjvfjTTZO0RoUz3y7sWej2eO
```

### Application Integration

When integrating with your application:

1. Use `platform-admin` client for admin authentication
2. Check for `platform-admin` role in `realm_access.roles`
3. Include `roles` scope in authentication requests
4. Handle token refresh appropriately

## ClientId and ClientSecret Usage Clarification

### Overview

The platform uses multiple types of Keycloak clients for different authentication purposes. Understanding the distinction between these client types is crucial for proper authentication flow implementation.

### Client Types in the Platform

#### 1. **Management Clients** (Static Configuration)

These are pre-configured clients used for administrative operations:

```properties
# Used for administrative operations (user creation, role assignment)
KEYCLOAK_MANAGEMENT_CLIENT_ID=confirmd-bench-management
KEYCLOAK_MANAGEMENT_CLIENT_SECRET=APwJSRD9xjvfjTTZO0RoUz3y7sWej2eO

# Used for mobile wallet authentication (Adeya)
KEYCLOAK_MANAGEMENT_ADEYA_CLIENT_ID=adeya-client
KEYCLOAK_MANAGEMENT_ADEYA_CLIENT_SECRET=adeya-client-secret

# Used for platform admin dashboard authentication (public client)
KEYCLOAK_PLATFORM_ADMIN_CLIENT_ID=platform-admin
```

#### 2. **Organization-Specific Clients** (Dynamic)

These are created automatically when organizations register and are what frontend applications use:

- **Purpose**: Each organization gets its own Keycloak client for isolated authentication
- **Creation**: Automatically generated during organization registration via `/organizations` endpoint
- **Storage**: Client credentials are stored encrypted in the database using AES-256-CBC
- **Usage**: Sent from frontend to authenticate organization context and generate user tokens
- **Security**: Credentials are never stored in plain text and are organization-scoped

**Dynamic Client Creation Process:**

1. Organization registers via API → `createOrganization()` called
2. Backend calls `clientRegistrationService.createClient()`
3. Unique `clientId` and `clientSecret` generated by Keycloak
4. ClientId stored as plain text, clientSecret encrypted using `CRYPTO_PRIVATE_KEY` and stored in database
5. Organization can now authenticate users within their isolated context

### **Multi-Tenant Security Model**

The platform implements a robust multi-tenant security architecture:

#### **Client Credential Management**

- **ClientId**: Stored as plain text for easy identification and debugging
- **ClientSecret**: Always encrypted using AES-256-CBC encryption with the platform's `CRYPTO_PRIVATE_KEY`
- **Isolation**: Each organization gets its own Keycloak client preventing cross-tenant access
- **Dynamic Generation**: Credentials are generated automatically during organization registration

#### **Platform Admin vs Organization Users**

- **Platform Admin**: Uses the static `platform-admin` client for system-wide operations
- **Organization Users**: Use their organization's dynamically created client for tenant-specific operations
- **Role-Based Access**: Platform admin has elevated privileges across all tenants

#### **Security Benefits**

1. **Tenant Isolation**: Organizations cannot access each other's data or users
2. **Credential Security**: Client secrets are never stored in plain text
3. **Audit Trail**: All authentication attempts are logged with client context
4. **Scalability**: New organizations get isolated authentication contexts automatically

### Multi-Tenant Security Model

#### **Organization Registration Flow:**

1. Organization registers → Keycloak client created automatically
2. Client gets unique `clientId` and `clientSecret` generated by Keycloak
3. Credentials stored encrypted in database using AES-256-CBC encryption
4. Users authenticate through organization's client context
5. JWT tokens issued with organization-specific `client_id` claim
6. All API operations scoped to the organization's context

#### **Security Benefits:**

- **Data Isolation**: Each organization operates in completely isolated authentication context
- **Credential Security**: Client secrets encrypted at rest, never exposed in logs
- **Token Scoping**: JWT tokens contain `client_id` for automatic organization context
- **Role Isolation**: User roles and permissions scoped per organization
- **Audit Trail**: All operations traceable to specific organization context

#### **Authentication Context:**

- Each organization operates in isolated client context
- JWT tokens contain `client_id` to identify organization context
- Role assignments and permissions are scoped to the organization

#### **JWT Strategy Validation:**

```typescript
// apps/api-gateway/src/authz/jwt.strategy.ts
if (payload.hasOwnProperty('client_id')) {
  const orgDetails: IOrganization = await this.organizationService.findOrganizationOwner(payload['client_id']);
  // Organization-specific user validation and context setting
}
```

### Key Distinctions

| Client Type               | Purpose             | Configuration                | Usage                         |
| ------------------------- | ------------------- | ---------------------------- | ----------------------------- |
| **Management Clients**    | Admin operations    | Static (.env)                | Internal service calls        |
| **Platform Admin Client** | Admin dashboard     | Static (created via scripts) | Admin authentication          |
| **Organization Clients**  | User authentication | Dynamic (per org)            | Frontend → API authentication |
| **Mobile App Client**     | Wallet integration  | Static (.env)                | Mobile app authentication     |

---

## 🔧 Troubleshooting Commands - Safe Alternatives

**⚠️ IMPORTANT: Some commands in this guide use `docker exec -it` which can hang your terminal.**

### Safe Command Alternatives

**Instead of:**

```bash
docker exec -it confirmd-platform-postgres-1 psql -U postgres -d credebl -c "SELECT * FROM users;"
```

**Use these safer alternatives:**

#### Option 1: Add timeout (recommended)

```bash
timeout 10s docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -c "SELECT * FROM users;"
```

#### Option 2: Non-interactive mode

```bash
docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -c "SELECT * FROM users;"
```

#### Option 3: Use a script wrapper

```bash
# Create a simple database query script
echo 'SELECT * FROM users;' | docker exec -i confirmd-platform-postgres-1 psql -U postgres -d credebl
```

### Why This Matters

- **Terminal Hanging**: `-it` flags can cause terminals to hang indefinitely
- **Better Error Handling**: Timeouts prevent indefinite waiting
- **Automation Friendly**: Non-interactive commands work better in scripts
- **Consistent Results**: Safer for production environments

### Quick Database Checks

```bash
# Check if database is ready (with timeout)
timeout 5s docker exec confirmd-platform-postgres-1 pg_isready -U postgres

# Check platform admin user exists (safe)
timeout 10s docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -c "SELECT email FROM \"user\" WHERE email = 'admin@getconfirmd.com';"

# Check container is running
docker ps | grep confirmd-platform-postgres-1
```

**Note**: All `docker exec -it` commands in this guide can be made safer by either:

1. Removing the `-it` flags, or
2. Adding `timeout 10s` at the beginning

---

**Last Updated**: July 7, 2025  
**Author**: Development Team  
**Version**: 2.1 - **ENHANCED MULTI-TENANT DOCUMENTATION**  
**Status**: ✅ **VERIFIED WORKING** - Complete end-to-end solution tested and confirmed

---

**🎯 For immediate fix, go to [Emergency Quick Fix Section](#-emergency-quick-fix-section-)**
