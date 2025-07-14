#!/bin/bash

echo "🔑 Testing Platform Admin Authentication..."

# Extract variables directly from .env
KEYCLOAK_DOMAIN=$(grep KEYCLOAK_DOMAIN .env | cut -d'=' -f2)
KEYCLOAK_REALM=$(grep KEYCLOAK_REALM .env | cut -d'=' -f2)
PLATFORM_ADMIN_EMAIL=$(grep PLATFORM_ADMIN_EMAIL .env | cut -d'=' -f2)
PLATFORM_ADMIN_PASSWORD=$(grep PLATFORM_ADMIN_PASSWORD .env | cut -d'=' -f2)

echo "📧 Platform Admin Email: $PLATFORM_ADMIN_EMAIL"
echo "🌐 Keycloak Domain: $KEYCLOAK_DOMAIN"
echo "🏰 Keycloak Realm: $KEYCLOAK_REALM"

# First, let's try to login as platform admin and get a token
echo ""
echo "📡 Attempting platform admin login..."

if [ -z "$PLATFORM_ADMIN_PASSWORD" ]; then
    echo "❌ PLATFORM_ADMIN_PASSWORD not found in .env"
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
    
    # Check if the backend logs show the new authentication flow
    echo ""
    echo "📋 Recent backend logs:"
    docker logs confirmd-platform-user-1 --tail=10
else
    echo "❌ Platform admin login failed"
    echo "Error: $LOGIN_RESPONSE"
fi
