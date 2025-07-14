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
echo "CHECKING ROLES CLIENT SCOPE MAPPERS"
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

# Check protocol mappers for the roles scope
print_status "Checking protocol mappers for roles client scope..."
MAPPERS_RESPONSE=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/client-scopes/${ROLES_SCOPE_ID}/protocol-mappers/models")

echo "Current protocol mappers:"
echo "$MAPPERS_RESPONSE" | jq -r '.[] | "\(.name) - \(.protocolMapper) - \(.config)"'

# Check if realm roles mapper exists
REALM_ROLES_MAPPER=$(echo "$MAPPERS_RESPONSE" | jq -r '.[] | select(.name == "realm roles") | .id')

if [ -z "$REALM_ROLES_MAPPER" ] || [ "$REALM_ROLES_MAPPER" = "null" ]; then
    print_warning "⚠️ Realm roles mapper not found, creating one..."
    
    CREATE_MAPPER_RESPONSE=$(curl -s -w "%{http_code}" -X POST \
      "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/client-scopes/${ROLES_SCOPE_ID}/protocol-mappers/models" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
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

    HTTP_CODE="${CREATE_MAPPER_RESPONSE: -3}"
    RESPONSE_BODY="${CREATE_MAPPER_RESPONSE%???}"

    if [ "$HTTP_CODE" = "201" ]; then
        print_status "✅ Realm roles mapper created successfully"
    else
        print_error "❌ Failed to create realm roles mapper (HTTP $HTTP_CODE)"
        echo "Response: $RESPONSE_BODY"
    fi
else
    print_status "✅ Realm roles mapper exists: $REALM_ROLES_MAPPER"
    
    # Check the mapper configuration
    MAPPER_CONFIG=$(echo "$MAPPERS_RESPONSE" | jq -r '.[] | select(.name == "realm roles") | .config')
    print_status "Mapper configuration: $MAPPER_CONFIG"
fi

# Test authentication again
print_status "Testing authentication after mapper check/creation..."
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
    DECODED=$(echo "$PADDED_PAYLOAD" | base64 -d 2>/dev/null | jq '.' 2>/dev/null)
    
    REALM_ROLES=$(echo "$DECODED" | jq -r '.realm_access.roles // []')
    
    echo "Realm roles in token: $REALM_ROLES"
    
    # Check if platform-admin role is present
    PLATFORM_ADMIN_ROLE=$(echo "$REALM_ROLES" | jq -r '.[] | select(. == "platform-admin")')
    if [ -n "$PLATFORM_ADMIN_ROLE" ]; then
        print_status "✅ Platform-admin role found in token!"
    else
        print_warning "⚠️ Platform-admin role not found in token"
        
        # Print full token for debugging
        print_status "Full token payload for debugging:"
        echo "$DECODED" | jq '.'
    fi
fi

echo "========================================"
echo "MAPPER CHECK COMPLETE"
echo "========================================"
