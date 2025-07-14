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

echo "========================================"
echo "FIXING CLIENT SCOPE MAPPINGS"
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

# Get account client ID
print_status "Getting account client details..."
ACCOUNT_CLIENT_RESPONSE=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/clients?clientId=account")

ACCOUNT_CLIENT_ID=$(echo "$ACCOUNT_CLIENT_RESPONSE" | jq -r '.[0].id // empty')

if [ -z "$ACCOUNT_CLIENT_ID" ] || [ "$ACCOUNT_CLIENT_ID" = "null" ]; then
    print_error "❌ Failed to get account client ID"
    exit 1
fi

print_status "✅ Account client ID: $ACCOUNT_CLIENT_ID"

# Get roles client scope ID
print_status "Getting roles client scope..."
SCOPES_RESPONSE=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/client-scopes")

ROLES_SCOPE_ID=$(echo "$SCOPES_RESPONSE" | jq -r '.[] | select(.name == "roles") | .id // empty')

if [ -z "$ROLES_SCOPE_ID" ] || [ "$ROLES_SCOPE_ID" = "null" ]; then
    print_error "❌ Failed to get roles client scope ID"
    exit 1
fi

print_status "✅ Roles client scope ID: $ROLES_SCOPE_ID"

# Check current default client scopes
print_status "Checking current default client scopes for account client..."
CURRENT_SCOPES=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/clients/${ACCOUNT_CLIENT_ID}/default-client-scopes")

echo "Current default client scopes:"
echo "$CURRENT_SCOPES" | jq -r '.[].name'

# Add roles scope to default client scopes if not already present
ROLES_SCOPE_EXISTS=$(echo "$CURRENT_SCOPES" | jq -r '.[] | select(.name == "roles") | .name')

if [ -z "$ROLES_SCOPE_EXISTS" ]; then
    print_status "Adding roles scope to account client default scopes..."
    ADD_SCOPE_RESPONSE=$(curl -s -w "%{http_code}" -X PUT \
      "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/clients/${ACCOUNT_CLIENT_ID}/default-client-scopes/${ROLES_SCOPE_ID}" \
      -H "Authorization: Bearer $ADMIN_TOKEN")

    HTTP_CODE="${ADD_SCOPE_RESPONSE: -3}"
    
    if [ "$HTTP_CODE" = "204" ]; then
        print_status "✅ Roles scope added to default client scopes"
    else
        print_error "❌ Failed to add roles scope (HTTP $HTTP_CODE)"
        exit 1
    fi
else
    print_status "✅ Roles scope already exists in default client scopes"
fi

# Test authentication with updated scopes
print_status "Testing authentication with updated client scopes..."
AUTH_RESPONSE=$(curl -s -X POST \
  "${KEYCLOAK_DOMAIN}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=account" \
  -d "username=admin@getconfirmd.com" \
  -d "password=PlatformAdmin123!" \
  -d "scope=openid roles")

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
    DECODED=$(echo "$PADDED_PAYLOAD" | base64 -d 2>/dev/null | jq '.' 2>/dev/null)
    
    REALM_ROLES=$(echo "$DECODED" | jq -r '.realm_access.roles // []')
    RESOURCE_ROLES=$(echo "$DECODED" | jq -r '.resource_access // {}')
    
    echo "Realm roles in token: $REALM_ROLES"
    echo "Resource roles in token: $RESOURCE_ROLES"
    
    # Check if platform-admin role is present
    PLATFORM_ADMIN_ROLE=$(echo "$REALM_ROLES" | jq -r '.[] | select(. == "platform-admin")')
    if [ -n "$PLATFORM_ADMIN_ROLE" ]; then
        print_status "✅ Platform-admin role found in token!"
    else
        print_warning "⚠️ Platform-admin role not found in token"
    fi
fi

echo "========================================"
echo "CLIENT SCOPE FIX COMPLETE"
echo "========================================"
