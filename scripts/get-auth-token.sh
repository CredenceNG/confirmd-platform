#!/bin/bash

# Script to authenticate and get a JWT token for testing
# Uses proper AES encryption like the frontend

set -e

# Load environment variables
if [ -f .env ]; then
    source .env
fi

API_URL="http://localhost:5000"
CRYPTO_KEY="${CRYPTO_PRIVATE_KEY:-dzIvVU5uMa0R3sYwdjEEuT4id17mPpjr}"

echo "🔐 Authenticating with platform admin credentials..."

# Generate encrypted password like the frontend does
echo "🔑 Encrypting password..."
encrypted_password=$(node -e "
const crypto = require('crypto-js');
const password = 'PlatformAdmin123!';
const encrypted = crypto.AES.encrypt(JSON.stringify(password), '$CRYPTO_KEY').toString();
console.log(encrypted);
")

echo "🔒 Encrypted password: $encrypted_password"

# Authenticate with platform admin credentials
response=$(curl -s -X POST \
  "$API_URL/auth/signin" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@getconfirmd.com",
    "password": "'"$encrypted_password"'"
  }')

# Check if authentication was successful
if echo "$response" | grep -q '"statusCode":200'; then
  # Extract the access token
  access_token=$(echo "$response" | jq -r '.data.access_token')
  
  if [ "$access_token" != "null" ] && [ -n "$access_token" ]; then
    echo "✅ Authentication successful!"
    echo "🎫 Access Token: $access_token"
    echo ""
    echo "📋 To use this token for testing, run:"
    echo "export AUTH_TOKEN='$access_token'"
    echo ""
    echo "🧪 Then test wallet creation with:"
    echo "bash scripts/test-wallet-creation.sh"
  else
    echo "❌ Failed to extract access token from response"
    echo "Response: $response"
    exit 1
  fi
else
  echo "❌ Authentication failed"
  echo "Response: $response"
  exit 1
fi
