# CREDEBL SSI Platform - Application Features & Role-Based Onboarding Guide

## Overview

CREDEBL is a comprehensive Self-Sovereign Identity (SSI) platform built on a microservices architecture using NestJS. The platform enables organizations and individuals to issue, verify, and manage digital credentials in a decentralized manner.

## Platform Architecture

### Microservices Structure

The platform is composed of the following microservices:

1. **API Gateway** - Central entry point and routing
2. **User Service** - User management and authentication
3. **Organization Service** - Organization management and invitations
4. **Agent Service** - SSI agent operations
5. **Agent Provisioning** - Agent deployment and management
6. **Issuance Service** - Credential issuance workflows
7. **Verification Service** - Credential verification processes
8. **Connection Service** - Agent-to-agent connections
9. **Ledger Service** - Blockchain/ledger interactions
10. **Cloud Wallet Service** - Cloud-based wallet management
11. **Notification Service** - Email and notification handling
12. **Webhook Service** - Webhook management
13. **Utility Service** - Common utilities and helpers
14. **Geo-location Service** - Location-based services

### Technology Stack

- **Backend**: NestJS (Node.js)
- **Database**: PostgreSQL with Prisma ORM
- **Message Broker**: NATS for inter-service communication
- **Authentication**: Keycloak for identity management
- **Cloud Storage**: Supabase integration
- **Agent Framework**: Aries Framework JavaScript (AFJ)
- **Container**: Docker for deployment

## User Roles & Permissions

### Role Hierarchy

1. **Platform Admin** (`platform_admin`)
   - Highest level access
   - Can manage all organizations and users
   - Platform-wide administrative capabilities

2. **Organization Owner** (`owner`)
   - Full control over their organization
   - Can manage all organization settings
   - Can invite and manage all user roles within the organization
   - Access to all organization features

3. **Super Admin** (`super_admin`)
   - Administrative privileges within organization
   - Can manage most organization settings
   - Can invite and manage users (except owners)

4. **Admin** (`admin`)
   - Can manage organization users and basic settings
   - Can invite members, issuers, and verifiers
   - Limited administrative capabilities

5. **Issuer** (`issuer`)
   - Can issue credentials to holders
   - Can create credential definitions
   - Can manage issuance workflows

6. **Verifier** (`verifier`)
   - Can verify credentials from holders
   - Can create proof requests
   - Can manage verification workflows

7. **Member** (`member`)
   - Basic organization member
   - Limited access to organization features
   - Can participate in workflows as assigned

8. **Holder** (`holder`)
   - Individual users who receive and hold credentials
   - Can accept credential offers
   - Can respond to proof requests
   - Uses mobile wallet for credential management

## Core Features

### 1. User Management

- **Email-based registration** with verification
- **Multi-factor authentication** support
- **Profile management** with public/private settings
- **Password reset** functionality
- **FIDO/WebAuthn** support for passwordless authentication

### 2. Organization Management

- **Organization creation** and registration
- **Role-based access control** (RBAC)
- **User invitation system** with email notifications
- **Organization dashboard** with analytics
- **Multi-organization support** per user

### Agent Management

- **Dedicated agent provisioning** with Docker support
- **Multiple deployment options**:
  - Docker Compose (local development)
  - AWS ECS Fargate (cloud deployment)
  - On-premises deployment
- **AFJ (Aries Framework JavaScript)** based agents
- **Agent health monitoring** and status tracking
- **PostgreSQL wallet storage** with encryption
- **Multi-ledger support** (Indicio, BCovrin networks)
- **Webhook integration** for real-time event notifications
- **Agent configuration management** with JSON config files
- **Port management** for multiple agent instances
- **DID and key management** for organizations

### 4. Credential Issuance

- **AFJ-based credential issuance** via provisioned agents
- **Out-of-band credential offers** with email delivery
- **Connection-based credential issuance** for established connections
- **Credential offer management** and tracking
- **Email notifications** with QR codes for mobile wallet integration
- **Bulk credential operations** (based on template structure)

### 5. Credential Verification

- **Proof request creation** and management via agents
- **Out-of-band verification** with email delivery and QR codes
- **Real-time verification status** tracking and updates
- **Email-based proof requests** with mobile app integration
- **Verification analytics** and result reporting
- **Webhook integration** for verification events
- **Deep link support** for mobile wallet apps

### 6. Connection Management

- **DID-based connections** via AFJ agents
- **Connection invitation creation** and management
- **Out-of-band connection invitations** with QR codes
- **Connection status monitoring** and health checks
- **Multi-use and single-use** connection invitations

### 7. DID and Ledger Management

- **Multiple ledger support** (Indicio Mainnet, Testnet, Demonet, BCovrin)
- **DID registration** and management via agents
- **Primary DID setting** for organizations
- **Ledger integration** with Indy-based networks
- **Network configuration** and namespace management

### 8. Cloud Wallet

- **Cloud-based credential storage** for holder users
- **Credential management** interface
- **Proof presentation** capabilities
- **Integration with agent-based workflows**

### 9. Ecosystem Management

- **Multi-ledger support** with configurable networks
- **Organization ecosystem integration**
- **Cross-ledger transactions** via agent abstraction

## Authentication and Authorization Flow

The CREDEBL platform implements a comprehensive authentication and authorization system using **Keycloak** as the primary identity provider, with support for multiple authentication strategies and role-based access control.

### Authentication Architecture

#### Primary Components

1. **Keycloak Identity Provider** - Centralized identity and access management
2. **JWT Strategy** - Standard JWT-based authentication for web applications
3. **Mobile JWT Strategy** - Specialized strategy for mobile applications
4. **Passport.js Integration** - Authentication middleware framework
5. **Role-Based Access Control (RBAC)** - Organization-specific role management

#### Supported Authentication Methods

- **Email/Password Authentication** with Keycloak
- **FIDO/WebAuthn** for passwordless authentication
- **Client Credentials OAuth2** for service-to-service authentication
- **Refresh Token** support for session management

### Authentication Provider Setup

#### 1. Keycloak Configuration

**Environment Variables Setup:**

```bash
# Core Keycloak Configuration
KEYCLOAK_DOMAIN=http://localhost:8080/
KEYCLOAK_ADMIN_URL=http://localhost:8080
KEYCLOAK_REALM=credebl-platform
KEYCLOAK_MASTER_REALM=master

# Management Client Configuration
KEYCLOAK_MANAGEMENT_CLIENT_ID=adminClient
KEYCLOAK_MANAGEMENT_CLIENT_SECRET=your-management-secret
KEYCLOAK_MANAGEMENT_ADEYA_CLIENT_ID=adeyaClient
KEYCLOAK_MANAGEMENT_ADEYA_CLIENT_SECRET=your-adeya-secret
```

**Realm Setup:**

1. **Create Realm**: `credebl-platform`
2. **Configure Clients**: Each organization gets its own client
3. **Set Up Roles**: Owner, Admin, Issuer, Verifier, Member, Holder
4. **Enable Features**:
   - Direct Access Grants (for password flow)
   - Service Accounts (for client credentials)
   - Standard Flow (for authorization code)

#### 2. JWT Strategy Configuration

The platform uses dual JWT strategies:

**Standard JWT Strategy (Web Applications):**

```typescript
// JWT Strategy Configuration
{
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKeyProvider: dynamicKeyProvider, // Uses Keycloak JWKS endpoint
  algorithms: ['RS256']
}
```

**Mobile JWT Strategy:**

```typescript
// Mobile-specific JWT validation
{
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKeyProvider: dynamicKeyProvider,
  algorithms: ['RS256'],
  audience: 'adeyaClient' // Mobile app specific
}
```

#### 3. Dynamic Key Provider Setup

The platform dynamically fetches public keys from Keycloak's JWKS endpoint:

```typescript
// JWKS Configuration
const jwtOptions = {
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5,
  jwksUri: `${keycloakDomain}/realms/${realm}/protocol/openid-connect/certs`
};
```

### Authentication Flow Types

#### 1. User Authentication Flow

**Standard Login Process:**

1. **User Credentials** → Platform validates email/password
2. **Keycloak Verification** → Authenticates against Keycloak realm
3. **Token Generation** → Returns JWT access token and refresh token
4. **Token Validation** → Each request validates JWT signature via JWKS

**API Endpoints:**

- `POST /authz/user-login` - User authentication
- `POST /authz/refresh-token` - Token refresh
- `POST /authz/logout` - User logout

#### 2. Organization Client Authentication

**Client Credentials Flow:**

1. **Client Registration** → Organization gets clientId/clientSecret
2. **Token Request** → Uses OAuth2 client_credentials grant
3. **Access Token** → Returns organization-scoped token
4. **API Access** → Token provides organization context

**API Endpoints:**

- `POST /orgs/{clientId}/token` - Client authentication
- `POST /orgs/{orgId}/create-org-client-credentials` - Generate credentials

#### 3. FIDO/WebAuthn Authentication

**Passwordless Flow:**

1. **Registration** → User registers FIDO device
2. **Challenge Generation** → Platform creates authentication challenge
3. **Device Verification** → Biometric/hardware key verification
4. **Token Issuance** → Returns JWT token for authenticated user

**API Endpoints:**

- `POST /fido/generate-registration-options` - Start FIDO registration
- `POST /fido/verify-registration` - Complete FIDO registration
- `POST /fido/generate-authentication-options` - Start FIDO login
- `POST /fido/verify-authentication` - Complete FIDO login

### Provider Selection and Configuration

#### 1. Selecting Authentication Provider

**Environment-Based Configuration:**

```bash
# Primary Provider Selection
AUTH_PROVIDER=keycloak  # Options: keycloak, supabase (legacy)

# Provider-Specific Settings
KEYCLOAK_DOMAIN=https://your-keycloak-instance.com/
SUPABASE_URL=https://your-project.supabase.co  # Legacy support
SUPABASE_ANON_KEY=your-anon-key  # Legacy support
```

#### 2. Multi-Provider Support

The platform supports fallback authentication providers:

**Primary: Keycloak**

- Organization-specific clients
- Role-based access control
- OAuth2/OIDC compliance
- Enterprise SSO integration

**Secondary: Supabase (Legacy)**

- Email/password authentication
- Basic user management
- Used for users without Keycloak registration

#### 3. Provider Configuration Steps

**For Keycloak (Recommended):**

1. **Install Keycloak**:

```bash
# Docker deployment
docker run -p 8080:8080 -e KEYCLOAK_ADMIN=admin -e KEYCLOAK_ADMIN_PASSWORD=admin quay.io/keycloak/keycloak:latest start-dev
```

2. **Create Master Client**:

```bash
# Access admin console: http://localhost:8080/admin
# Create management client with appropriate permissions
```

3. **Configure Realm**:
   - Realm: `credebl-platform`
   - Token settings: Access token lifespan, refresh token settings
   - Security: Require SSL, content security policy

4. **Set Environment Variables**:

```bash
export KEYCLOAK_DOMAIN=http://localhost:8080/
export KEYCLOAK_REALM=credebl-platform
export KEYCLOAK_MANAGEMENT_CLIENT_ID=adminClient
export KEYCLOAK_MANAGEMENT_CLIENT_SECRET=generated-secret
```

**For Supabase (Legacy Support):**

1. **Create Supabase Project**: Visit https://app.supabase.com
2. **Get Credentials**: Project URL and anon key
3. **Configure Environment**:

```bash
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_ANON_KEY=your-anon-key
export SUPABASE_JWT_SECRET=your-jwt-secret
```

### Authorization Model

#### 1. Role-Based Access Control (RBAC)

**Organization Roles:**

- `OWNER` - Full organization control
- `ADMIN` - User and settings management
- `ISSUER` - Credential issuance capabilities
- `VERIFIER` - Credential verification capabilities
- `MEMBER` - Basic organization access
- `HOLDER` - Individual credential holder

**Platform Roles:**

- `PLATFORM_ADMIN` - Platform-wide administration

#### 2. Permission Matrix

| Role     | User Mgmt | Org Settings | Issue Creds | Verify Creds | Agent Mgmt |
| -------- | --------- | ------------ | ----------- | ------------ | ---------- |
| Owner    | ✓         | ✓            | ✓           | ✓            | ✓          |
| Admin    | ✓         | ✓            | ✗           | ✗            | ✓          |
| Issuer   | ✗         | ✗            | ✓           | ✗            | ✗          |
| Verifier | ✗         | ✗            | ✗           | ✓            | ✗          |
| Member   | ✗         | ✗            | ✗           | ✗            | ✗          |

#### 3. Context-Aware Authorization

**Request Context Injection:**

```typescript
// Middleware extracts user context from JWT
interface RequestContext {
  userId: string;
  orgId: string;
  roles: string[];
  permissions: Permission[];
  tenantId?: string;
}
```

**Organization Context:**

- Each request is scoped to specific organization
- Roles are organization-specific
- Cross-organization access requires explicit permissions

### Security Features

#### 1. Token Security

**JWT Configuration:**

- **Algorithm**: RS256 (RSA with SHA-256)
- **Key Rotation**: Dynamic key fetching from JWKS
- **Expiration**: Configurable access/refresh token lifespans
- **Audience Validation**: Client-specific audience claims

#### 2. API Security

**Protection Mechanisms:**

- **Rate Limiting**: JWKS requests limited to 5/minute
- **CORS Configuration**: Domain-specific origins
- **SSL/TLS**: Required for production deployments
- **Content Security Policy**: XSS protection

#### 3. Session Management

**Token Lifecycle:**

- **Access Token**: Short-lived (default: 10 hours)
- **Refresh Token**: Long-lived with rotation support
- **Automatic Refresh**: Client-side token renewal
- **Secure Storage**: HttpOnly cookies for refresh tokens

### Integration Examples

#### 1. Frontend Integration

**React/Angular Authentication:**

```javascript
// Login request
const loginResponse = await fetch('/authz/user-login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

const { access_token, refresh_token } = await loginResponse.json();

// Subsequent API calls
const apiResponse = await fetch('/api/protected-endpoint', {
  headers: { Authorization: `Bearer ${access_token}` }
});
```

#### 2. Mobile App Integration

**React Native/Flutter:**

```javascript
// Mobile-specific authentication
const mobileAuth = await fetch('/authz/mobile-login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Type': 'mobile'
  },
  body: JSON.stringify({ email, password })
});
```

#### 3. Service-to-Service Integration

**Backend Integration:**

```javascript
// Client credentials flow
const tokenResponse = await fetch('/orgs/{clientId}/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    clientId: 'org-client-id',
    clientSecret: 'org-client-secret'
  })
});
```

### Troubleshooting

#### Common Issues

1. **Invalid Token Errors**:
   - Verify JWKS endpoint accessibility
   - Check token expiration
   - Validate audience claims

2. **Authorization Failures**:
   - Confirm user roles in Keycloak
   - Verify organization membership
   - Check API endpoint permissions

3. **Keycloak Connection Issues**:
   - Validate KEYCLOAK_DOMAIN configuration
   - Check network connectivity
   - Verify SSL/TLS certificates

#### Debugging Tools

**Token Inspection:**

```bash
# Decode JWT token (development only)
echo "eyJ..." | base64 -d | jq .

# Test Keycloak connectivity
curl -X GET "${KEYCLOAK_DOMAIN}/realms/${REALM}/protocol/openid-connect/certs"
```

**API Testing:**

```bash
# Test authentication endpoint
curl -X POST localhost:5000/authz/user-login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'
```

This authentication and authorization system provides enterprise-grade security while maintaining flexibility for different client types and integration scenarios. The modular design allows for easy provider switching and supports both current and future authentication requirements.

## Onboarding Support Features

### Email Templates

The platform includes comprehensive email templates for:

- User registration verification (`URLUserEmailTemplate`)
- Organization invitation (`OrganizationInviteTemplate`)
- Password reset (`URLUserResetPasswordTemplate`)
- Credential verification requests (`OutOfBandVerification`)
- Organization onboarding notifications (`OnBoardVerificationRequest`)
- User onboarding notifications (`OnBoardUserRequest`)

### User Management Features

- Email-based user registration with verification codes
- Keycloak integration for identity management
- Role-based access control with organization-specific roles
- User invitation system with acceptance/rejection workflows
- Profile management with public/private settings
- FIDO/WebAuthn support for passwordless authentication

### Administrative Tools

- Organization dashboard with user management
- Invitation tracking and status monitoring
- Role assignment interface with Keycloak integration
- User activity logging and audit trails
- Platform configuration management

### Security Features

- Mandatory email verification for all users
- Role-based access control with Keycloak
- Encrypted password storage and client credentials
- Session management and token-based authentication
- Audit logging for all user activities
- Secure credential exchange via agents

## Integration Capabilities

### APIs

- RESTful APIs for all major functions
- Comprehensive OpenAPI/Swagger documentation
- Webhook support for real-time notifications
- Bulk operation APIs

### Standards Compliance

- W3C Verifiable Credentials
- DIF Presentation Exchange
- Aries Interop Profiles
- OpenID for Verifiable Credentials

### Development Support

- SDK availability
- Code samples
- Postman collections
- Development environments

This comprehensive guide covers all major aspects of the CREDEBL platform, focusing on the different user roles and their respective onboarding processes. The platform is designed to provide a smooth, role-appropriate experience for all users while maintaining security and functionality standards.

## External Integrations

CREDEBL requires several external services and infrastructures to function properly. This section outlines all required integrations and provides practical setup guidance.

### Core Infrastructure Dependencies

#### 1. Message Queue - NATS

**Purpose**: Inter-service communication and event streaming
**Configuration**:

- Main port: 4222
- Cluster port: 6222
- HTTP monitoring: 8222
- WebSocket support: 443 (no TLS)
- Max payload: 4MB

**Setup**:

```bash
# Using Docker
docker run -d --name nats-server -p 4222:4222 -p 6222:6222 -p 8222:8222 nats

# Or using configuration file
docker run -d --name nats-server -p 4222:4222 -p 6222:6222 -p 8222:8222 \
  -v ./nats-server.conf:/nats-server.conf \
  nats '/nats-server -c /nats-server.conf -DV'
```

**Environment Variables**:

```bash
# Service-specific NATS keys
ORGANIZATION_NKEY_SEED=<organization_service_nkey>
CONNECTION_NKEY_SEED=<connection_service_nkey>
ISSUANCE_NKEY_SEED=<issuance_service_nkey>
VERIFICATION_NKEY_SEED=<verification_service_nkey>
LEDGER_NKEY_SEED=<ledger_service_nkey>
```

#### 2. Caching - Redis

**Purpose**: Session management, caching, and temporary data storage
**Configuration**:

- Port: 6379
- Persistence: 20 second intervals
- Log level: warning

**Setup**:

```bash
# Using Docker
docker run -d --name redis -p 6379:6379 redis:6.2-alpine \
  redis-server --save 20 1 --loglevel warning
```

**Environment Variables**:

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=<optional_password>
```

#### 3. Database - PostgreSQL

**Purpose**: Primary application database using Prisma ORM
**Requirements**: PostgreSQL 12+

**Setup**:

```bash
# Using Docker
docker run -d --name postgres \
  -e POSTGRES_DB=credebl \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=<password> \
  -p 5432:5432 postgres:13
```

**Environment Variables**:

```bash
DATABASE_URL="postgresql://postgres:<password>@localhost:5432/credebl"
```

### Authentication & Identity Management

#### 4. Keycloak

**Purpose**: OAuth 2.0/OpenID Connect authentication, user management, and realm administration
**Requirements**: Keycloak 18+

**Setup**:

```bash
# Using Docker
docker run -d --name keycloak \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=<admin_password> \
  -p 8080:8080 \
  quay.io/keycloak/keycloak:latest start-dev
```

**Environment Variables**:

```bash
KEYCLOAK_DOMAIN=http://localhost:8080/
KEYCLOAK_REALM=credebl
KEYCLOAK_CREDEBL_REALM=credebl
KEYCLOAK_MANAGEMENT_CLIENT_ID=<client_id>
KEYCLOAK_MANAGEMENT_CLIENT_SECRET=<client_secret>
```

**Configuration Steps**:

1. Create realm: `credebl`
2. Configure client for each organization
3. Set up realm roles: `mb-user`, `platform-admin`
4. Configure client roles: `owner`, `admin`, `issuer`, `verifier`, `member`
5. Set up user federation if needed

#### 5. Supabase (Optional)

**Purpose**: Alternative authentication provider and database
**Used for**: User authentication fallback when Keycloak is not available

**Setup**:

1. Create Supabase project at https://supabase.com
2. Get project URL and anon key
3. Configure authentication providers

**Environment Variables**:

```bash
SUPABASE_URL=<your_supabase_url>
SUPABASE_KEY=<your_supabase_anon_key>
```

### Cloud Services

#### 6. AWS Services

**Purpose**: File storage, email services, and cloud infrastructure
**Required Services**:

- S3: Document and file storage
- SES: Email notifications
- IAM: Access management

**Setup**:

1. Create AWS account
2. Set up IAM user with programmatic access
3. Configure S3 bucket for file storage
4. Set up SES for email delivery

**Environment Variables**:

```bash
AWS_ACCESS_KEY_ID=<access_key>
AWS_SECRET_ACCESS_KEY=<secret_key>
AWS_REGION=<aws_region>
AWS_S3_BUCKET_NAME=<bucket_name>
AWS_SES_REGION=<ses_region>
```

### Blockchain & Ledger Integration

#### 7. Hyperledger Indy Ledgers

**Purpose**: Credential schema and definition storage on distributed ledgers
**Supported Networks**:

- Sovrin (MainNet, TestNet, StagingNet)
- Indicio (MainNet, TestNet, DemoNet)
- BCovrin (TestNet)

**Configuration**:

- No direct setup required
- Configure through platform UI or API
- Requires network genesis files

**Environment Variables**:

```bash
LEDGER_TIMEOUT=30000
GENESIS_FILE_PATH=<path_to_genesis_files>
```

#### 8. Schema File Server

**Purpose**: W3C schema storage and retrieval for ledger-agnostic credentials
**Requirements**: Custom schema file server

**Setup**:
Deploy schema file server or use hosted version

**Environment Variables**:

```bash
SCHEMA_FILE_SERVER_URL=<schema_server_url>
SCHEMA_FILE_SERVER_TOKEN=<auth_token>
```

### Agent Infrastructure

#### 9. Hyperledger Aries Agents

**Purpose**: DID/credential protocol handling
**Types**:

- Dedicated agents: One per organization
- Shared agents: Multi-tenant

**Agent Requirements**:

- Hyperledger Aries Framework JavaScript (AFJ)
- Docker support for agent provisioning
- Secure key storage

**Environment Variables**:

```bash
AGENT_PROVISION_ENDPOINT=<agent_provisioning_url>
AGENT_ADMIN_URL=<agent_admin_url>
AGENT_WEBHOOK_URL=<webhook_endpoint>
```

### Notification Services

#### 10. Email Service

**Purpose**: User notifications, invitations, and alerts
**Options**:

- AWS SES (recommended)
- SMTP server
- SendGrid

**Environment Variables**:

```bash
EMAIL_FROM=<sender_email>
EMAIL_PROVIDER=aws|smtp|sendgrid
SMTP_HOST=<smtp_host>
SMTP_PORT=<smtp_port>
SMTP_USER=<smtp_user>
SMTP_PASS=<smtp_password>
```

### Security & Encryption

#### 11. Cryptographic Services

**Purpose**: Data encryption, password hashing, and secure key management

**Environment Variables**:

```bash
CRYPTO_PRIVATE_KEY=<encryption_key>
JWT_SECRET=<jwt_secret>
FIDO_RELYING_PARTY_ID=<fido_rp_id>
FIDO_RELYING_PARTY_NAME=<fido_rp_name>
```

### Development & Deployment

#### 12. Docker & Container Registry

**Purpose**: Application containerization and deployment
**Requirements**:

- Docker Engine
- Docker Compose
- Container registry (GitHub Container Registry used)

**Setup**:

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Environment Configuration

#### Complete Environment Setup

Create `.env` file with all required variables:

```bash
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/credebl"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Keycloak
KEYCLOAK_DOMAIN=http://localhost:8080/
KEYCLOAK_REALM=credebl
KEYCLOAK_MANAGEMENT_CLIENT_ID=<client_id>
KEYCLOAK_MANAGEMENT_CLIENT_SECRET=<client_secret>

# AWS
AWS_ACCESS_KEY_ID=<access_key>
AWS_SECRET_ACCESS_KEY=<secret_key>
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=<bucket_name>

# Supabase (optional)
SUPABASE_URL=<supabase_url>
SUPABASE_KEY=<supabase_key>

# Encryption
CRYPTO_PRIVATE_KEY=<encryption_key>
JWT_SECRET=<jwt_secret>

# Schema Server
SCHEMA_FILE_SERVER_URL=<schema_server_url>
SCHEMA_FILE_SERVER_TOKEN=<auth_token>

# NATS Keys
ORGANIZATION_NKEY_SEED=<nkey_seed>
CONNECTION_NKEY_SEED=<nkey_seed>
ISSUANCE_NKEY_SEED=<nkey_seed>
VERIFICATION_NKEY_SEED=<nkey_seed>
LEDGER_NKEY_SEED=<nkey_seed>

# Agent Configuration
AGENT_PROVISION_ENDPOINT=<agent_url>
AGENT_WEBHOOK_URL=<webhook_url>

# Email
EMAIL_FROM=<sender_email>
EMAIL_PROVIDER=aws
```

### Quick Start with Docker Compose

#### 1. Infrastructure Services

```bash
# Start core infrastructure
docker-compose -f docker-compose-dev.yml up -d nats redis

# Start database (if using external PostgreSQL)
docker-compose -f docker-compose-dev.yml up -d postgres
```

#### 2. Authentication Setup

```bash
# Start Keycloak
docker-compose -f docker-compose-dev.yml up -d keycloak

# Configure Keycloak realm and clients
# (Use Keycloak admin console at http://localhost:8080)
```

#### 3. Application Services

```bash
# Start all application services
docker-compose -f docker-compose-dev.yml up -d
```

### Troubleshooting Common Integration Issues

#### NATS Connection Issues

- Check port availability (4222, 6222, 8222)
- Verify NKEY seeds are properly configured
- Ensure proper network connectivity between services

#### Keycloak Authentication Issues

- Verify realm configuration
- Check client credentials
- Ensure proper redirect URLs
- Validate token expiration settings

#### Database Connection Issues

- Check PostgreSQL service status
- Verify connection string format
- Ensure database migrations are applied
- Check user permissions

#### AWS Integration Issues

- Verify IAM permissions
- Check region configuration
- Validate S3 bucket policies
- Ensure SES domain verification

### Monitoring & Health Checks

#### Service Health Endpoints

- NATS: `http://localhost:8222/varz`
- Redis: `redis-cli ping`
- Keycloak: `http://localhost:8080/health`
- Application: `http://localhost:5000/health`

#### Logging Configuration

```bash
# Enable debug logging
LOG_LEVEL=debug

# Service-specific logging
NATS_LOG_LEVEL=debug
REDIS_LOG_LEVEL=notice
```

### Security Considerations

#### Production Deployment

- Use TLS/SSL for all external communications
- Implement proper firewall rules
- Use secrets management for sensitive data
- Regular security updates for all dependencies
- Implement proper backup strategies
- Monitor for security vulnerabilities

#### Network Security

- Isolate services using Docker networks
- Use reverse proxy for external access
- Implement rate limiting
- Use WAF for web application protection

This comprehensive integration guide ensures all external dependencies are properly configured and integrated with the CREDEBL platform.
