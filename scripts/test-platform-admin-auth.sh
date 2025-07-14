#!/bin/bash

echo "🔑 Testing Platform Admin Authentication..."

# Read environment variables
source .env

echo "📧 Platform Admin Email: $PLATFORM_ADMIN_EMAIL"
echo "🌐 Keycloak Domain: $KEYCLOAK_DOMAIN"
echo "🏰 Keycloak Realm: $KEYCLOAK_REALM"

# First, let's try to login as platform admin and get a token
echo ""
echo "📡 Attempting platform admin login..."

if [ -z "$PLATFORM_ADMIN_PASSWORD" ]; then
    echo "❌ PLATFORM_ADMIN_PASSWORD not set in environment"
    exit 1
fi

LOGIN_RESPONSE=$(curl -s -X POST "${KEYCLOAK_DOMAIN}realms/${KEYCLOAK_REALM}/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&client_id=platform-admin&username=${PLATFORM_ADMIN_EMAIL}&password=${PLATFORM_ADMIN_PASSWORD}")

echo "📥 Login Response: $LOGIN_RESPONSE"

# Check if we got an access token
if echo "$LOGIN_RESPONSE" | grep -q "access_token"; then
    echo "✅ Platform admin login successful!"
    ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token')
    echo "🎯 Access Token: ${ACCESS_TOKEN:0:50}..."
    
    # Now test the profile endpoint
    echo ""
    echo "👤 Testing profile endpoint..."
    PROFILE_RESPONSE=$(curl -s -X GET "http://localhost:5000/users/profile" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    
    echo "📥 Profile Response: $PROFILE_RESPONSE"
else
    echo "❌ Platform admin login failed"
    echo "Error: $LOGIN_RESPONSE"
fi
