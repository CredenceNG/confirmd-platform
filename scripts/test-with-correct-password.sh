#!/bin/bash

echo "🧪 Testing User Profile Endpoint with Correct Platform Admin Credentials..."

# Extract variables directly from .env
KEYCLOAK_DOMAIN=$(grep KEYCLOAK_DOMAIN .env | cut -d'=' -f2)
KEYCLOAK_REALM=$(grep KEYCLOAK_REALM .env | cut -d'=' -f2)
PLATFORM_ADMIN_EMAIL=$(grep PLATFORM_ADMIN_EMAIL .env | cut -d'=' -f2)

echo "📧 Platform Admin Email: $PLATFORM_ADMIN_EMAIL"
echo "🌐 Keycloak Domain: $KEYCLOAK_DOMAIN"
echo "🏰 Keycloak Realm: $KEYCLOAK_REALM"

# Use the password that was set by the reset script
PLATFORM_PASSWORD="PlatformAdmin123!"

echo ""
echo "📡 Attempting platform admin login with correct password..."

LOGIN_RESPONSE=$(curl -s -X POST "${KEYCLOAK_DOMAIN}realms/${KEYCLOAK_REALM}/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&client_id=platform-admin&username=${PLATFORM_ADMIN_EMAIL}&password=${PLATFORM_PASSWORD}")

echo "📥 Login Response: $LOGIN_RESPONSE"

# Check if we got an access token
if echo "$LOGIN_RESPONSE" | grep -q "access_token"; then
    echo "✅ Platform admin login successful!"
    ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token')
    echo "🎯 Access Token: ${ACCESS_TOKEN:0:50}..."
    
    # Now test the profile endpoint and monitor the backend logs
    echo ""
    echo "👤 Testing profile endpoint..."
    echo "📋 Monitoring backend logs for authentication flow..."
    
    # Start monitoring logs in background
    docker logs confirmd-platform-user-1 --follow --tail=0 &
    LOGS_PID=$!
    
    sleep 2
    
    # Make the profile request
    echo "Making request to /users/profile..."
    PROFILE_RESPONSE=$(curl -s -X GET "http://localhost:5000/users/profile" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    
    sleep 5
    
    # Stop monitoring logs
    kill $LOGS_PID 2>/dev/null
    
    echo ""
    echo "📥 Profile Response: $PROFILE_RESPONSE"
else
    echo "❌ Platform admin login failed"
    echo "Error: $LOGIN_RESPONSE"
fi
