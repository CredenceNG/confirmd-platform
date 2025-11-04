# Platform Admin Agent

This directory contains the Docker Compose configuration for the platform admin agent with environment variable support.

## Files

- `docker-compose.yml` - Main compose configuration
- `.env` - Environment variables (copy and customize)
- `config.master.json` - Master configuration template (protected from overwrites)
- `config.json` - Working configuration (may be overwritten by agent)
- `startup.sh` - Startup script that restores config from master template
- `README.md` - This documentation

## Setup

### 1. Configure Environment Variables

Copy and customize the `.env` file:
```bash
cp .env .env.local  # Optional: use .env.local for local overrides
```

Key variables to customize:
- `AGENT_ENDPOINT_HTTP` & `AGENT_ENDPOINT_WSS` - Your domain endpoints
- `WALLET_PASSWORD` & `WALLET_KEY` - Secure passwords
- `WEBHOOK_URL` - Webhook endpoint for the platform

### 2. Database Setup

Choose your database deployment mode:

**Option A: Use existing platform database (default/recommended)**
- Uses the existing `confirmd-platform-postgres-1` container  
- Database `platform-admin` will be created automatically
- No additional PostgreSQL container needed

**Option B: Use standalone database**
- Deploys a dedicated PostgreSQL container for the agent
- Useful for isolated testing or separate environments
- Uses port 5433 to avoid conflicts

## Usage

### Deployment Modes

**Mode 1: With existing platform database (default)**
```bash
# Default mode - uses external postgres
docker-compose up -d

# The override file automatically removes postgres dependency
```

**Mode 2: Standalone with dedicated database**
```bash  
# Use standalone compose file
docker-compose -f docker-compose.yml -f docker-compose.standalone.yml up -d

# Or using profiles (alternative approach)
docker-compose --profile standalone up -d
```

**Mode 3: From project root**
```bash
docker-compose -f platform-admin/docker-compose.yml up -d
```

### Test Configuration Locally (Optional)

**Important**: The `entrypoint.sh` script runs inside the Docker container, not on your local machine.

To test the configuration generation logic locally:
```bash
# Test the configuration without Docker
./test-local.sh

# This creates test-config.json to verify environment variable processing
cat test-config.json  # View generated config
```

### Stop the Platform Admin Agent
```bash
docker-compose down

# Stop and remove volumes (standalone mode)
docker-compose --profile standalone down -v
```

### View Logs
```bash
docker-compose logs -f platform-admin-agent
```

### Check Status
```bash
# Check if the agent is running
docker-compose ps

# Check health (using port from .env)
curl http://localhost:8002/status || curl http://localhost:8002
```

## Configuration

### Environment Variables

The agent supports full configuration via environment variables:

#### Agent Identity
- `AGENT_LABEL` - Agent display name (default: platform-admin)
- `WALLET_ID` - Unique wallet identifier
- `WALLET_KEY` - Wallet encryption key

#### Database Settings
- `WALLET_URL` - PostgreSQL connection string
- `WALLET_ACCOUNT` / `WALLET_PASSWORD` - Database credentials
- `WALLET_CONNECT_TIMEOUT` - Connection timeout (ms)
- `WALLET_MAX_CONNECTIONS` - Max DB connections

#### Network & Endpoints
- `AGENT_ENDPOINT_HTTP` - Public HTTP endpoint
- `AGENT_ENDPOINT_WSS` - Public WebSocket endpoint
- `ADMIN_PORT` - Admin API port (default: 8002)
- `INBOUND_PORT` - Inbound transport port (default: 9002)

#### Auto-Accept Settings
- `AUTO_ACCEPT_CONNECTIONS` - Auto-accept connection requests
- `AUTO_ACCEPT_CREDENTIALS` - Auto-accept credential offers
- `AUTO_ACCEPT_PROOFS` - Auto-accept proof requests

#### Integration
- `WEBHOOK_URL` - Platform webhook endpoint
- `BCOVRIN_REGISTER_URL` - Ledger registration URL

### Configuration Template

The `config.json` file uses environment variable substitution:
```json
{
  "label": "${AGENT_LABEL:-platform-admin}",
  "walletKey": "${WALLET_KEY:-platform-admin-key}",
  "endpoint": ["${AGENT_ENDPOINT_HTTP}", "${AGENT_ENDPOINT_WSS}"],
  ...
}
```

## Ports

Default ports (configurable via `.env`):
- **8002**: Admin API port
- **9002**: Inbound transport port
- **5433**: Standalone PostgreSQL (if used)

## Network

The agent connects to the `confirmd-platform_default` network to communicate with other platform services.

## Troubleshooting

### Agent won't start
1. Check environment variables: `cat .env`
2. Verify network exists: `docker network ls | grep confirmd-platform_default`
3. Check database connectivity: `docker-compose logs postgres`

### Port conflicts
Update ports in `.env`:
```bash
ADMIN_PORT=8003
INBOUND_PORT=9003
```

### Database issues

**For external database mode (default):**
```bash
# Check if platform database is running
docker ps | grep postgres

# Create platform-admin database if it doesn't exist
docker exec -it confirmd-platform-postgres-1 psql -U postgres -c "CREATE DATABASE \"platform-admin\";"

# Connect to platform-admin database
docker exec -it confirmd-platform-postgres-1 psql -U postgres -d platform-admin

# Test connectivity from agent container
docker exec platform-admin-agent nc -z confirmd-platform-postgres-1 5432
```

**For standalone database mode:**
```bash
# Check standalone postgres logs
docker-compose logs postgres

# Connect to standalone database  
docker exec -it platform-admin-postgres psql -U postgres -d platform-admin

# Test connectivity
docker exec platform-admin-agent nc -z platform-admin-postgres 5432
```

**Database connection troubleshooting:**
```bash
# Check if agent can resolve database hostname
docker exec platform-admin-agent nslookup confirmd-platform-postgres-1

# Verify network connectivity
docker exec platform-admin-agent ping confirmd-platform-postgres-1

# Check database logs for connection attempts
docker logs confirmd-platform-postgres-1 | grep platform-admin
```

### Webhook issues
- Verify `WEBHOOK_URL` points to correct platform endpoint
- Check platform logs for webhook delivery issues
- Test webhook endpoint: `curl -X POST ${WEBHOOK_URL}/test`

## Security Notes

- Change default passwords in `.env`
- Use strong `WALLET_KEY` values
- Restrict database access in production
- Use HTTPS endpoints for `AGENT_ENDPOINT_*`