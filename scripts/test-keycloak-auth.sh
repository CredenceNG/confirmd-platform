#!/bin/bash

echo "🔑 Testing Platform Admin Authentication with Keycloak..."

# Test platform admin authentication
echo "� Attempting to get JWT token from Keycloak..."

RESPONSE=$(curl -s -X POST "https://manager.credence.ng/realms/confirmd-bench/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=platform-admin" \
  -d "username=admin@getconfirmd.com" \
  -d "password=PlatformAdmin123!" \
  -d "scope=openid roles profile email")

echo "📥 Response from Keycloak:"
echo "$RESPONSE" | jq .

# Check if we got an access token
if echo "$RESPONSE" | grep -q "access_token"; then
    echo "✅ SUCCESS: Platform admin authentication successful!"
    
    # Extract and decode the token
    ACCESS_TOKEN=$(echo "$RESPONSE" | jq -r '.access_token')
    echo "🎯 Access Token (first 50 chars): ${ACCESS_TOKEN:0:50}..."
    
    # Decode the JWT payload (base64 decode the middle part)
    PAYLOAD=$(echo "$ACCESS_TOKEN" | cut -d. -f2)
    # Add padding if needed
    case $((${#PAYLOAD} % 4)) in
        2) PAYLOAD="${PAYLOAD}==" ;;
        3) PAYLOAD="${PAYLOAD}=" ;;
    esac
    
    echo "📄 JWT Token Claims:"
    echo "$PAYLOAD" | base64 -d | jq .
        echo "✅ Loaded environment variables from .env file"
        echo "KEYCLOAK_USERNAME: $KEYCLOAK_USERNAME"
        echo "KEYCLOAK_PASSWORD length: ${#KEYCLOAK_PASSWORD}"
        echo "KEYCLOAK_DOMAIN: $KEYCLOAK_DOMAIN"
    else
        echo "❌ .env file not found"
        exit 1
    fi
fi

# Test direct authentication to Keycloak
echo "🌐 Testing direct authentication to Keycloak master realm..."

KEYCLOAK_URL="${KEYCLOAK_DOMAIN}realms/master/protocol/openid-connect/token"
echo "Token URL: $KEYCLOAK_URL"

# Prepare the payload
PAYLOAD="grant_type=password&client_id=admin-cli&username=$KEYCLOAK_USERNAME&password=$KEYCLOAK_PASSWORD"

# Make the request
echo "📡 Making authentication request..."
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

echo "🎉 Keycloak admin authentication test completed successfully!"
