#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

# Configuration
KEYCLOAK_DOMAIN="https://manager.credence.ng"
KEYCLOAK_REALM="confirmd-bench"
KEYCLOAK_MANAGEMENT_CLIENT_ID="confirmd-bench-management"
KEYCLOAK_MANAGEMENT_CLIENT_SECRET="APwJSRD9xjvfjTTZO0RoUz3y7sWej2eO"
USER_ID="1f7fafe5-9a0d-4f8e-9b60-d35f5b992973"

echo "========================================"
echo "CREATING PLATFORM_ADMIN ROLE (WITH UNDERSCORE)"
echo "========================================"

# Get admin token
print_status "Getting admin token..."
ADMIN_TOKEN_RESPONSE=$(curl -s -X POST \
  "${KEYCLOAK_DOMAIN}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=${KEYCLOAK_MANAGEMENT_CLIENT_ID}" \
  -d "client_secret=${KEYCLOAK_MANAGEMENT_CLIENT_SECRET}")

ADMIN_TOKEN=$(echo "$ADMIN_TOKEN_RESPONSE" | jq -r '.access_token // empty')

if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" = "null" ]; then
    print_error "❌ Failed to get admin token"
    exit 1
fi

print_status "✅ Admin token acquired"

# Check if platform_admin role already exists
print_status "Checking if platform_admin role already exists..."
EXISTING_ROLE_RESPONSE=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/roles/platform_admin")

if echo "$EXISTING_ROLE_RESPONSE" | jq -e '.name' >/dev/null 2>&1; then
    print_status "✅ platform_admin role already exists"
    PLATFORM_ADMIN_ROLE_ID=$(echo "$EXISTING_ROLE_RESPONSE" | jq -r '.id')
else
    # Create platform_admin role
    print_status "Creating platform_admin role (with underscore)..."
    CREATE_ROLE_RESPONSE=$(curl -s -w "%{http_code}" -X POST \
      "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/roles" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "name": "platform_admin",
        "description": "Platform Administrator role with underscore",
        "composite": false,
        "clientRole": false,
        "containerId": "'${KEYCLOAK_REALM}'"
      }')

    HTTP_CODE="${CREATE_ROLE_RESPONSE: -3}"
    RESPONSE_BODY="${CREATE_ROLE_RESPONSE%???}"

    if [ "$HTTP_CODE" = "201" ]; then
        print_status "✅ platform_admin role created successfully"
        
        # Get the created role details
        PLATFORM_ADMIN_ROLE_RESPONSE=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
          "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/roles/platform_admin")
        PLATFORM_ADMIN_ROLE_ID=$(echo "$PLATFORM_ADMIN_ROLE_RESPONSE" | jq -r '.id')
    else
        print_error "❌ Failed to create platform_admin role (HTTP $HTTP_CODE)"
        echo "Response: $RESPONSE_BODY"
        exit 1
    fi
fi

print_status "✅ platform_admin role ID: $PLATFORM_ADMIN_ROLE_ID"

# Also create mb-user role if it doesn't exist
print_status "Checking if mb-user role exists..."
EXISTING_MBUSER_ROLE_RESPONSE=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/roles/mb-user")

if echo "$EXISTING_MBUSER_ROLE_RESPONSE" | jq -e '.name' >/dev/null 2>&1; then
    print_status "✅ mb-user role already exists"
    MBUSER_ROLE_ID=$(echo "$EXISTING_MBUSER_ROLE_RESPONSE" | jq -r '.id')
else
    # Create mb-user role
    print_status "Creating mb-user role..."
    CREATE_MBUSER_ROLE_RESPONSE=$(curl -s -w "%{http_code}" -X POST \
      "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/roles" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "name": "mb-user",
        "description": "Mobile banking user role",
        "composite": false,
        "clientRole": false,
        "containerId": "'${KEYCLOAK_REALM}'"
      }')

    HTTP_CODE="${CREATE_MBUSER_ROLE_RESPONSE: -3}"
    RESPONSE_BODY="${CREATE_MBUSER_ROLE_RESPONSE%???}"

    if [ "$HTTP_CODE" = "201" ]; then
        print_status "✅ mb-user role created successfully"
        
        # Get the created role details
        MBUSER_ROLE_RESPONSE=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
          "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/roles/mb-user")
        MBUSER_ROLE_ID=$(echo "$MBUSER_ROLE_RESPONSE" | jq -r '.id')
    else
        print_error "❌ Failed to create mb-user role (HTTP $HTTP_CODE)"
        echo "Response: $RESPONSE_BODY"
        exit 1
    fi
fi

print_status "✅ mb-user role ID: $MBUSER_ROLE_ID"

# Assign both roles to the platform admin user
print_status "Assigning platform_admin and mb-user roles to platform admin user..."
ASSIGN_ROLES_RESPONSE=$(curl -s -w "%{http_code}" -X POST \
  "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/users/${USER_ID}/role-mappings/realm" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "id": "'${PLATFORM_ADMIN_ROLE_ID}'",
      "name": "platform_admin"
    },
    {
      "id": "'${MBUSER_ROLE_ID}'",
      "name": "mb-user"
    }
  ]')

HTTP_CODE="${ASSIGN_ROLES_RESPONSE: -3}"
RESPONSE_BODY="${ASSIGN_ROLES_RESPONSE%???}"

if [ "$HTTP_CODE" = "204" ]; then
    print_status "✅ Both roles assigned successfully"
else
    print_error "❌ Failed to assign roles (HTTP $HTTP_CODE)"
    echo "Response: $RESPONSE_BODY"
fi

# Test authentication with the platform-admin client
print_status "Testing authentication with platform-admin client..."
AUTH_RESPONSE=$(curl -s -X POST \
  "${KEYCLOAK_DOMAIN}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=platform-admin" \
  -d "username=admin@getconfirmd.com" \
  -d "password=PlatformAdmin123!" \
  -d "scope=openid roles profile email")

ACCESS_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.access_token // empty')

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "null" ]; then
    print_error "❌ Authentication failed"
    echo "Response: $AUTH_RESPONSE"
else
    print_status "✅ Authentication successful!"
    
    # Decode the token to check roles
    print_status "Checking token claims..."
    PAYLOAD=$(echo "$ACCESS_TOKEN" | cut -d'.' -f2)
    # Add padding if needed for base64 decoding
    PADDED_PAYLOAD="$PAYLOAD$(printf '%*s' $((4 - ${#PAYLOAD} % 4)) '' | tr ' ' '=')"
    
    # Use Python for better base64 decoding and JSON parsing
    python3 -c "
import base64
import json
import sys

try:
    payload = '$PAYLOAD'
    # Add padding
    payload += '=' * (4 - len(payload) % 4)
    decoded = base64.b64decode(payload).decode('utf-8')
    token_data = json.loads(decoded)
    
    print('Token payload:')
    print(json.dumps(token_data, indent=2))
    
    realm_access = token_data.get('realm_access', {})
    roles = realm_access.get('roles', [])
    
    print(f'\\nRealm roles: {roles}')
    
    if 'platform_admin' in roles:
        print('✅ platform_admin role (with underscore) found in token!')
    else:
        print('⚠️ platform_admin role (with underscore) not found in token')
        
    if 'mb-user' in roles:
        print('✅ mb-user role found in token!')
    else:
        print('⚠️ mb-user role not found in token')
        
except Exception as e:
    print(f'Error decoding token: {e}')
    sys.exit(1)
"
fi

echo "========================================"
echo "ROLE CREATION AND ASSIGNMENT COMPLETE"
echo "========================================"
