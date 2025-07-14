#!/bin/bash

# Check users in Keycloak
echo "🔍 Checking Keycloak users..."

KEYCLOAK_DOMAIN="https://manager.credence.ng"
KEYCLOAK_REALM="confirmd-bench"
KEYCLOAK_MANAGEMENT_CLIENT_ID="confirmd-bench-management"
KEYCLOAK_MANAGEMENT_CLIENT_SECRET="APwJSRD9xjvfjTTZO0RoUz3y7sWej2eO"

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

# Get users
echo "Getting users..."
USERS_RESPONSE=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/users?email=admin@getconfirmd.com")

echo "📋 Users with email admin@getconfirmd.com:"
echo "$USERS_RESPONSE" | jq '.'

# Check if user exists
USER_EXISTS=$(echo "$USERS_RESPONSE" | jq -r 'length > 0')
if [ "$USER_EXISTS" = "true" ]; then
    echo "✅ User exists in Keycloak"
    USER_ID=$(echo "$USERS_RESPONSE" | jq -r '.[0].id')
    echo "User ID: $USER_ID"
    
    # Check if user is enabled
    USER_ENABLED=$(echo "$USERS_RESPONSE" | jq -r '.[0].enabled')
    echo "User enabled: $USER_ENABLED"
    
    # Check user roles
    echo "Getting user roles..."
    USER_ROLES_RESPONSE=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
      "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/users/${USER_ID}/role-mappings/realm")
    
    echo "User roles:"
    echo "$USER_ROLES_RESPONSE" | jq '.'
    
else
    echo "❌ User does not exist in Keycloak"
fi
