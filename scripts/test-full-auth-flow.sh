#!/bin/bash

echo "🧪 Testing User Profile Endpoint with Valid Platform Admin Token..."

# Extract variables directly from .env
KEYCLOAK_DOMAIN=$(grep KEYCLOAK_DOMAIN .env | cut -d'=' -f2)
KEYCLOAK_REALM=$(grep KEYCLOAK_REALM .env | cut -d'=' -f2)
PLATFORM_ADMIN_EMAIL=$(grep PLATFORM_ADMIN_EMAIL .env | cut -d'=' -f2)

echo "📧 Platform Admin Email: $PLATFORM_ADMIN_EMAIL"
echo "🌐 Keycloak Domain: $KEYCLOAK_DOMAIN"
echo "🏰 Keycloak Realm: $KEYCLOAK_REALM"

# First, let's get a token using the platform-admin client with password grant
# This is what the frontend would do when a user logs in
echo ""
echo "📡 Attempting platform admin login using platform-admin client..."

# The frontend would get the password from the user input, but for testing
# we'll use a plain text password that we know works
PLAIN_PASSWORD="testPassword123!"

# Try a few different approaches to get a valid token
echo "Trying with simple test password..."
LOGIN_RESPONSE=$(curl -s -X POST "${KEYCLOAK_DOMAIN}realms/${KEYCLOAK_REALM}/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&client_id=platform-admin&username=${PLATFORM_ADMIN_EMAIL}&password=${PLAIN_PASSWORD}")

echo "📥 Login Response: $LOGIN_RESPONSE"

# If that doesn't work, let's try using the management client to get a token for testing
if ! echo "$LOGIN_RESPONSE" | grep -q "access_token"; then
    echo "❌ Password grant failed, trying client credentials for testing..."
    
    KEYCLOAK_MANAGEMENT_CLIENT_ID=$(grep KEYCLOAK_MANAGEMENT_CLIENT_ID .env | cut -d'=' -f2)
    KEYCLOAK_MANAGEMENT_CLIENT_SECRET=$(grep KEYCLOAK_MANAGEMENT_CLIENT_SECRET .env | cut -d'=' -f2)
    
    LOGIN_RESPONSE=$(curl -s -X POST "${KEYCLOAK_DOMAIN}realms/${KEYCLOAK_REALM}/protocol/openid-connect/token" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "grant_type=client_credentials&client_id=${KEYCLOAK_MANAGEMENT_CLIENT_ID}&client_secret=${KEYCLOAK_MANAGEMENT_CLIENT_SECRET}")
    
    echo "📥 Management Client Response: $LOGIN_RESPONSE"
fi

# Check if we got an access token
if echo "$LOGIN_RESPONSE" | grep -q "access_token"; then
    echo "✅ Token obtained successfully!"
    ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token')
    echo "🎯 Access Token: ${ACCESS_TOKEN:0:50}..."
    
    # Now test the profile endpoint and monitor the backend logs
    echo ""
    echo "👤 Testing profile endpoint..."
    echo "📋 Monitoring backend logs for authentication flow..."
    
    # Start monitoring logs in background
    docker logs confirmd-platform-user-1 --follow &
    LOGS_PID=$!
    
    sleep 2
    
    # Make the profile request
    PROFILE_RESPONSE=$(curl -s -X GET "http://localhost:5000/users/profile" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    
    sleep 3
    
    # Stop monitoring logs
    kill $LOGS_PID 2>/dev/null
    
    echo ""
    echo "📥 Profile Response: $PROFILE_RESPONSE"
else
    echo "❌ Failed to get token"
    echo "Error: $LOGIN_RESPONSE"
fi
