#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

# Configuration
KEYCLOAK_DOMAIN="https://manager.credence.ng"
KEYCLOAK_REALM="confirmd-bench"

echo "========================================"
echo "COMPREHENSIVE TOKEN DEBUGGING"
echo "========================================"

# Test authentication with different approaches
print_status "Testing authentication and decoding full token..."

AUTH_RESPONSE=$(curl -s -X POST \
  "${KEYCLOAK_DOMAIN}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=account" \
  -d "username=admin@getconfirmd.com" \
  -d "password=PlatformAdmin123!" \
  -d "scope=openid roles profile email")

ACCESS_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.access_token // empty')

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "null" ]; then
    print_error "❌ Authentication failed"
    echo "Response: $AUTH_RESPONSE"
    exit 1
fi

print_status "✅ Authentication successful!"

# Decode all parts of the JWT
print_status "Decoding JWT header..."
HEADER=$(echo "$ACCESS_TOKEN" | cut -d'.' -f1)
HEADER_PADDED="$HEADER$(printf '%*s' $((4 - ${#HEADER} % 4)) '' | tr ' ' '=')"
DECODED_HEADER=$(echo "$HEADER_PADDED" | base64 -d 2>/dev/null | jq '.' 2>/dev/null || echo "Failed to decode header")
echo "Header: $DECODED_HEADER"

print_status "Decoding JWT payload..."
PAYLOAD=$(echo "$ACCESS_TOKEN" | cut -d'.' -f2)
PAYLOAD_PADDED="$PAYLOAD$(printf '%*s' $((4 - ${#PAYLOAD} % 4)) '' | tr ' ' '=')"
DECODED_PAYLOAD=$(echo "$PAYLOAD_PADDED" | base64 -d 2>/dev/null | jq '.' 2>/dev/null || echo "Failed to decode payload")
echo "Payload:"
echo "$DECODED_PAYLOAD" | jq '.'

# Check specific claims
print_status "Checking specific claims..."
REALM_ACCESS=$(echo "$DECODED_PAYLOAD" | jq -r '.realm_access // null')
RESOURCE_ACCESS=$(echo "$DECODED_PAYLOAD" | jq -r '.resource_access // null')
ROLES=$(echo "$DECODED_PAYLOAD" | jq -r '.roles // null')

echo "realm_access: $REALM_ACCESS"
echo "resource_access: $RESOURCE_ACCESS"  
echo "roles: $ROLES"

# Check user info endpoint
print_status "Checking user info endpoint..."
USERINFO_RESPONSE=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
  "${KEYCLOAK_DOMAIN}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/userinfo")

echo "User info response:"
echo "$USERINFO_RESPONSE" | jq '.'

# Try with admin-cli client
print_status "Testing with admin-cli client..."
ADMIN_CLI_RESPONSE=$(curl -s -X POST \
  "${KEYCLOAK_DOMAIN}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" \
  -d "username=admin@getconfirmd.com" \
  -d "password=PlatformAdmin123!")

ADMIN_CLI_TOKEN=$(echo "$ADMIN_CLI_RESPONSE" | jq -r '.access_token // empty')

if [ -n "$ADMIN_CLI_TOKEN" ] && [ "$ADMIN_CLI_TOKEN" != "null" ]; then
    print_status "✅ Admin-cli authentication successful!"
    
    # Decode admin-cli token
    ADMIN_CLI_PAYLOAD=$(echo "$ADMIN_CLI_TOKEN" | cut -d'.' -f2)
    ADMIN_CLI_PAYLOAD_PADDED="$ADMIN_CLI_PAYLOAD$(printf '%*s' $((4 - ${#ADMIN_CLI_PAYLOAD} % 4)) '' | tr ' ' '=')"
    ADMIN_CLI_DECODED=$(echo "$ADMIN_CLI_PAYLOAD_PADDED" | base64 -d 2>/dev/null | jq '.' 2>/dev/null)
    
    echo "Admin-cli token payload:"
    echo "$ADMIN_CLI_DECODED" | jq '.'
    
    ADMIN_CLI_REALM_ACCESS=$(echo "$ADMIN_CLI_DECODED" | jq -r '.realm_access // null')
    echo "Admin-cli realm_access: $ADMIN_CLI_REALM_ACCESS"
else
    print_warning "⚠️ Admin-cli authentication failed"
    echo "Response: $ADMIN_CLI_RESPONSE"
fi

echo "========================================"
echo "TOKEN DEBUGGING COMPLETE"
echo "========================================"
