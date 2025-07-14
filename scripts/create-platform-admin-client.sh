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
NEW_CLIENT_ID="platform-admin"

echo "========================================"
echo "CREATING PLATFORM ADMIN CLIENT"
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

# Check if platform-admin client already exists
print_status "Checking if platform-admin client already exists..."
EXISTING_CLIENT=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/clients?clientId=${NEW_CLIENT_ID}")

CLIENT_EXISTS=$(echo "$EXISTING_CLIENT" | jq -r 'length > 0')

if [ "$CLIENT_EXISTS" = "true" ]; then
    print_status "✅ Platform-admin client already exists"
    CLIENT_UUID=$(echo "$EXISTING_CLIENT" | jq -r '.[0].id')
else
    # Create platform-admin client
    print_status "Creating platform-admin client..."
    CREATE_CLIENT_RESPONSE=$(curl -s -w "%{http_code}" -X POST \
      "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/clients" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "clientId": "'${NEW_CLIENT_ID}'",
        "name": "Platform Admin Client",
        "description": "Client for platform administrator authentication",
        "enabled": true,
        "publicClient": true,
        "directAccessGrantsEnabled": true,
        "standardFlowEnabled": true,
        "implicitFlowEnabled": false,
        "serviceAccountsEnabled": false,
        "authorizationServicesEnabled": false,
        "fullScopeAllowed": true,
        "protocol": "openid-connect",
        "attributes": {
          "access.token.lifespan": "1800"
        }
      }')

    HTTP_CODE="${CREATE_CLIENT_RESPONSE: -3}"
    RESPONSE_BODY="${CREATE_CLIENT_RESPONSE%???}"

    if [ "$HTTP_CODE" = "201" ]; then
        print_status "✅ Platform-admin client created successfully"
        
        # Get the created client UUID
        NEW_CLIENT_RESPONSE=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
          "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/clients?clientId=${NEW_CLIENT_ID}")
        CLIENT_UUID=$(echo "$NEW_CLIENT_RESPONSE" | jq -r '.[0].id')
    else
        print_error "❌ Failed to create platform-admin client (HTTP $HTTP_CODE)"
        echo "Response: $RESPONSE_BODY"
        exit 1
    fi
fi

print_status "✅ Platform-admin client UUID: $CLIENT_UUID"

# Add default client scopes to the new client
print_status "Adding default client scopes to platform-admin client..."

# Get roles client scope ID
SCOPES_RESPONSE=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/client-scopes")

ROLES_SCOPE_ID=$(echo "$SCOPES_RESPONSE" | jq -r '.[] | select(.name == "roles") | .id')
PROFILE_SCOPE_ID=$(echo "$SCOPES_RESPONSE" | jq -r '.[] | select(.name == "profile") | .id')
EMAIL_SCOPE_ID=$(echo "$SCOPES_RESPONSE" | jq -r '.[] | select(.name == "email") | .id')

# Add roles scope
ADD_ROLES_RESPONSE=$(curl -s -w "%{http_code}" -X PUT \
  "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/clients/${CLIENT_UUID}/default-client-scopes/${ROLES_SCOPE_ID}" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

# Add profile scope
ADD_PROFILE_RESPONSE=$(curl -s -w "%{http_code}" -X PUT \
  "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/clients/${CLIENT_UUID}/default-client-scopes/${PROFILE_SCOPE_ID}" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

# Add email scope
ADD_EMAIL_RESPONSE=$(curl -s -w "%{http_code}" -X PUT \
  "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/clients/${CLIENT_UUID}/default-client-scopes/${EMAIL_SCOPE_ID}" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

print_status "✅ Client scopes added to platform-admin client"

# Test authentication with the new client
print_status "Testing authentication with platform-admin client..."
AUTH_RESPONSE=$(curl -s -X POST \
  "${KEYCLOAK_DOMAIN}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=${NEW_CLIENT_ID}" \
  -d "username=admin@getconfirmd.com" \
  -d "password=PlatformAdmin123!" \
  -d "scope=openid roles profile email")

ACCESS_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.access_token // empty')

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "null" ]; then
    print_error "❌ Authentication failed with new client"
    echo "Response: $AUTH_RESPONSE"
else
    print_status "✅ Authentication successful with platform-admin client!"
    
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
        
    print(f'\\nClient: {token_data.get(\"azp\", \"unknown\")}')
    print(f'Subject: {token_data.get(\"sub\", \"unknown\")}')
    print(f'Username: {token_data.get(\"preferred_username\", \"unknown\")}')
        
except Exception as e:
    print(f'Error decoding token: {e}')
    sys.exit(1)
"
fi

echo "========================================"
echo "PLATFORM ADMIN CLIENT CREATION COMPLETE"
echo "========================================"

# Print summary
print_status "SUMMARY:"
echo "• Platform admin client ID: ${NEW_CLIENT_ID}"
echo "• Authentication endpoint: ${KEYCLOAK_DOMAIN}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token"
echo "• Use grant_type=password with client_id=${NEW_CLIENT_ID}"
echo "• Include scope=openid roles profile email for full claims"
