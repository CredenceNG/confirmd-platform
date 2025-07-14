# Docker Compose Standardization Summary

This document summarizes the changes made to standardize all Docker Compose commands to use the development configuration file `docker-compose-dev.yml`.

## Changes Made

### 1. Updated Main Launch Script

**File:** `/scripts/launch-platform.sh`

- Changed all `docker-compose.dev.yml` references to `docker-compose-dev.yml`
- Updated all docker-compose commands to use the `-f docker-compose-dev.yml` flag
- Affects all service startup commands, status checks, and log commands

### 2. Updated Test Scripts

**File:** `/test-scripts/test-platform-admin-fix.sh`

- Changed `docker-compose ps` to `docker-compose -f docker-compose-dev.yml ps`

**File:** `/test-platform-admin.sh`

- Updated all container status checks to use `docker-compose -f docker-compose-dev.yml ps`
- Updated all `docker-compose exec` commands to use `docker-compose -f docker-compose-dev.yml exec`
- Updated all `docker-compose logs` commands to use `docker-compose -f docker-compose-dev.yml logs`

### 3. Updated Debug and Utility Scripts

**File:** `/scripts/quick-500-debug.sh`

- Changed restart command suggestions to use `docker-compose -f docker-compose-dev.yml`
- Updated error messages to reference the correct compose file

### 4. Updated Documentation

**File:** `/README.md`

- Changed reference from `docker-compose.yml` to `docker-compose-dev.yml` for development
- Updated startup command example

**File:** `/docs/README-Microservice.md`

- Changed "Production build" to "Development build" in Docker Compose section
- Updated all example commands to use `docker-compose -f docker-compose-dev.yml`
- Updated troubleshooting commands
- Updated service management commands
- Updated logging commands
- Updated scaling examples

**File:** `/docs/PLATFORM_FEATURES_AND_ONBOARDING.md`

- Updated Quick Start section to use `docker-compose-dev.yml`
- Changed all infrastructure and application service startup commands

### 5. File Structure

The workspace now has the following Docker Compose files:

- `docker-compose-dev.yml` - **Development environment (STANDARD)**
- `docker-compose.yml` - Production environment
- `docker-compose.dev.yml` - Duplicate file (should be removed)
- `docker-compose.nats.yml` - NATS-specific configuration
- `docker-compose.redis.yml` - Redis-specific configuration

## Development Environment Commands

### Basic Commands

```bash
# Start all services
docker-compose -f docker-compose-dev.yml up -d

# Stop all services
docker-compose -f docker-compose-dev.yml down

# View logs
docker-compose -f docker-compose-dev.yml logs -f

# Build and start
docker-compose -f docker-compose-dev.yml up --build

# Check service status
docker-compose -f docker-compose-dev.yml ps

# Restart specific service
docker-compose -f docker-compose-dev.yml restart [service-name]
```

### Service Management

```bash
# Start infrastructure services
docker-compose -f docker-compose-dev.yml up -d nats redis postgres

# Start application services
docker-compose -f docker-compose-dev.yml up -d api-gateway user organization

# Scale services
docker-compose -f docker-compose-dev.yml up -d --scale organization=3
```

### Debugging

```bash
# View service logs
docker-compose -f docker-compose-dev.yml logs -f [service-name]

# Execute commands in containers
docker-compose -f docker-compose-dev.yml exec [service-name] [command]

# View all service logs with timestamps
docker-compose -f docker-compose-dev.yml logs -f -t
```

## Important Notes

1. **Always use `-f docker-compose-dev.yml`** for development environment
2. **Use `docker-compose.yml`** only for production environment
3. **Scripts that are already correct:**
   - `quick-access.sh` - Already uses `docker-compose-dev.yml`
   - `FOLDER_STRUCTURE.md` - Already shows correct structure
   - `DOCKER_FIXES_SUMMARY.md` - Already references correct file

## Next Steps

1. Remove the duplicate `docker-compose.dev.yml` file
2. Update any remaining CI/CD scripts to use the correct compose file
3. Ensure all team members are aware of the standardized approach
4. Consider adding an alias or wrapper script for convenience

## Benefits

- **Consistency**: All development commands use the same compose file
- **Clarity**: Clear distinction between development and production environments
- **Maintainability**: Easier to update and maintain docker configurations
- **Documentation**: All documentation now references the correct files
- **Automation**: Scripts and tools work consistently across the platform
