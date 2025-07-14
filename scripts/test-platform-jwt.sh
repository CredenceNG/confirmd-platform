#!/bin/bash

echo "🔑 Testing Platform Admin JWT Token Authentication..."

# Test platform admin authentication
echo "📡 Attempting to get JWT token from Keycloak..."

RESPONSE=$(curl -s -X POST "https://manager.credence.ng/realms/confirmd-bench/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=platform-admin" \
  -d "username=admin@getconfirmd.com" \
  -d "password=PlatformAdmin123!" \
  -d "scope=openid roles profile email")

echo "📥 Response from Keycloak:"
echo "$RESPONSE"

# Check if we got an access token
if echo "$RESPONSE" | grep -q "access_token"; then
    echo ""
    echo "✅ SUCCESS: Platform admin authentication successful!"
    
    # Extract and decode the token
    ACCESS_TOKEN=$(echo "$RESPONSE" | jq -r '.access_token')
    echo "🎯 Access Token (first 50 chars): ${ACCESS_TOKEN:0:50}..."
    
    echo ""
    echo "📄 Attempting to decode JWT Token Claims..."
    
    # Decode the JWT payload (base64 decode the middle part)
    PAYLOAD=$(echo "$ACCESS_TOKEN" | cut -d. -f2)
    # Add padding if needed
    case $((${#PAYLOAD} % 4)) in
        2) PAYLOAD="${PAYLOAD}==" ;;
        3) PAYLOAD="${PAYLOAD}=" ;;
    esac
    
    echo "$PAYLOAD" | base64 -d 2>/dev/null | jq . 2>/dev/null || echo "Could not decode JWT payload"
    
else
    echo ""
    echo "❌ FAILED: Platform admin authentication failed"
    echo "Error details:"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
fi
