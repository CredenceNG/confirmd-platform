# CREDEBL Platform - Production Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the CREDEBL SSI platform in production environments, including infrastructure setup, security configurations, and platform administrator onboarding.

## Prerequisites

### System Requirements

- **Operating System**: Ubuntu 20.04 LTS or CentOS 8+ (recommended)
- **CPU**: Minimum 8 cores, 16+ cores recommended
- **Memory**: Minimum 16GB RAM, 32GB+ recommended
- **Storage**: Minimum 100GB SSD, 500GB+ recommended
- **Network**: Static IP address, domain name with SSL certificate

### Software Dependencies

- Docker Engine 24.0+
- Docker Compose 2.20+
- Node.js 18+ (for local development/testing)
- PostgreSQL 13+ (external database)
- Redis 6.2+
- Keycloak 22+
- Nginx (reverse proxy)
- Certbot (SSL certificates)

## Infrastructure Setup

### 1. Server Preparation

#### Initial Server Setup

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget git unzip software-properties-common

# Create application user
sudo useradd -m -s /bin/bash credebl
sudo usermod -aG docker credebl
sudo usermod -aG sudo credebl
```

#### Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker
```

#### Configure Firewall

```bash
# Configure UFW firewall
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 5000/tcp  # API Gateway (internal)
sudo ufw allow 8080/tcp  # Keycloak (internal)
sudo ufw allow 5432/tcp  # PostgreSQL (internal)
sudo ufw allow 6379/tcp  # Redis (internal)
sudo ufw allow 4222/tcp  # NATS (internal)
sudo ufw --force enable
```

### 2. Database Setup

#### PostgreSQL Production Installation

```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Configure PostgreSQL
sudo -u postgres psql -c "CREATE DATABASE credebl;"
sudo -u postgres psql -c "CREATE USER credebl_user WITH PASSWORD 'secure_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE credebl TO credebl_user;"
sudo -u postgres psql -c "ALTER USER credebl_user CREATEDB;"

# Configure PostgreSQL for production
sudo nano /etc/postgresql/13/main/postgresql.conf
```

**PostgreSQL Configuration (`postgresql.conf`)**:

```ini
# Connection settings
listen_addresses = 'localhost'
port = 5432
max_connections = 200

# Memory settings
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB

# WAL settings
wal_level = replica
max_wal_senders = 3
wal_keep_segments = 32

# Logging
log_statement = 'all'
log_duration = on
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
```

#### Redis Production Setup

```bash
# Install Redis
sudo apt install -y redis-server

# Configure Redis for production
sudo nano /etc/redis/redis.conf
```

**Redis Configuration (`redis.conf`)**:

```ini
# Network
bind 127.0.0.1
port 6379
protected-mode yes

# Security
requirepass your_redis_password

# Memory management
maxmemory 2gb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000
```

### 3. Keycloak Production Setup

#### Keycloak Installation

```bash
# Create Keycloak directory
sudo mkdir -p /opt/keycloak
cd /opt/keycloak

# Download Keycloak
wget https://github.com/keycloak/keycloak/releases/download/22.0.1/keycloak-22.0.1.tar.gz
tar -xzf keycloak-22.0.1.tar.gz
sudo mv keycloak-22.0.1 keycloak
sudo chown -R credebl:credebl /opt/keycloak
```

#### Keycloak Configuration

```bash
# Create Keycloak configuration
sudo nano /opt/keycloak/keycloak/conf/keycloak.conf
```

**Keycloak Configuration (`keycloak.conf`)**:

```ini
# Database
db=postgres
db-username=keycloak_user
db-password=keycloak_password
db-url=jdbc:postgresql://localhost:5432/keycloak

# HTTP
http-enabled=true
http-port=8080
http-host=0.0.0.0

# HTTPS
https-port=8443
https-certificate-file=/etc/ssl/certs/keycloak.crt
https-certificate-key-file=/etc/ssl/private/keycloak.key

# Hostname
hostname=your-domain.com
hostname-strict=false
hostname-strict-https=false

# Proxy
proxy=edge
```

#### Keycloak Systemd Service

```bash
# Create systemd service file
sudo nano /etc/systemd/system/keycloak.service
```

**Keycloak Service (`keycloak.service`)**:

```ini
[Unit]
Description=Keycloak Identity Provider
After=network.target

[Service]
Type=simple
User=credebl
Group=credebl
WorkingDirectory=/opt/keycloak/keycloak
ExecStart=/opt/keycloak/keycloak/bin/kc.sh start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start Keycloak
sudo systemctl daemon-reload
sudo systemctl enable keycloak
sudo systemctl start keycloak
```

### 4. SSL Certificate Setup

#### Using Certbot for Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com -d keycloak.your-domain.com

# Set up automatic renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 5. Nginx Reverse Proxy Setup

#### Nginx Installation and Configuration

```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/credebl
```

**Nginx Configuration (`credebl`)**:

```nginx
# Main application
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

    # API Gateway proxy
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}

# Keycloak
server {
    listen 80;
    server_name keycloak.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name keycloak.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/keycloak.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/keycloak.your-domain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }
}
```

```bash
# Enable site and restart Nginx
sudo ln -s /etc/nginx/sites-available/credebl /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Production Environment Configuration

### 1. Environment Variables Setup

#### Create Production Environment File

```bash
# Create secure environment file
sudo nano /opt/credebl/.env.production
sudo chmod 600 /opt/credebl/.env.production
sudo chown credebl:credebl /opt/credebl/.env.production
```

**Production Environment Variables (`.env.production`)**:

```bash
# Environment
NODE_ENV=production
PORT=5000
LOG_LEVEL=info

# Database
DATABASE_URL="postgresql://credebl_user:secure_password@localhost:5432/credebl"
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=credebl_user
DATABASE_PASSWORD=secure_password
DATABASE_NAME=credebl

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Keycloak
KEYCLOAK_DOMAIN=https://keycloak.your-domain.com/
KEYCLOAK_ADMIN_URL=https://keycloak.your-domain.com/admin
KEYCLOAK_REALM=credebl
KEYCLOAK_CREDEBL_REALM=credebl
KEYCLOAK_MASTER_REALM=master
KEYCLOAK_MANAGEMENT_CLIENT_ID=admin-cli
KEYCLOAK_MANAGEMENT_CLIENT_SECRET=your_management_secret

# AWS Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=credebl-production-bucket
AWS_SES_REGION=us-east-1

# Security
CRYPTO_PRIVATE_KEY=your_32_character_encryption_key
JWT_SECRET=your_jwt_secret_key
FIDO_RELYING_PARTY_ID=your-domain.com
FIDO_RELYING_PARTY_NAME="CREDEBL Platform"

# Email Configuration
EMAIL_FROM=noreply@your-domain.com
EMAIL_PROVIDER=aws
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=true

# Schema Server
SCHEMA_FILE_SERVER_URL=https://schema-server.your-domain.com
SCHEMA_FILE_SERVER_TOKEN=your_schema_server_token

# NATS Configuration
NATS_URL=nats://localhost:4222
ORGANIZATION_NKEY_SEED=your_organization_nkey_seed
CONNECTION_NKEY_SEED=your_connection_nkey_seed
ISSUANCE_NKEY_SEED=your_issuance_nkey_seed
VERIFICATION_NKEY_SEED=your_verification_nkey_seed
LEDGER_NKEY_SEED=your_ledger_nkey_seed
AGENT_PROVISIONING_NKEY_SEED=your_agent_provisioning_nkey_seed
AGENT_SERVICE_NKEY_SEED=your_agent_service_nkey_seed
CLOUD_WALLET_NKEY_SEED=your_cloud_wallet_nkey_seed
NOTIFICATION_NKEY_SEED=your_notification_nkey_seed
WEBHOOK_NKEY_SEED=your_webhook_nkey_seed
UTILITY_NKEY_SEED=your_utility_nkey_seed
GEOLOCATION_NKEY_SEED=your_geolocation_nkey_seed

# Agent Configuration
AGENT_PROVISION_ENDPOINT=http://localhost:7001
AGENT_WEBHOOK_URL=https://your-domain.com/webhooks
AGENT_ADMIN_URL=http://localhost:8021

# Platform Configuration
PLATFORM_NAME="CREDEBL Platform"
PLATFORM_URL=https://your-domain.com
PLATFORM_ADMIN_EMAIL=admin@your-domain.com
PLATFORM_SUPPORT_EMAIL=support@your-domain.com

# Monitoring
HEALTH_CHECK_INTERVAL=30000
METRICS_ENABLED=true
AUDIT_LOG_ENABLED=true
```

### 2. Production Docker Compose Configuration

#### Create Production Docker Compose File

```bash
# Create production docker-compose file
sudo nano /opt/credebl/docker-compose.production.yml
```

**Production Docker Compose (`docker-compose.production.yml`)**:

```yaml
version: '3.8'

services:
  # Core Infrastructure
  nats:
    image: nats:2.9-alpine
    container_name: credebl-nats
    ports:
      - '4222:4222'
      - '6222:6222'
      - '8222:8222'
    volumes:
      - ./nats-server.conf:/nats-server.conf
    command: ['-c', '/nats-server.conf']
    restart: unless-stopped
    networks:
      - credebl-network

  redis:
    image: redis:7-alpine
    container_name: credebl-redis
    ports:
      - '6379:6379'
    volumes:
      - redis-data:/data
      - ./redis.conf:/usr/local/etc/redis/redis.conf
    command: redis-server /usr/local/etc/redis/redis.conf
    restart: unless-stopped
    networks:
      - credebl-network

  # Application Services
  seed:
    image: ghcr.io/credebl/seed:latest
    container_name: credebl-seed
    env_file:
      - .env.production
    volumes:
      - ./libs/prisma-service/prisma/data/credebl-master-table.json:/app/libs/prisma-service/prisma/data/credebl-master-table.json
    depends_on:
      - nats
    networks:
      - credebl-network
    restart: unless-stopped

  api-gateway:
    image: ghcr.io/credebl/api-gateway:latest
    container_name: credebl-api-gateway
    ports:
      - '5000:5000'
    env_file:
      - .env.production
    depends_on:
      - nats
      - redis
    networks:
      - credebl-network
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:5000/health']
      interval: 30s
      timeout: 10s
      retries: 3

  user:
    image: ghcr.io/credebl/user:latest
    container_name: credebl-user
    env_file:
      - .env.production
    depends_on:
      - nats
      - api-gateway
    networks:
      - credebl-network
    restart: unless-stopped

  organization:
    image: ghcr.io/credebl/organization:latest
    container_name: credebl-organization
    env_file:
      - .env.production
    depends_on:
      - nats
      - api-gateway
      - user
    networks:
      - credebl-network
    restart: unless-stopped

  utility:
    image: ghcr.io/credebl/utility:latest
    container_name: credebl-utility
    env_file:
      - .env.production
    depends_on:
      - nats
      - api-gateway
    networks:
      - credebl-network
    restart: unless-stopped

  connection:
    image: ghcr.io/credebl/connection:latest
    container_name: credebl-connection
    env_file:
      - .env.production
    depends_on:
      - nats
      - api-gateway
      - utility
      - user
    networks:
      - credebl-network
    restart: unless-stopped

  issuance:
    image: ghcr.io/credebl/issuance:latest
    container_name: credebl-issuance
    env_file:
      - .env.production
    depends_on:
      - nats
      - api-gateway
      - user
      - connection
    networks:
      - credebl-network
    restart: unless-stopped

  verification:
    image: ghcr.io/credebl/verification:latest
    container_name: credebl-verification
    env_file:
      - .env.production
    depends_on:
      - nats
      - api-gateway
      - user
      - connection
      - issuance
    networks:
      - credebl-network
    restart: unless-stopped

  ledger:
    image: ghcr.io/credebl/ledger:latest
    container_name: credebl-ledger
    env_file:
      - .env.production
    depends_on:
      - nats
      - api-gateway
      - user
      - connection
      - issuance
    networks:
      - credebl-network
    restart: unless-stopped

  agent-provisioning:
    image: ghcr.io/credebl/agent-provisioning:latest
    container_name: credebl-agent-provisioning
    env_file:
      - .env.production
    volumes:
      - ./apps/agent-provisioning/AFJ/agent-config:/app/agent-provisioning/AFJ/agent-config
      - /var/run/docker.sock:/var/run/docker.sock
      - ./agent.env:/app/agent.env
    depends_on:
      - nats
      - api-gateway
      - ledger
      - organization
    networks:
      - credebl-network
    restart: unless-stopped

  agent-service:
    image: ghcr.io/credebl/agent-service:latest
    container_name: credebl-agent-service
    env_file:
      - .env.production
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    volumes_from:
      - agent-provisioning
    depends_on:
      - nats
      - api-gateway
      - agent-provisioning
    networks:
      - credebl-network
    restart: unless-stopped

  cloud-wallet:
    image: ghcr.io/credebl/cloud-wallet:latest
    container_name: credebl-cloud-wallet
    env_file:
      - .env.production
    depends_on:
      - nats
      - api-gateway
    networks:
      - credebl-network
    restart: unless-stopped

  notification:
    image: ghcr.io/credebl/notification:latest
    container_name: credebl-notification
    env_file:
      - .env.production
    depends_on:
      - nats
      - api-gateway
    networks:
      - credebl-network
    restart: unless-stopped

  webhook:
    image: ghcr.io/credebl/webhook:latest
    container_name: credebl-webhook
    env_file:
      - .env.production
    depends_on:
      - nats
      - api-gateway
    networks:
      - credebl-network
    restart: unless-stopped

  geolocation:
    image: ghcr.io/credebl/geolocation:latest
    container_name: credebl-geolocation
    env_file:
      - .env.production
    depends_on:
      - nats
      - api-gateway
    networks:
      - credebl-network
    restart: unless-stopped

  schema-file-server:
    image: ghcr.io/credebl/schema-file-server:latest
    container_name: credebl-schema-file-server
    env_file:
      - .env.production
    networks:
      - credebl-network
    restart: unless-stopped

networks:
  credebl-network:
    driver: bridge

volumes:
  redis-data:
  postgres-data:
  agent-config:
```

## Platform Administrator Onboarding

### 1. Initial Setup and Configuration

#### Step 1: Access Keycloak Admin Console

1. Navigate to `https://keycloak.your-domain.com/admin`
2. Login with the master admin credentials set during Keycloak installation
3. Create the `credebl` realm if not already created

#### Step 2: Configure Master Client for Platform Management

```bash
# Create master client configuration
curl -X POST https://keycloak.your-domain.com/admin/realms/credebl/clients \
  -H "Authorization: Bearer $MASTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "platform-admin-client",
    "name": "Platform Administration Client",
    "description": "Client for platform administration",
    "enabled": true,
    "clientAuthenticatorType": "client-secret",
    "secret": "platform-admin-secret",
    "standardFlowEnabled": true,
    "directAccessGrantsEnabled": true,
    "serviceAccountsEnabled": true,
    "publicClient": false,
    "attributes": {
      "saml.assertion.signature": "false",
      "saml.force.post.binding": "false",
      "saml.multivalued.roles": "false",
      "saml.encrypt": "false",
      "saml.server.signature": "false",
      "saml.server.signature.keyinfo.ext": "false",
      "exclude.session.state.from.auth.response": "false",
      "saml_force_name_id_format": "false",
      "saml.client.signature": "false",
      "tls.client.certificate.bound.access.tokens": "false",
      "saml.authnstatement": "false",
      "display.on.consent.screen": "false",
      "saml.onetimeuse.condition": "false"
    }
  }'
```

#### Step 3: Create Platform Admin Role

```bash
# Create platform-admin role
curl -X POST https://keycloak.your-domain.com/admin/realms/credebl/roles \
  -H "Authorization: Bearer $MASTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "platform-admin",
    "description": "Platform Administrator Role",
    "composite": false,
    "clientRole": false,
    "containerId": "credebl"
  }'
```

### 2. Platform Admin User Creation

#### Step 1: Create Platform Admin User in Keycloak

1. Access Keycloak Admin Console
2. Navigate to `Users` → `Add User`
3. Fill in the following details:
   - **Username**: `platform-admin`
   - **Email**: `admin@your-domain.com`
   - **First Name**: `Platform`
   - **Last Name**: `Administrator`
   - **Email Verified**: `ON`
   - **Enabled**: `ON`

#### Step 2: Set Platform Admin Password

1. Go to `Credentials` tab
2. Set password: `SecurePlatformAdmin123!`
3. Set `Temporary`: `OFF`

#### Step 3: Assign Platform Admin Role

1. Go to `Role Mappings` tab
2. Select `platform-admin` from Available Roles
3. Click `Add selected`

### 3. Platform Admin Registration in CREDEBL

#### Step 1: Register Platform Admin User

Use the following API call to register the platform admin user:

```bash
curl -X POST https://your-domain.com/authz/user-registration \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@your-domain.com",
    "firstName": "Platform",
    "lastName": "Administrator",
    "password": "SecurePlatformAdmin123!",
    "isHolder": false,
    "isPlatformAdmin": true,
    "keycloakUserId": "keycloak-user-id-from-keycloak"
  }'
```

#### Step 2: Verify Email (if required)

If email verification is enabled, verify the admin email:

```bash
curl -X POST https://your-domain.com/authz/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@your-domain.com",
    "verificationCode": "verification-code-from-email"
  }'
```

#### Step 3: Platform Admin Login

```bash
curl -X POST https://your-domain.com/authz/user-login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@your-domain.com",
    "password": "SecurePlatformAdmin123!"
  }'
```

Expected response:

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 36000,
  "user": {
    "id": "platform-admin-user-id",
    "email": "admin@your-domain.com",
    "firstName": "Platform",
    "lastName": "Administrator",
    "roles": ["platform-admin"]
  }
}
```

### 4. Platform Admin Capabilities

#### Platform-Wide Management

The platform admin has access to the following capabilities:

1. **User Management**

   - View all users across all organizations
   - Disable/enable user accounts
   - Reset user passwords
   - Manage user roles

2. **Organization Management**

   - View all organizations
   - Create/update/delete organizations
   - Manage organization settings
   - View organization analytics

3. **System Configuration**

   - Manage ledger configurations
   - Configure email templates
   - Set platform-wide policies
   - Monitor system health

4. **Agent Management**
   - View all provisioned agents
   - Monitor agent health
   - Manage agent configurations
   - Access agent logs

#### Platform Admin API Access

Use the admin token to access platform-wide APIs:

```bash
# Get all organizations
curl -X GET https://your-domain.com/orgs \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Get all users
curl -X GET https://your-domain.com/users \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Get system health
curl -X GET https://your-domain.com/health \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Get platform statistics
curl -X GET https://your-domain.com/admin/statistics \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 5. Platform Admin Dashboard Access

#### Web Dashboard (if available)

1. Navigate to `https://your-domain.com/admin`
2. Login with platform admin credentials
3. Access the following sections:
   - **Dashboard**: Platform overview and statistics
   - **Users**: User management across all organizations
   - **Organizations**: Organization management
   - **Agents**: Agent monitoring and management
   - **Ledgers**: Ledger configuration and monitoring
   - **System**: System health and configuration
   - **Logs**: System logs and audit trails

#### API Documentation

Access the complete API documentation at:

- **Swagger UI**: `https://your-domain.com/api/docs`
- **OpenAPI Spec**: `https://your-domain.com/api/docs-json`

## Production Deployment

### 1. Pre-Deployment Checklist

#### Infrastructure Readiness

- [ ] Server meets minimum requirements
- [ ] Domain name configured with DNS
- [ ] SSL certificates installed
- [ ] Database server configured and accessible
- [ ] Redis server configured and accessible
- [ ] Keycloak configured and accessible
- [ ] Nginx reverse proxy configured
- [ ] Firewall rules configured
- [ ] Environment variables configured
- [ ] Docker and Docker Compose installed

#### Security Checklist

- [ ] All default passwords changed
- [ ] Database credentials secured
- [ ] API keys and secrets configured
- [ ] SSL/TLS certificates valid
- [ ] Security headers configured
- [ ] Backup strategy implemented
- [ ] Monitoring configured
- [ ] Log rotation configured

### 2. Deployment Steps

#### Step 1: Clone Repository

```bash
sudo -u credebl git clone https://github.com/credebl/platform.git /opt/credebl
cd /opt/credebl
```

#### Step 2: Configure Environment

```bash
# Copy production environment file
cp .env.production.example .env.production

# Update environment variables
nano .env.production

# Set proper permissions
chmod 600 .env.production
```

#### Step 3: Initialize Database

```bash
# Run database migrations
docker-compose -f docker-compose.production.yml run --rm seed

# Verify database setup
docker-compose -f docker-compose.production.yml run --rm api-gateway npm run db:verify
```

#### Step 4: Deploy Services

```bash
# Deploy all services
docker-compose -f docker-compose.production.yml up -d

# Verify deployment
docker-compose -f docker-compose.production.yml ps
```

#### Step 5: Health Checks

```bash
# Check service health
curl -f https://your-domain.com/health

# Check individual service health
docker-compose -f docker-compose.production.yml logs api-gateway
docker-compose -f docker-compose.production.yml logs user
docker-compose -f docker-compose.production.yml logs organization
```

### 3. Post-Deployment Configuration

#### Step 1: Configure Keycloak Realm

1. Access Keycloak admin console
2. Create `credebl` realm
3. Configure realm settings:
   - **Login**: Enable user registration, remember me, reset password
   - **Keys**: Configure RSA256 key for token signing
   - **Tokens**: Set token lifespans (access: 10 hours, refresh: 30 days)
   - **Security Defenses**: Enable brute force protection

#### Step 2: Configure Email Settings

1. In Keycloak admin console, go to `Realm Settings` → `Email`
2. Configure SMTP settings:
   - **Host**: Your SMTP server (e.g., AWS SES)
   - **Port**: 587 (for TLS)
   - **From**: `noreply@your-domain.com`
   - **Enable SSL**: Yes
   - **Enable Authentication**: Yes
   - **Username/Password**: Your SMTP credentials

#### Step 3: Create Platform Admin

Follow the Platform Administrator Onboarding steps above.

## Monitoring and Maintenance

### 1. System Monitoring

#### Health Check Endpoints

- **API Gateway**: `https://your-domain.com/health`
- **Keycloak**: `https://keycloak.your-domain.com/health`
- **NATS**: `http://localhost:8222/varz`
- **Redis**: `redis-cli ping`

#### Log Management

```bash
# View application logs
docker-compose -f docker-compose.production.yml logs -f api-gateway

# View system logs
sudo journalctl -u keycloak -f
sudo journalctl -u postgresql -f
sudo journalctl -u redis -f
```

#### Performance Monitoring

```bash
# Monitor container resources
docker stats

# Monitor system resources
htop
iostat -x 1
```

### 2. Backup Strategy

#### Database Backup

```bash
# Create backup script
sudo nano /opt/credebl/scripts/backup-database.sh
```

**Database Backup Script (`backup-database.sh`)**:

```bash
#!/bin/bash
BACKUP_DIR="/opt/credebl/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/credebl_backup_$DATE.sql"

mkdir -p $BACKUP_DIR

pg_dump -h localhost -U credebl_user -d credebl > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Remove backups older than 7 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Database backup completed: $BACKUP_FILE.gz"
```

```bash
# Make script executable
chmod +x /opt/credebl/scripts/backup-database.sh

# Add to crontab for daily backups
sudo crontab -e
# Add: 0 2 * * * /opt/credebl/scripts/backup-database.sh
```

#### Application Backup

```bash
# Create application backup script
sudo nano /opt/credebl/scripts/backup-application.sh
```

**Application Backup Script (`backup-application.sh`)**:

```bash
#!/bin/bash
BACKUP_DIR="/opt/credebl/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/credebl_app_backup_$DATE.tar.gz"

mkdir -p $BACKUP_DIR

# Create application backup
tar -czf $BACKUP_FILE \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='logs' \
  --exclude='backups' \
  /opt/credebl/

# Remove backups older than 30 days
find $BACKUP_DIR -name "credebl_app_backup_*.tar.gz" -mtime +30 -delete

echo "Application backup completed: $BACKUP_FILE"
```

### 3. Security Updates

#### System Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Docker images
docker-compose -f docker-compose.production.yml pull
docker-compose -f docker-compose.production.yml up -d
```

#### Security Scanning

```bash
# Scan for vulnerabilities
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  -v /opt/credebl:/app aquasec/trivy fs /app

# Check SSL certificate
openssl s_client -connect your-domain.com:443 -servername your-domain.com
```

### 4. Troubleshooting

#### Common Issues

1. **Service Not Starting**

   - Check Docker logs: `docker-compose logs servicename`
   - Check environment variables
   - Verify database connectivity
   - Check port conflicts

2. **Database Connection Issues**

   - Verify PostgreSQL is running
   - Check connection string in `.env.production`
   - Verify database user permissions
   - Check firewall rules

3. **Authentication Issues**

   - Verify Keycloak is accessible
   - Check realm configuration
   - Verify client credentials
   - Check token expiration

4. **Performance Issues**
   - Monitor resource usage
   - Check database performance
   - Verify Redis connectivity
   - Check NATS message queue

#### Emergency Procedures

1. **Service Restart**

   ```bash
   docker-compose -f docker-compose.production.yml restart
   ```

2. **Database Recovery**

   ```bash
   # Restore from backup
   gunzip -c /opt/credebl/backups/credebl_backup_YYYYMMDD_HHMMSS.sql.gz | \
   psql -h localhost -U credebl_user -d credebl
   ```

3. **Emergency Platform Admin Access**
   ```bash
   # Create emergency admin user directly in database
   psql -h localhost -U credebl_user -d credebl -c "
   UPDATE users SET roles = ARRAY['platform-admin'] WHERE email = 'emergency@your-domain.com';
   "
   ```

## Conclusion

This production deployment guide provides comprehensive instructions for setting up and maintaining a production CREDEBL platform deployment. Follow all security best practices, maintain regular backups, and monitor system health for optimal performance.

For additional support, consult the platform documentation or contact the CREDEBL support team.
