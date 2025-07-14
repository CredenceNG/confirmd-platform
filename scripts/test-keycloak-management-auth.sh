#!/bin/bash

# Test script to verify Keycloak management client authentication
echo "🔍 Testing Keycloak Management Client Authentication..."

# Check if environment variables are set
if [ -z "$KEYCLOAK_MANAGEMENT_CLIENT_ID" ] || [ -z "$KEYCLOAK_MANAGEMENT_CLIENT_SECRET" ] || [ -z "$KEYCLOAK_REALM" ]; then
    echo "❌ Environment variables not set. Checking .env file..."
    if [ -f ".env" ]; then
        source .env
        echo "✅ Loaded environment variables from .env file"
        echo "KEYCLOAK_MANAGEMENT_CLIENT_ID: $KEYCLOAK_MANAGEMENT_CLIENT_ID"
        echo "KEYCLOAK_MANAGEMENT_CLIENT_SECRET length: ${#KEYCLOAK_MANAGEMENT_CLIENT_SECRET}"
        echo "KEYCLOAK_REALM: $KEYCLOAK_REALM"
        echo "KEYCLOAK_DOMAIN: $KEYCLOAK_DOMAIN"
    else
        echo "❌ .env file not found"
        exit 1
    fi
fi

# Test direct authentication to Keycloak
echo "🌐 Testing direct authentication to Keycloak realm..."

KEYCLOAK_URL="${KEYCLOAK_DOMAIN}realms/${KEYCLOAK_REALM}/protocol/openid-connect/token"
echo "Token URL: $KEYCLOAK_URL"

# Prepare the payload for client credentials
PAYLOAD="grant_type=client_credentials&client_id=$KEYCLOAK_MANAGEMENT_CLIENT_ID&client_secret=$KEYCLOAK_MANAGEMENT_CLIENT_SECRET"

# Make the request
echo "📡 Making authentication request with client credentials..."
RESPONSE=$(curl -s -X POST "$KEYCLOAK_URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "$PAYLOAD")

# Check if we got a token
if echo "$RESPONSE" | grep -q '"access_token"'; then
    echo "✅ Authentication successful! Token received."
    echo "🎯 Token type: $(echo "$RESPONSE" | jq -r '.token_type // "Bearer"')"
    echo "⏰ Expires in: $(echo "$RESPONSE" | jq -r '.expires_in // "Unknown"') seconds"
else
    echo "❌ Authentication failed!"
    echo "Response: $RESPONSE"
    exit 1
fi

echo "🎉 Keycloak management client authentication test completed successfully!"
