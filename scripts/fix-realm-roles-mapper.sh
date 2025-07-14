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
echo "FIXING REALM ROLES MAPPER"
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

# Get existing realm roles mapper
print_status "Getting existing realm roles mapper..."
MAPPERS_RESPONSE=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/client-scopes/${ROLES_SCOPE_ID}/protocol-mappers/models")

REALM_ROLES_MAPPER_ID=$(echo "$MAPPERS_RESPONSE" | jq -r '.[] | select(.name == "realm roles") | .id')

if [ -z "$REALM_ROLES_MAPPER_ID" ] || [ "$REALM_ROLES_MAPPER_ID" = "null" ]; then
    print_error "❌ Realm roles mapper not found"
    exit 1
fi

print_status "✅ Realm roles mapper ID: $REALM_ROLES_MAPPER_ID"

# Update the realm roles mapper with correct configuration
print_status "Updating realm roles mapper configuration..."
UPDATE_MAPPER_RESPONSE=$(curl -s -w "%{http_code}" -X PUT \
  "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/client-scopes/${ROLES_SCOPE_ID}/protocol-mappers/models/${REALM_ROLES_MAPPER_ID}" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "'${REALM_ROLES_MAPPER_ID}'",
    "name": "realm roles",
    "protocol": "openid-connect",
    "protocolMapper": "oidc-usermodel-realm-role-mapper",
    "config": {
      "multivalued": "true",
      "userinfo.token.claim": "true",
      "id.token.claim": "true",
      "access.token.claim": "true",
      "claim.name": "realm_access.roles",
      "jsonType.label": "String"
    }
  }')

HTTP_CODE="${UPDATE_MAPPER_RESPONSE: -3}"
RESPONSE_BODY="${UPDATE_MAPPER_RESPONSE%???}"

if [ "$HTTP_CODE" = "204" ]; then
    print_status "✅ Realm roles mapper updated successfully"
else
    print_error "❌ Failed to update realm roles mapper (HTTP $HTTP_CODE)"
    echo "Response: $RESPONSE_BODY"
    exit 1
fi

# Also update the account client to include roles scope by default
print_status "Getting account client details..."
ACCOUNT_CLIENT_RESPONSE=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/clients?clientId=account")

ACCOUNT_CLIENT_ID=$(echo "$ACCOUNT_CLIENT_RESPONSE" | jq -r '.[0].id // empty')

# Test authentication after the fix
print_status "Testing authentication after mapper fix..."
sleep 2  # Give Keycloak time to apply the changes

AUTH_RESPONSE=$(curl -s -X POST \
  "${KEYCLOAK_DOMAIN}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=account" \
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
    
    if 'platform-admin' in roles:
        print('✅ Platform-admin role found in token!')
    else:
        print('⚠️ Platform-admin role not found in token')
        
except Exception as e:
    print(f'Error decoding token: {e}')
    sys.exit(1)
"
fi

echo "========================================"
echo "REALM ROLES MAPPER FIX COMPLETE"
echo "========================================"
