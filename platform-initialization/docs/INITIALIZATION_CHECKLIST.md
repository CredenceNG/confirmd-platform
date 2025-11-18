# Platform Initialization Checklist

Use this checklist to ensure all platform components are properly initialized.

## Pre-Initialization

- [ ] Docker Desktop running
- [ ] All services started: `docker compose -f docker-compose-dev.yml up -d`
- [ ] Database migrations completed (check agent-provisioning logs)
- [ ] `.env` file configured with correct values
- [ ] Keycloak instance accessible (if external)

## Initialization Steps

### Step 1: Database Seeding ✓

- [ ] Run: `./scripts/1-seed-database.sh`
- [ ] Verify agent types created (AFJ, ACAPY)
- [ ] Verify org agent types created (DEDICATED, SHARED)
- [ ] Verify ledgers seeded (bcovrin:testnet, indicio networks)
- [ ] Verify user roles created (DEFAULT_USER, HOLDER)

**Verification Command:**
```bash
docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -c "
SELECT 'Agent Types' as check, COUNT(*) FROM agents_type
UNION ALL SELECT 'Ledgers', COUNT(*) FROM ledgers
UNION ALL SELECT 'User Roles', COUNT(*) FROM user_role;"
```

Expected: At least 2 agent types, 3-4 ledgers, 2 user roles

### Step 2: Keycloak Setup ✓

- [ ] Run: `./scripts/2-setup-keycloak.sh`
- [ ] Verify realm `confirmd-bench` exists
- [ ] Verify client `platform-admin` created
- [ ] Verify user `admin@getconfirmd.com` exists
- [ ] Verify `platform_admin` role assigned
- [ ] Test authentication with credentials

**Verification Command:**
```bash
curl -X POST "https://manager.credence.ng/realms/confirmd-bench/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=platform-admin" \
  -d "username=admin@getconfirmd.com" \
  -d "password=PlatformAdmin123!" \
  -d "scope=openid"
```

Expected: JSON response with `access_token`

### Step 3: Platform Admin Organization ✓

- [ ] Run: `./scripts/3-create-platform-admin.sh`
- [ ] Verify organization created with ID: `f856e3a4-b09c-4356-82de-b105594eec43`
- [ ] Verify org_agents record created
- [ ] Note: API token is placeholder at this stage

**Verification Command:**
```bash
docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -c "
SELECT COUNT(*) FROM organisation WHERE id = 'f856e3a4-b09c-4356-82de-b105594eec43';
SELECT COUNT(*) FROM org_agents WHERE \"orgId\" = 'f856e3a4-b09c-4356-82de-b105594eec43';"
```

Expected: 1 organization, 1 agent

### Step 4: Platform Admin API Token ✓

- [ ] Run: `node ./scripts/4-update-platform-token.js` (auto-extracts token from agent logs)
- [ ] Verify token encrypted and stored
- [ ] Verify agent endpoint configured

**Note:** The script automatically extracts the JWT token from platform-admin-agent container logs.
If auto-extraction fails, you can provide the token manually:
```bash
node ./scripts/4-update-platform-token.js "your-jwt-token"
```

**Verification Command:**
```bash
docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -c "
SELECT \"walletName\", \"agentEndPoint\", LEFT(\"apiKey\", 20)
FROM org_agents WHERE \"orgId\" = 'f856e3a4-b09c-4356-82de-b105594eec43';"
```

Expected: wallet name, endpoint, and encrypted API key present

## Post-Initialization

### Service Health Checks

- [ ] All containers running: `docker ps --filter "name=confirmd-platform"`
- [ ] No error logs: `docker compose -f docker-compose-dev.yml logs --tail=50`
- [ ] Database accessible
- [ ] API Gateway responding: `curl http://localhost:5000/health`

### Platform Admin User

- [ ] Platform admin user exists in database
- [ ] User has Keycloak ID populated
- [ ] User has client credentials
- [ ] User can authenticate via Keycloak

**Verification Command:**
```bash
docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -c "
SELECT email, \"keycloakUserId\", \"clientId\"
FROM \"user\" WHERE email = 'admin@getconfirmd.com';"
```

### Platform Admin Organization

- [ ] Organization record exists
- [ ] Agent record linked to organization
- [ ] API key encrypted and stored
- [ ] Agent endpoint configured

## Troubleshooting

If any step fails, refer to:
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- [PLATFORM_ADMIN_SETUP.md](PLATFORM_ADMIN_SETUP.md)
- Platform logs: `docker compose -f docker-compose-dev.yml logs`

## Rollback

If you need to start over:

```bash
# Stop all services
docker compose -f docker-compose-dev.yml down

# Remove volumes (WARNING: This deletes ALL data)
docker volume rm confirmd-platform_postgres_data

# Restart services
docker compose -f docker-compose-dev.yml up -d

# Wait for migrations to complete, then re-run initialization
./scripts/run-all.sh
```

## Success Criteria

✅ All initialization scripts completed without errors
✅ All verification commands return expected results
✅ Platform admin can authenticate via Keycloak
✅ All services running and healthy
✅ No error logs in recent container output

**Platform is ready for use!** 🎉
