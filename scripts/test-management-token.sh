#!/bin/bash

echo "🔑 Testing Keycloak Management Client Token..."

# Read environment variables
source .env

echo "🌐 Keycloak Domain: $KEYCLOAK_DOMAIN"
echo "🏰 Keycloak Realm: $KEYCLOAK_REALM"
echo "🆔 Management Client ID: $KEYCLOAK_MANAGEMENT_CLIENT_ID"
echo "🔐 Management Client Secret Length: ${#KEYCLOAK_MANAGEMENT_CLIENT_SECRET}"

# Test token request
echo ""
echo "📡 Requesting token..."

TOKEN_RESPONSE=$(curl -s -X POST "${KEYCLOAK_DOMAIN}realms/${KEYCLOAK_REALM}/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=${KEYCLOAK_MANAGEMENT_CLIENT_ID}&client_secret=${KEYCLOAK_MANAGEMENT_CLIENT_SECRET}")

echo "📥 Response: $TOKEN_RESPONSE"

# Check if we got an access token
if echo "$TOKEN_RESPONSE" | grep -q "access_token"; then
    echo "✅ Token obtained successfully!"
    ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token')
    echo "🎯 Access Token: ${ACCESS_TOKEN:0:50}..."
else
    echo "❌ Failed to get token"
    echo "Error: $TOKEN_RESPONSE"
fi
