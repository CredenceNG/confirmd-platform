# Confirmd Platform Initialization Guide

This directory contains all scripts and documentation needed to initialize the Confirmd Platform from scratch.

## Directory Structure

```
platform-initialization/
├── README.md                           # This file
├── docs/
│   ├── INITIALIZATION_CHECKLIST.md   # Step-by-step initialization guide
│   ├── PLATFORM_ADMIN_SETUP.md       # Platform admin setup details
│   └── TROUBLESHOOTING.md            # Common issues and solutions
├── scripts/
│   ├── 1-seed-database.sh            # Seed base data (agents, ledgers, roles)
│   ├── 2-setup-keycloak.sh           # Configure Keycloak authentication
│   ├── 3-create-platform-admin.sh    # Create platform admin org & agent
│   ├── 4-update-platform-token.js    # Auto-extract & update platform admin API token
│   └── run-all.sh                    # Run all initialization scripts
└── sql/
    ├── seed-agent-types.sql          # Agent type seed data
    ├── seed-ledgers.sql              # Ledger configurations
    └── create-platform-admin-org.sql # Platform admin organization
```

## Quick Start

### Prerequisites

1. Docker and Docker Compose running
2. All services started with `docker compose -f docker-compose-dev.yml up -d`
3. Database migrations completed (handled by agent-provisioning service)

### Full Initialization

Run all initialization steps in order:

```bash
cd platform-initialization
./scripts/run-all.sh
```

### Manual Step-by-Step

If you prefer to run steps individually:

```bash
# 1. Seed base database tables
./scripts/1-seed-database.sh

# 2. Setup Keycloak authentication
./scripts/2-setup-keycloak.sh

# 3. Create platform admin organization and agent
./scripts/3-create-platform-admin.sh

# 4. Update platform admin API token (auto-extracts from agent logs)
node ./scripts/4-update-platform-token.js

# Or provide token manually if auto-extraction fails:
node ./scripts/4-update-platform-token.js "your-new-api-token-here"
```

## Platform Admin Credentials

### Keycloak Login
- **Email**: admin@getconfirmd.com
- **Password**: PlatformAdmin123!
- **Keycloak User ID**: 1f7fafe5-9a0d-4f8e-9b60-d35f5b992973

### Platform Admin Organization
- **Org ID**: f856e3a4-b09c-4356-82de-b105594eec43
- **Name**: Platform Admin
- **Agent Endpoint**: Configured based on your setup

## What Gets Initialized

1. **Agent Types**: AFJ, ACAPY (for agent framework)
2. **Org Agent Types**: DEDICATED, SHARED
3. **Ledgers**: BCovrin testnet, Indicio networks
4. **User Roles**: DEFAULT_USER, HOLDER
5. **Keycloak**: Realm roles, platform admin client, user accounts
6. **Platform Admin**: Organization record, agent record, API token

## Important Notes

- Always run migrations before initialization (handled by agent-provisioning)
- Scripts are idempotent - safe to run multiple times
- Platform admin API token is automatically extracted from agent logs during initialization
- Token can be manually updated anytime with: `node ./scripts/4-update-platform-token.js`
- Keep track of your `.env` file - it contains critical configuration (especially `CRYPTO_PRIVATE_KEY`)

## Verification

After initialization, verify everything is working:

```bash
# Check database seeding
docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -c "
SELECT 'Agent Types' as check, COUNT(*) as count FROM agents_type
UNION ALL
SELECT 'Ledgers', COUNT(*) FROM ledgers
UNION ALL
SELECT 'User Roles', COUNT(*) FROM user_role
UNION ALL
SELECT 'Platform Admin Org', COUNT(*) FROM organisation WHERE id = 'f856e3a4-b09c-4356-82de-b105594eec43'
UNION ALL
SELECT 'Platform Admin Agent', COUNT(*) FROM org_agents WHERE \"orgId\" = 'f856e3a4-b09c-4356-82de-b105594eec43';
"

# Test Keycloak authentication
curl -X POST "https://manager.credence.ng/realms/confirmd-bench/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=platform-admin" \
  -d "username=admin@getconfirmd.com" \
  -d "password=PlatformAdmin123!" \
  -d "scope=openid"
```

## Support

For issues or questions, refer to:
- [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
- [PLATFORM_ADMIN_SETUP.md](docs/PLATFORM_ADMIN_SETUP.md)
