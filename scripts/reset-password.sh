#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Configuration
KEYCLOAK_DOMAIN="https://manager.credence.ng"
KEYCLOAK_REALM="confirmd-bench"
KEYCLOAK_MANAGEMENT_CLIENT_ID="confirmd-bench-management"
KEYCLOAK_MANAGEMENT_CLIENT_SECRET="APwJSRD9xjvfjTTZO0RoUz3y7sWej2eO"
USER_ID="1f7fafe5-9a0d-4f8e-9b60-d35f5b992973"
NEW_PASSWORD="PlatformAdmin123!"

echo "========================================"
echo "RESETTING PLATFORM ADMIN PASSWORD"
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

# Reset password
print_status "Resetting password for platform admin user..."
PASSWORD_RESPONSE=$(curl -s -w "%{http_code}" -X PUT \
  "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/users/${USER_ID}/reset-password" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"password\",\"value\":\"${NEW_PASSWORD}\",\"temporary\":false}")

HTTP_CODE="${PASSWORD_RESPONSE: -3}"
RESPONSE_BODY="${PASSWORD_RESPONSE%???}"

if [ "$HTTP_CODE" = "204" ]; then
    print_status "✅ Password reset successfully"
else
    print_error "❌ Failed to reset password (HTTP $HTTP_CODE)"
    echo "Response: $RESPONSE_BODY"
    exit 1
fi

# Test authentication
print_status "Testing authentication with new password..."
AUTH_RESPONSE=$(curl -s -X POST \
  "${KEYCLOAK_DOMAIN}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=account" \
  -d "username=admin@getconfirmd.com" \
  -d "password=${NEW_PASSWORD}")

ACCESS_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.access_token // empty')

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "null" ]; then
    print_error "❌ Authentication still failing"
    echo "Response: $AUTH_RESPONSE"
else
    print_status "✅ Authentication successful!"
    echo "Access token acquired (length: ${#ACCESS_TOKEN})"
    
    # Decode the token to check roles
    print_status "Checking token claims..."
    PAYLOAD=$(echo "$ACCESS_TOKEN" | cut -d'.' -f2)
    # Add padding if needed for base64 decoding
    PADDED_PAYLOAD="$PAYLOAD$(printf '%*s' $((4 - ${#PAYLOAD} % 4)) '' | tr ' ' '=')"
    DECODED=$(echo "$PADDED_PAYLOAD" | base64 -d 2>/dev/null | jq -r '.realm_access.roles // []' 2>/dev/null)
    echo "Roles in token: $DECODED"
fi

echo "========================================"
echo "PASSWORD RESET COMPLETE"
echo "========================================"
