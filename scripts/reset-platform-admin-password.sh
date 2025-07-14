#!/bin/bash

# Reset platform admin password
echo "🔑 Resetting platform admin password..."

KEYCLOAK_DOMAIN="https://manager.credence.ng"
KEYCLOAK_REALM="confirmd-bench"
KEYCLOAK_MANAGEMENT_CLIENT_ID="confirmd-bench-management"
KEYCLOAK_MANAGEMENT_CLIENT_SECRET="APwJSRD9xjvfjTTZO0RoUz3y7sWej2eO"
USER_EMAIL="admin@getconfirmd.com"
NEW_PASSWORD="PlatformAdmin123!"

# Get admin token
echo "Getting admin token..."
ADMIN_TOKEN_RESPONSE=$(curl -s -X POST \
  "${KEYCLOAK_DOMAIN}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=${KEYCLOAK_MANAGEMENT_CLIENT_ID}" \
  -d "client_secret=${KEYCLOAK_MANAGEMENT_CLIENT_SECRET}")

ADMIN_TOKEN=$(echo "$ADMIN_TOKEN_RESPONSE" | jq -r '.access_token // empty')

if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" = "null" ]; then
    echo "❌ Failed to get admin token"
    echo "Response: $ADMIN_TOKEN_RESPONSE"
    exit 1
fi

echo "✅ Admin token acquired"

# Get user ID
echo "Getting user ID..."
USERS_RESPONSE=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/users?email=${USER_EMAIL}")

USER_ID=$(echo "$USERS_RESPONSE" | jq -r '.[0].id')

if [ -z "$USER_ID" ] || [ "$USER_ID" = "null" ]; then
    echo "❌ Failed to get user ID"
    exit 1
fi

echo "✅ User ID: $USER_ID"

# Reset password
echo "Resetting password..."
RESET_RESPONSE=$(curl -s -w "%{http_code}" -X PUT \
  "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/users/${USER_ID}/reset-password" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "password",
    "value": "'${NEW_PASSWORD}'",
    "temporary": false
  }')

HTTP_CODE="${RESET_RESPONSE: -3}"
RESPONSE_BODY="${RESET_RESPONSE%???}"

if [ "$HTTP_CODE" = "204" ]; then
    echo "✅ Password reset successful"
    
    # Test authentication with new password
    echo "Testing authentication with new password..."
    AUTH_RESPONSE=$(curl -s -X POST \
      "${KEYCLOAK_DOMAIN}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "grant_type=password" \
      -d "client_id=platform-admin" \
      -d "username=${USER_EMAIL}" \
      -d "password=${NEW_PASSWORD}")
    
    ACCESS_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.access_token // empty')
    
    if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "null" ]; then
        echo "❌ Authentication failed with new password"
        echo "Response: $AUTH_RESPONSE"
    else
        echo "✅ Authentication successful with new password!"
        echo "Access token: ${ACCESS_TOKEN:0:50}..."
    fi
else
    echo "❌ Password reset failed (HTTP $HTTP_CODE)"
    echo "Response: $RESPONSE_BODY"
fi
