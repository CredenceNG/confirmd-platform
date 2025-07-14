# Keycloak Setup Scripts for CREDEBL Platform

This directory contains scripts to set up and test Keycloak integration with the CREDEBL SSI platform.

## Scripts Overview

### 1. `setup-keycloak-roles.sh`

**Purpose**: Sets up all required roles and creates a test platform admin user in Keycloak.

**What it does**:

- Tests Keycloak Admin API connectivity
- Creates realm-level roles (`platform_admin`, `holder`, `mb-user`)
- Creates an organization template client with standard roles
- Creates organization client roles (`owner`, `admin`, `super_admin`, `issuer`, `verifier`, `member`)
- Creates a test platform admin user with proper role assignments
- Validates the complete setup

### 2. `verify-keycloak-setup.sh`

**Purpose**: Comprehensive testing of Keycloak configuration and CREDEBL integration points.

**What it tests**:

- Realm accessibility and OIDC endpoints
- Platform admin authentication
- Management client credentials flow
- Realm and client role configurations
- UserInfo and JWKS endpoints
- Token refresh functionality
- CREDEBL integration readiness

## Prerequisites

Before running these scripts, ensure you have:

1. **Required Tools**:

   ```bash
   # Install jq (JSON processor)
   sudo apt-get install jq  # Ubuntu/Debian
   brew install jq          # macOS

   # curl should be pre-installed on most systems
   ```

2. **Keycloak Instance**:

   - Keycloak server running at: `https://manager.credence.ng`
   - Realm: `confirmd-bench` (must exist)
   - Management client: `confirmd-bench-management` with proper permissions

3. **Network Access**:
   - Ability to reach Keycloak server
   - Internet connection for API calls

## Configuration

The scripts use the following configuration (from your `.env` file):

```bash
KEYCLOAK_DOMAIN="https://manager.credence.ng"
KEYCLOAK_REALM="confirmd-bench"
KEYCLOAK_MANAGEMENT_CLIENT_ID="confirmd-bench-management"
KEYCLOAK_MANAGEMENT_CLIENT_SECRET="APwJSRD9xjvfjTTZO0RoUz3y7sWej2eO"
```

## Usage

### Step 1: Setup Keycloak Roles

```bash
# Run the setup script
./scripts/setup-keycloak-roles.sh
```

**Expected Output**:

- ✅ API connection test
- ✅ Realm-level roles created
- ✅ Organization template client created
- ✅ Organization roles created
- ✅ Test platform admin user created
- ✅ Role assignments completed

### Step 2: Verify Setup

```bash
# Run the verification script
./scripts/verify-keycloak-setup.sh
```

**Expected Output**:

- ✅ All 9 integration tests pass
- ✅ Complete configuration validation
- ✅ CREDEBL integration readiness confirmed

## Created Roles

### Realm-Level Roles

- **`platform_admin`**: Platform administrator with cross-organization access
- **`holder`**: Individual credential holders (mobile wallet users)
- **`mb-user`**: Basic authenticated users

### Organization Client Roles (Template)

- **`owner`**: Organization owner with full control
- **`admin`**: Organization administrator
- **`super_admin`**: Organization super administrator
- **`issuer`**: Credential issuer
- **`verifier`**: Credential verifier
- **`member`**: Organization member

## Test Platform Admin User

The setup script creates a test user:

- **Username**: `platform-admin`
- **Email**: `admin@getconfirmd.com`
- **Password**: `PlatformAdmin123!`
- **Roles**: `platform_admin`, `mb-user`

> ⚠️ **Security Note**: Change the password before production use!

## Integration with CREDEBL

After successful setup, update your CREDEBL `.env` file:

```bash
# Keycloak Configuration
KEYCLOAK_DOMAIN=https://manager.credence.ng/
KEYCLOAK_REALM=confirmd-bench
KEYCLOAK_MANAGEMENT_CLIENT_ID=confirmd-bench-management
KEYCLOAK_MANAGEMENT_CLIENT_SECRET=APwJSRD9xjvfjTTZO0RoUz3y7sWej2eO

# Platform Admin
PLATFORM_ADMIN_EMAIL=admin@getconfirmd.com
```

Then restart CREDEBL services:

```bash
docker-compose -f docker-compose.dev.yml restart
```

## Troubleshooting

### Common Issues

1. **Connection Errors**:

   ```bash
   # Test basic connectivity
   curl -s https://manager.credence.ng/realms/confirmd-bench/.well-known/openid-configuration
   ```

2. **Authentication Failures**:

   - Verify management client credentials
   - Check if realm `confirmd-bench` exists
   - Ensure management client has proper permissions

3. **Permission Errors**:
   - Verify management client has `realm-management` roles
   - Check if client has `service-accounts-enabled`

### Debug Mode

Run scripts with debug output:

```bash
# Enable verbose output
bash -x ./scripts/setup-keycloak-roles.sh

# Check specific endpoints
curl -v https://manager.credence.ng/realms/confirmd-bench
```

### Logs and Temporary Files

Scripts create temporary files in `/tmp/`:

- `/tmp/keycloak_test.json`
- `/tmp/role_*.json`
- `/tmp/client_*.json`
- `/tmp/user_*.json`

These are automatically cleaned up on completion.

## Security Considerations

1. **Production Deployment**:

   - Change default passwords
   - Use strong client secrets
   - Enable SSL/TLS
   - Configure proper CORS settings

2. **Role Management**:

   - Regularly audit role assignments
   - Use principle of least privilege
   - Monitor admin activities

3. **Token Security**:
   - Configure appropriate token lifespans
   - Enable token refresh
   - Use secure storage for tokens

## Next Steps

After successful setup:

1. ✅ Test CREDEBL platform admin login
2. ✅ Create test organizations via CREDEBL
3. ✅ Verify automatic client/role creation
4. ✅ Test complete SSI workflows
5. ✅ Configure production security settings

## Support

For issues or questions:

- Check Keycloak admin console: `https://manager.credence.ng/admin`
- Review CREDEBL documentation
- Validate network connectivity and firewall settings
