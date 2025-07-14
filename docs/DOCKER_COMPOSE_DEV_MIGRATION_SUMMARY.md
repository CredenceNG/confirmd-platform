# Docker Compose Development File Migration Summary

## Overview

This document summarizes the changes made to ensure all development operations use `docker-compose-dev.yml` instead of `docker-compose.yml` throughout the Confirmd Platform codebase.

## Changes Made

### 1. Documentation Updates

#### `/docs/AGENT_PROVISIONING_TROUBLESHOOTING.md`

- Updated all diagnostic commands to use `docker-compose -f docker-compose-dev.yml`
- Fixed references from `docker-compose.yml` to `docker-compose-dev.yml`
- Updated database connectivity tests, service health checks, and log retrieval commands

**Key Commands Updated:**

```bash
# Database diagnostics
docker-compose -f docker-compose-dev.yml exec confirmd-platform-postgres psql -U postgres -d platform_dev -c "SELECT * FROM agents WHERE label LIKE '%platform-admin%';"

# Service status checks
docker-compose -f docker-compose-dev.yml ps --format table

# Log monitoring
docker-compose -f docker-compose-dev.yml logs -f confirmd-platform-agent-provisioning
```

### 2. Script Updates

#### `/scripts/diagnose-agent-provisioning.sh`

- Updated file existence check to look for `docker-compose-dev.yml`
- Modified all `docker-compose` commands to include `-f docker-compose-dev.yml`
- Updated recommendations to use the development compose file

**Key Changes:**

```bash
# File check
if [ ! -f "docker-compose-dev.yml" ]; then
    print_status "ERROR" "docker-compose-dev.yml not found. Please run this script from the project root directory."
    exit 1
fi

# Service commands
docker-compose -f docker-compose-dev.yml exec -T confirmd-platform-postgres psql -U postgres -d platform_dev -c "SELECT 1;"
```

#### `/scripts/test-wallet-creation.sh`

- Updated error messages to reference `docker-compose-dev.yml`
- Modified startup recommendations

#### `/scripts/monitor-wallet-creation.sh`

- Updated service startup recommendations

#### `/scripts/test-wallet-flow.sh`

- Updated service startup recommendations

### 3. Rationale

The migration ensures:

1. **Consistency**: All development operations use the same Docker Compose file
2. **Isolation**: Development environment is separated from production configuration
3. **Maintainability**: Single source of truth for development container configuration
4. **Troubleshooting**: All diagnostic scripts target the correct environment

### 4. File Structure Clarity

```
├── 📄 docker-compose.yml          # Production environment
├── 📄 docker-compose-dev.yml      # Development environment ✅ PRIMARY FOR DEV
├── 📄 docker-compose.nats.yml     # NATS configuration
├── 📄 docker-compose.redis.yml    # Redis configuration
```

### 5. Updated Command Patterns

#### Before:

```bash
# Old commands
docker-compose up -d
docker-compose exec service-name command
docker-compose logs service-name
```

#### After:

```bash
# New development commands
docker-compose -f docker-compose-dev.yml up -d
docker-compose -f docker-compose-dev.yml exec service-name command
docker-compose -f docker-compose-dev.yml logs service-name
```

### 6. Environment-Specific Usage

#### Development (Local):

```bash
# Use docker-compose-dev.yml for all development operations
docker-compose -f docker-compose-dev.yml up -d postgres nats redis
docker-compose -f docker-compose-dev.yml up -d keycloak
docker-compose -f docker-compose-dev.yml up -d agent-service
```

#### Production:

```bash
# Use docker-compose.yml for production deployments
docker-compose up -d
```

## Benefits

1. **Clear Separation**: Development and production configurations are clearly separated
2. **Reduced Errors**: Eliminates confusion about which compose file to use
3. **Better Troubleshooting**: All diagnostic tools target the correct environment
4. **Consistent Documentation**: All guides reference the same development setup

## Verification

To verify the changes are working correctly:

1. **Run the diagnostic script:**

   ```bash
   ./scripts/diagnose-agent-provisioning.sh
   ```

2. **Check service status:**

   ```bash
   docker-compose -f docker-compose-dev.yml ps
   ```

3. **View logs:**
   ```bash
   docker-compose -f docker-compose-dev.yml logs -f confirmd-platform-agent-service
   ```

## Next Steps

1. Ensure all team members are aware of the change
2. Update any CI/CD pipelines that might reference the old commands
3. Consider adding a shell alias for convenience:
   ```bash
   alias dc-dev='docker-compose -f docker-compose-dev.yml'
   ```

## Related Documentation

- `/docs/PLATFORM_SETUP_GUIDE.md` - Already uses `docker-compose-dev.yml`
- `/docs/DOCKER_COMPOSE_STANDARDIZATION.md` - Documents the file separation
- `/docs/AGENT_PROVISIONING_TROUBLESHOOTING.md` - Updated with new commands
