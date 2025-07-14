# Agent Provisioning Troubleshooting Guide

## Overview

This guide provides comprehensive troubleshooting steps for resolving agent provisioning issues in the Confirmd Platform. Based on extensive log analysis and platform investigation, this document addresses common problems and their solutions.

## Common Issues and Solutions

### 1. Platform-Admin Agent Not Found

**Symptom**: `platform-admin` agent is not found in the database or is missing endpoint configuration.

**Investigation Steps**:

```bash
# Check agent records in database
cd /path/to/confirmd-platform
docker-compose -f docker-compose-dev.yml exec confirmd-platform-postgres psql -U postgres -d platform_dev -c "SELECT * FROM agents WHERE label LIKE '%platform-admin%';"

# Check organization records
docker-compose -f docker-compose-dev.yml exec confirmd-platform-postgres psql -U postgres -d platform_dev -c "SELECT * FROM organizations WHERE name = 'platform-admin';"

# Check if agent endpoint files exist
ls -la apps/agent-provisioning/AFJ/endpoints/
ls -la apps/agent-provisioning/AFJ/token/
```

**Solution**:

1. Verify the `platform-admin` organization exists in the database
2. Check if agent provisioning was completed successfully
3. Ensure agent endpoint and token files were created
4. Verify database column names match the query (e.g., `agent_endpoint` vs `agentEndPoint`)

### 2. DNS Resolution Failures (ENOTFOUND)

**Symptom**: Agent connections fail with `ENOTFOUND` errors for hostnames like `confirmd-platform-agent-service`.

**Investigation Steps**:

```bash
# Check Docker network connectivity
docker network ls
docker network inspect confirmd-platform_default

# Test DNS resolution within containers
docker-compose -f docker-compose-dev.yml exec confirmd-platform-agent-service nslookup confirmd-platform-agent-service
docker-compose -f docker-compose-dev.yml exec confirmd-platform-agent-service ping confirmd-platform-agent-service
```

**Solution**:

1. Ensure all services are on the same Docker network
2. Use service names as defined in docker-compose-dev.yml
3. Check if services are running and healthy
4. Verify DNS resolution within the Docker environment

### 3. Invalid Credentials Error

**Symptom**: Agent provisioning fails with "Invalid Credentials" error.

**Investigation Steps**:

```bash
# Check wallet storage credentials
echo "Wallet storage host: $WALLET_STORAGE_HOST"
echo "Wallet storage user: $WALLET_STORAGE_USER"

# Test database connectivity
docker-compose -f docker-compose-dev.yml exec confirmd-platform-postgres psql -U postgres -l

# Check agent configuration file
cat apps/agent-provisioning/AFJ/agent-config/platform-admin_*.json
```

**Solution**:

1. Verify wallet storage credentials in environment variables
2. Ensure PostgreSQL is running and accessible
3. Check if the database user has proper permissions
4. Validate agent configuration file has correct credentials

### 4. Invalid Ledger Name Error

**Symptom**: Agent fails to connect to ledger with "Invalid ledger name" error.

**Investigation Steps**:

```bash
# Check ledger configuration
grep -r "indyLedger" apps/agent-provisioning/AFJ/agent-config/

# Verify ledger URLs are accessible
curl -I "http://test.bcovrin.vonx.io/genesis"
curl -I "https://raw.githubusercontent.com/Indicio-tech/indicio-network/main/genesis_files/pool_transactions_testnet_genesis"
```

**Solution**:

1. Verify ledger configuration in agent config file
2. Test ledger genesis file URLs are accessible
3. Check if ledger namespace matches expected format
4. Ensure ledger configuration is properly formatted JSON

### 5. Port Conflicts

**Symptom**: Agent fails to start due to port already in use.

**Investigation Steps**:

```bash
# Check port usage
netstat -tlnp | grep :8001
netstat -tlnp | grep :9001

# Check port files
cat apps/agent-provisioning/AFJ/port-file/last-admin-port.txt
cat apps/agent-provisioning/AFJ/port-file/last-inbound-port.txt
```

**Solution**:

1. Kill processes using conflicting ports
2. Reset port files to available port numbers
3. Ensure port increment logic is working properly
4. Check if Docker containers are properly stopped

### 6. File Permission Issues

**Symptom**: Cannot create or access configuration files.

**Investigation Steps**:

```bash
# Check directory permissions
ls -la apps/agent-provisioning/AFJ/
ls -la apps/agent-provisioning/AFJ/endpoints/
ls -la apps/agent-provisioning/AFJ/token/

# Check file ownership
ls -la apps/agent-provisioning/AFJ/scripts/
```

**Solution**:

1. Ensure proper file permissions on AFJ directories
2. Check if user has write access to configuration directories
3. Verify script execution permissions
4. Fix ownership issues if necessary

## Diagnostic Commands

### Service Status Check

```bash
# Check all services status
docker-compose -f docker-compose-dev.yml ps

# Check specific service logs
docker-compose -f docker-compose-dev.yml logs confirmd-platform-agent-service
docker-compose -f docker-compose-dev.yml logs confirmd-platform-agent-provisioning
docker-compose -f docker-compose-dev.yml logs confirmd-platform-postgres
```

### Database Diagnostics

```bash
# Connect to database
docker-compose -f docker-compose-dev.yml exec confirmd-platform-postgres psql -U postgres -d platform_dev

# Check tables
\dt

# Check agents table structure
\d agents

# Check organizations table
\d organizations
```

### Network Diagnostics

```bash
# Check Docker networks
docker network ls
docker network inspect confirmd-platform_default

# Test service connectivity
docker-compose -f docker-compose-dev.yml exec confirmd-platform-agent-service curl -I http://confirmd-platform-postgres:5432
```

### File System Diagnostics

```bash
# Check agent configuration files
find apps/agent-provisioning/AFJ/ -name "*.json" -exec ls -la {} \;

# Check port files
cat apps/agent-provisioning/AFJ/port-file/last-admin-port.txt
cat apps/agent-provisioning/AFJ/port-file/last-inbound-port.txt

# Check script permissions
ls -la apps/agent-provisioning/AFJ/scripts/
```

## Resolution Steps for Platform-Admin Agent

### Step 1: Verify Organization Exists

```bash
# Check if platform-admin organization exists
docker-compose -f docker-compose-dev.yml exec confirmd-platform-postgres psql -U postgres -d platform_dev -c "SELECT * FROM organizations WHERE name = 'platform-admin';"

# If not exists, create it
docker-compose -f docker-compose-dev.yml exec confirmd-platform-postgres psql -U postgres -d platform_dev -c "INSERT INTO organizations (name, description) VALUES ('platform-admin', 'Platform Administration Organization');"
```

### Step 2: Check Agent Provisioning Status

```bash
# Check if agent record exists
docker-compose -f docker-compose-dev.yml exec confirmd-platform-postgres psql -U postgres -d platform_dev -c "SELECT * FROM agents WHERE label LIKE '%platform-admin%';"

# Check agent configuration files
ls -la apps/agent-provisioning/AFJ/agent-config/platform-admin_*.json
ls -la apps/agent-provisioning/AFJ/endpoints/platform-admin_*.json
ls -la apps/agent-provisioning/AFJ/token/platform-admin_*.json
```

### Step 3: Re-provision Agent if Necessary

```bash
# If agent files don't exist, trigger re-provisioning
# This would typically be done through the API or by restarting the wallet creation process
```

### Step 4: Verify Database Updates

```bash
# Check if agent endpoint was saved to database
docker-compose -f docker-compose-dev.yml exec confirmd-platform-postgres psql -U postgres -d platform_dev -c "SELECT id, org_id, agent_endpoint, label FROM agents WHERE label LIKE '%platform-admin%';"
```

## Environment Variable Checklist

Ensure these environment variables are properly set:

```bash
# Agent Provisioning
AGENT_PROVISIONING_NKEY_SEED=<proper-seed>
AFJ_AGENT_SPIN_UP=<path-to-script>
AFJ_AGENT_ENDPOINT_PATH=<endpoint-path>
AFJ_AGENT_TOKEN_PATH=<token-path>

# Database
WALLET_STORAGE_HOST=<postgres-host>
WALLET_STORAGE_PORT=<postgres-port>
WALLET_STORAGE_USER=<postgres-user>
WALLET_STORAGE_PASSWORD=<postgres-password>

# Agent Configuration
AGENT_HOST=<agent-host>
SCHEMA_FILE_SERVER_URL=<schema-server-url>
```

## Prevention Measures

### 1. Regular Health Checks

```bash
# Create health check script
#!/bin/bash
echo "Checking agent provisioning health..."
docker-compose -f docker-compose-dev.yml ps | grep -E "(agent-service|agent-provisioning|postgres)"
echo "Checking database connectivity..."
docker-compose -f docker-compose-dev.yml exec confirmd-platform-postgres psql -U postgres -d platform_dev -c "SELECT 1;"
echo "Checking configuration files..."
ls -la apps/agent-provisioning/AFJ/endpoints/
ls -la apps/agent-provisioning/AFJ/token/
```

### 2. Log Monitoring

```bash
# Monitor agent provisioning logs
docker-compose -f docker-compose-dev.yml logs -f confirmd-platform-agent-provisioning

# Monitor database logs
docker-compose -f docker-compose-dev.yml logs -f confirmd-platform-postgres
```

### 3. Backup Configuration

```bash
# Backup agent configuration files
tar -czf agent-config-backup-$(date +%Y%m%d).tar.gz apps/agent-provisioning/AFJ/
```

## When to Seek Additional Help

1. **Database corruption**: If database queries return unexpected results
2. **Network issues**: If Docker networking is broken
3. **Configuration issues**: If environment variables are not properly set
4. **Service failures**: If multiple services are failing simultaneously

## Conclusion

This troubleshooting guide provides a systematic approach to diagnosing and resolving agent provisioning issues. Follow the steps in order and document any findings for future reference. If issues persist after following this guide, consider consulting with the platform development team or reviewing the latest platform documentation.
