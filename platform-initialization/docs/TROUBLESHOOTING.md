# Platform Initialization Troubleshooting Guide

Common issues and solutions during platform initialization.

## Database Issues

### Issue: "PostgreSQL container is not running"

**Error**: Scripts cannot connect to database

**Solution**:
```bash
# Check if container exists
docker ps -a | grep postgres

# Start services if stopped
docker compose -f docker-compose-dev.yml up -d postgres

# Check logs
docker logs confirmd-platform-postgres-1
```

### Issue: Migrations Not Applied

**Symptoms**: Missing tables, column errors

**Solution**:
```bash
# Check migration status
docker logs confirmd-platform-agent-provisioning-1 | grep migration

# If migrations failed, restart agent-provisioning
docker restart confirmd-platform-agent-provisioning-1

# Watch logs
docker logs -f confirmd-platform-agent-provisioning-1
```

### Issue: P3009 Migration Error

**Error**: "migrate found failed migrations in the target database"

**Solution**:
This should be fixed by the migration changes we made. If it still occurs:
```bash
# Check failed migrations
docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -c \
    "SELECT migration_name, started_at, finished_at FROM _prisma_migrations WHERE finished_at IS NULL;"

# Mark as resolved (replace migration_name)
docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -c \
    "UPDATE _prisma_migrations SET finished_at = NOW() WHERE migration_name = '<migration-name>';"
```

## Seeding Issues

### Issue: "Duplicate key value violates unique constraint"

**Error**: Data already exists during seeding

**Solution**:
The seed scripts use INSERT...ON CONFLICT for idempotency. If this error occurs:

```bash
# Check existing data
docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -c \
    "SELECT * FROM agents_type;"

# If data exists, seeding is already complete
# You can skip this step or clear and re-run:
docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -c \
    "DELETE FROM agents_type; DELETE FROM org_agents_type;"

# Re-run seed script
./platform-initialization/scripts/1-seed-database.sh
```

### Issue: Ledger Seeding Fails

**Error**: Cannot insert ledger data

**Solution**:
```bash
# Check if ledgers table exists
docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -c "\d ledgers"

# If table missing, migrations didn't run
# Restart agent-provisioning and wait for migrations
docker restart confirmd-platform-agent-provisioning-1
sleep 30

# Re-run seed
./platform-initialization/scripts/1-seed-database.sh
```

## Keycloak Issues

### Issue: Cannot Connect to Keycloak

**Error**: Connection refused or timeout

**Solution**:
```bash
# Check if Keycloak is running
curl https://manager.credence.ng/realms/confirmd-bench/.well-known/openid-configuration

# If external Keycloak, ensure it's accessible
# Check network connectivity and firewall rules
```

### Issue: Platform Admin User Not Found

**Error**: User doesn't exist in Keycloak

**Solution**:
1. Access Keycloak admin console: https://manager.credence.ng
2. Navigate to: Realms → confirmd-bench → Users
3. Search for: admin@getconfirmd.com
4. If not found, run: `../../scripts/create-platform-admin-user.sh`
5. Or create manually in Keycloak UI

### Issue: Authentication Returns 401

**Error**: Invalid credentials

**Solution**:
```bash
# Test authentication
curl -X POST "https://manager.credence.ng/realms/confirmd-bench/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=platform-admin" \
  -d "username=admin@getconfirmd.com" \
  -d "password=PlatformAdmin123!" \
  -d "scope=openid"

# If it fails:
# 1. Verify password in Keycloak admin console
# 2. Reset password if needed
# 3. Check user is enabled
# 4. Verify email is verified
```

## Platform Admin Setup Issues

### Issue: Organization Not Created

**Error**: No organization with ID f856e3a4-b09c-4356-82de-b105594eec43

**Solution**:
```bash
# Check if organization exists
docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -c \
    "SELECT * FROM organisation WHERE id = 'f856e3a4-b09c-4356-82de-b105594eec43';"

# If not found, run script 3
cd platform-initialization/scripts
./3-create-platform-admin.sh
```

### Issue: Agent Record Not Created

**Error**: No agent for platform admin organization

**Solution**:
```bash
# Check if agent exists
docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -c \
    "SELECT * FROM org_agents WHERE \"orgId\" = 'f856e3a4-b09c-4356-82de-b105594eec43';"

# If not found, check if required tables exist
docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -c \
    "SELECT agent FROM org_agents_type;"

# If org_agents_type is empty, run script 1 first
cd platform-initialization/scripts
./1-seed-database.sh

# Then run script 3
./3-create-platform-admin.sh
```

### Issue: API Token Encryption Fails

**Error**: Cannot encrypt API token

**Solution**:
```bash
# Check if agent-service is running
docker ps | grep agent-service

# Check if crypto-js is available
docker exec confirmd-platform-agent-service-1 node -e "console.log(require('crypto-js'))"

# Verify CRYPTO_PRIVATE_KEY in .env
grep CRYPTO_PRIVATE_KEY .env

# If missing, add to .env:
echo "CRYPTO_PRIVATE_KEY=dzIvVU5uMa0R3sYwdjEEuT4id17mPpjr" >> .env

# Restart agent-service
docker restart confirmd-platform-agent-service-1

# Re-run script 4
cd platform-initialization/scripts
./4-update-platform-token.sh "your-token"
```

## Service Issues

### Issue: Services Won't Start

**Error**: Containers exiting immediately

**Solution**:
```bash
# Check container status
docker compose -f docker-compose-dev.yml ps

# Check logs for failed service
docker logs confirmd-platform-<service-name>-1

# Common fixes:
# 1. Rebuild containers
docker compose -f docker-compose-dev.yml build --no-cache

# 2. Remove volumes and restart (WARNING: data loss)
docker compose -f docker-compose-dev.yml down -v
docker compose -f docker-compose-dev.yml up -d
```

### Issue: phoneNumber Column Error

**Error**: "column user.phoneNumber does not exist"

**Solution**:
This is fixed by the migration we created. If the error persists:

```bash
# Check if migration exists
ls libs/prisma-service/prisma/migrations/ | grep phone

# Check if column exists
docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -c \
    "\d \"user\"" | grep phoneNumber

# If missing, add manually
docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -c \
    "ALTER TABLE \"user\" ADD COLUMN IF NOT EXISTS \"phoneNumber\" VARCHAR(20);"

# Restart user service
docker restart confirmd-platform-user-1
```

## Permission Issues

### Issue: "Permission denied" Running Scripts

**Error**: Cannot execute shell scripts

**Solution**:
```bash
# Make scripts executable
chmod +x platform-initialization/scripts/*.sh

# Or run with bash explicitly
bash platform-initialization/scripts/run-all.sh
```

### Issue: Docker Permission Denied

**Error**: Cannot connect to Docker daemon

**Solution**:
```bash
# Ensure Docker Desktop is running

# On Linux, add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Restart Docker Desktop (Mac/Windows)
```

## Recovery Procedures

### Complete Reset (Nuclear Option)

**WARNING**: This deletes ALL platform data

```bash
# Stop all services
docker compose -f docker-compose-dev.yml down

# Remove volumes
docker volume rm confirmd-platform_postgres_data
docker volume rm confirmd-platform_minio_data
docker volume rm confirmd-platform_cache

# Remove containers
docker compose -f docker-compose-dev.yml rm -f

# Start fresh
docker compose -f docker-compose-dev.yml up -d

# Wait for migrations (check logs)
docker logs -f confirmd-platform-agent-provisioning-1

# Re-run initialization
cd platform-initialization/scripts
./run-all.sh
```

### Partial Reset (Keep Some Data)

**Reset just platform admin**:
```bash
# Delete platform admin records
docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -c "
DELETE FROM org_agents WHERE \"orgId\" = 'f856e3a4-b09c-4356-82de-b105594eec43';
DELETE FROM organisation WHERE id = 'f856e3a4-b09c-4356-82de-b105594eec43';
"

# Re-run platform admin setup
cd platform-initialization/scripts
./3-create-platform-admin.sh
./4-update-platform-token.sh "your-token"
```

## Getting Help

If issues persist:

1. Check service logs: `docker compose -f docker-compose-dev.yml logs`
2. Review documentation in `platform-initialization/docs/`
3. Check main docs in `docs/` directory
4. Verify `.env` configuration
5. Check Docker resources (memory, disk space)

## Diagnostic Commands

Run these to gather information for debugging:

```bash
# Service status
docker compose -f docker-compose-dev.yml ps

# Database status
docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -c \
    "SELECT datname, pg_size_pretty(pg_database_size(datname)) FROM pg_database;"

# Migration status
docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -c \
    "SELECT COUNT(*) as total,
     COUNT(CASE WHEN finished_at IS NOT NULL THEN 1 END) as completed
     FROM _prisma_migrations;"

# Platform admin status
docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -c "
SELECT 'User' as type, email FROM \"user\" WHERE email = 'admin@getconfirmd.com'
UNION ALL
SELECT 'Org', name FROM organisation WHERE id = 'f856e3a4-b09c-4356-82de-b105594eec43'
UNION ALL
SELECT 'Agent', \"walletName\" FROM org_agents WHERE \"orgId\" = 'f856e3a4-b09c-4356-82de-b105594eec43';
"
```
