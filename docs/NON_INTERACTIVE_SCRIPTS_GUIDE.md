# Non-Interactive Script Execution Guide

This document explains how to run platform scripts without user interaction prompts, which is essential for automation, CI/CD pipelines, and production deployments.

## Scripts Made Non-Interactive

### 1. test-keycloak-new-structure.sh

**Issue**: Previously prompted for email and password input.

**Solution**: Modified to use environment variables instead.

**Usage**:

```bash
# Without credentials (skips credential test)
./test-keycloak-new-structure.sh

# With credentials for testing
export TEST_EMAIL="admin@getconfirmd.com"
export TEST_PASSWORD="your_password"
./test-keycloak-new-structure.sh
```

### 2. on_premises_agent.sh

**Issue**: Multiple interactive prompts for agent configuration.

**Solution**: Created a non-interactive version: `on_premises_agent_non_interactive.sh`

**Usage**:

```bash
# Via environment variables
export ORGANIZATION_ID="org123"
export WALLET_NAME="wallet123"
export WALLET_PASSWORD="password123"
export RANDOM_SEED="12345678901234567890123456789012"
export WEBHOOK_HOST="http://localhost:3001"
export AGENT_NAME="agent123"
./apps/agent-provisioning/AFJ/scripts/on_premises_agent_non_interactive.sh

# Via command line arguments
./apps/agent-provisioning/AFJ/scripts/on_premises_agent_non_interactive.sh \
  --ORGANIZATION_ID "org123" \
  --WALLET_NAME "wallet123" \
  --WALLET_PASSWORD "password123" \
  --RANDOM_SEED "12345678901234567890123456789012" \
  --WEBHOOK_HOST "http://localhost:3001" \
  --AGENT_NAME "agent123"
```

### 3. quick-access.sh

**Issue**: Interactive menu when called with `-i` flag.

**Solution**: Only runs interactively when explicitly requested. Default behavior is non-interactive.

**Usage**:

```bash
# Non-interactive (default) - just shows options
./scripts/quick-access.sh

# Interactive (only when requested)
./scripts/quick-access.sh -i
```

## Database Operations (Already Non-Interactive)

### SQL Scripts

All SQL scripts are already non-interactive:

```bash
# Execute SQL scripts non-interactively
docker exec -i postgres_container psql -U postgres -d credebl < update-admin-password.sql
```

### Docker Exec Commands

All docker exec + psql commands use non-interactive flags:

```bash
# Non-interactive database queries
docker exec -i confirmd-platform-postgres-1 psql -U postgres -d credebl -c "SELECT * FROM user_org_roles;"
```

## Environment Variables for Automation

### Required Environment Variables

For complete automation, set these environment variables:

```bash
# Database
export POSTGRES_USER="postgres"
export POSTGRES_PASSWORD="your_password"
export POSTGRES_DB="credebl"

# Testing credentials
export TEST_EMAIL="admin@getconfirmd.com"
export TEST_PASSWORD="your_password"

# Agent configuration (if using agent scripts)
export ORGANIZATION_ID="your_org_id"
export WALLET_NAME="your_wallet_name"
export WALLET_PASSWORD="your_wallet_password"
export RANDOM_SEED="your_32_character_random_seed_here"
export WEBHOOK_HOST="http://your-webhook-host:port"
export AGENT_NAME="your_agent_name"
```

## CI/CD Pipeline Integration

Example GitHub Actions workflow:

```yaml
name: Platform Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Start services
        run: docker compose -f docker-compose-dev.yml up -d

      - name: Wait for services
        run: sleep 30

      - name: Run non-interactive tests
        env:
          TEST_EMAIL: admin@getconfirmd.com
          TEST_PASSWORD: ${{ secrets.TEST_PASSWORD }}
        run: |
          ./test-keycloak-new-structure.sh

      - name: Check platform health
        run: |
          curl -f http://localhost:5000/health
```

## Docker Compose Integration

For production deployments, all scripts should run without prompts:

```yaml
version: '3.8'
services:
  init-platform:
    image: alpine
    command: |
      sh -c "
        apk add --no-cache curl postgresql-client
        ./scripts/init-platform-non-interactive.sh
      "
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - TEST_EMAIL=admin@getconfirmd.com
      - TEST_PASSWORD=${ADMIN_PASSWORD}
    depends_on:
      - postgres
      - api-gateway
```

## Troubleshooting Non-Interactive Execution

### Common Issues

1. **Script hangs**: Check for any remaining `read` commands or interactive prompts
2. **Missing environment variables**: Ensure all required variables are set
3. **Permission denied**: Make sure scripts are executable (`chmod +x script.sh`)
4. **Docker commands waiting**: Use `-i` flag for stdin and proper exit codes

### Debugging Commands

```bash
# Check for interactive prompts in scripts
grep -r "read -p" scripts/
grep -r "read -s" scripts/

# Test script execution with timeout
timeout 30s ./your-script.sh

# Run script with verbose output
bash -x ./your-script.sh
```

## Best Practices

1. **Always provide defaults**: Scripts should have sensible defaults for all parameters
2. **Use environment variables**: Prefer environment variables over command line arguments for sensitive data
3. **Validate inputs**: Check required parameters and fail fast with clear error messages
4. **Exit codes**: Use proper exit codes (0 for success, non-zero for errors)
5. **Logging**: Provide clear output about what the script is doing
6. **Timeouts**: Use timeouts for operations that might hang
7. **Cleanup**: Ensure scripts clean up resources on exit

## Migration Notes

- Original interactive scripts are preserved for manual use
- New non-interactive versions have `_non_interactive` suffix or use environment variables
- All platform automation should use the non-interactive versions
- Update deployment scripts and documentation to use new non-interactive methods

## Security Considerations

- Never log sensitive information like passwords or secrets
- Use secure methods to pass credentials (environment variables, secret management)
- Validate all inputs to prevent injection attacks
- Use least privilege principles for script execution
