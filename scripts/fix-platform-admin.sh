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
echo "FIXING PLATFORM ADMIN CONFIGURATION"
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

# Get platform-admin role details
print_status "Getting platform-admin role details..."
ROLE_RESPONSE=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/roles/platform-admin")

ROLE_ID=$(echo "$ROLE_RESPONSE" | jq -r '.id // empty')
ROLE_NAME=$(echo "$ROLE_RESPONSE" | jq -r '.name // empty')

if [ -z "$ROLE_ID" ] || [ "$ROLE_ID" = "null" ]; then
    print_error "❌ Failed to get platform-admin role details"
    echo "Response: $ROLE_RESPONSE"
    exit 1
fi

print_status "✅ Role details acquired: $ROLE_NAME ($ROLE_ID)"

# Assign platform-admin role to user
print_status "Assigning platform-admin role to user..."
ASSIGN_RESPONSE=$(curl -s -w "%{http_code}" -X POST \
  "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/users/${USER_ID}/role-mappings/realm" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "[{\"id\":\"${ROLE_ID}\",\"name\":\"${ROLE_NAME}\"}]")

HTTP_CODE="${ASSIGN_RESPONSE: -3}"
RESPONSE_BODY="${ASSIGN_RESPONSE%???}"

if [ "$HTTP_CODE" = "204" ]; then
    print_status "✅ Platform-admin role assigned successfully"
else
    print_error "❌ Failed to assign role (HTTP $HTTP_CODE)"
    echo "Response: $RESPONSE_BODY"
fi

# Enable direct access grants for account client
print_status "Enabling direct access grants for account client..."
ACCOUNT_UPDATE_RESPONSE=$(curl -s -w "%{http_code}" -X PUT \
  "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/clients/$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
    "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/clients?clientId=account" | jq -r '.[0].id')" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"directAccessGrantsEnabled": true}')

HTTP_CODE="${ACCOUNT_UPDATE_RESPONSE: -3}"
RESPONSE_BODY="${ACCOUNT_UPDATE_RESPONSE%???}"

if [ "$HTTP_CODE" = "204" ]; then
    print_status "✅ Direct access grants enabled for account client"
else
    print_error "❌ Failed to update account client (HTTP $HTTP_CODE)"
    echo "Response: $RESPONSE_BODY"
fi

print_status "Testing authentication after fixes..."
AUTH_RESPONSE=$(curl -s -X POST \
  "${KEYCLOAK_DOMAIN}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=account" \
  -d "username=admin@getconfirmd.com" \
  -d "password=PlatformAdmin123!")

ACCESS_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.access_token // empty')

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "null" ]; then
    print_error "❌ Authentication still failing"
    echo "Response: $AUTH_RESPONSE"
else
    print_status "✅ Authentication successful!"
    echo "Access token acquired (length: ${#ACCESS_TOKEN})"
fi

echo "========================================"
echo "FIX COMPLETE"
echo "========================================"
