#!/bin/bash

# Script to create a test user and get authentication token

set -e

API_URL="http://localhost:5000"

echo "👤 Creating test user..."

# Create a test user
signup_response=$(curl -s -X POST \
  "$API_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-user@example.com",
    "password": "TestPassword123!",
    "firstName": "Test",
    "lastName": "User"
  }')

echo "📝 Signup response: $signup_response"

# Check if user creation was successful
if echo "$signup_response" | grep -q '"statusCode":201'; then
  echo "✅ Test user created successfully!"
else
  echo "⚠️  User creation response: $signup_response"
  echo "🔄 Proceeding with login attempt..."
fi

echo ""
echo "🔐 Attempting to login with test user..."

# Login with the test user
login_response=$(curl -s -X POST \
  "$API_URL/auth/signin" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-user@example.com",
    "password": "TestPassword123!"
  }')

echo "📝 Login response: $login_response"

# Check if login was successful
if echo "$login_response" | grep -q '"statusCode":200'; then
  # Extract the access token
  access_token=$(echo "$login_response" | jq -r '.data.access_token')
  
  if [ "$access_token" != "null" ] && [ -n "$access_token" ]; then
    echo "✅ Login successful!"
    echo "🎫 Access Token: $access_token"
    echo ""
    echo "📋 To use this token for testing, run:"
    echo "export AUTH_TOKEN='$access_token'"
    echo ""
    echo "🧪 Then test wallet creation with:"
    echo "bash scripts/test-wallet-creation.sh"
  else
    echo "❌ Failed to extract access token from response"
    exit 1
  fi
else
  echo "❌ Login failed"
  echo "Response: $login_response"
  exit 1
fi
