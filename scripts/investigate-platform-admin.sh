#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_debug() { echo -e "${BLUE}[DEBUG]${NC} $1"; }

# Configuration from .env
KEYCLOAK_DOMAIN="https://manager.credence.ng"
KEYCLOAK_REALM="confirmd-bench"
KEYCLOAK_MANAGEMENT_CLIENT_ID="confirmd-bench-management"
KEYCLOAK_MANAGEMENT_CLIENT_SECRET="APwJSRD9xjvfjTTZO0RoUz3y7sWej2eO"
PLATFORM_ADMIN_EMAIL="admin@getconfirmd.com"
PLATFORM_ADMIN_PASSWORD="PlatformAdmin123!"

echo "========================================"
echo "PLATFORM ADMIN LOGIN INVESTIGATION"
echo "========================================"

# Step 1: Test basic connectivity
print_status "Testing Keycloak connectivity..."
WELL_KNOWN=$(curl -s "${KEYCLOAK_DOMAIN}/realms/${KEYCLOAK_REALM}/.well-known/openid-configuration")
if [[ $? -eq 0 ]] && [[ -n "$WELL_KNOWN" ]]; then
    print_status "✅ Keycloak is accessible"
    ISSUER=$(echo "$WELL_KNOWN" | jq -r '.issuer')
    print_debug "Issuer: $ISSUER"
else
    print_error "❌ Cannot reach Keycloak at $KEYCLOAK_DOMAIN"
    exit 1
fi

# Step 2: Get admin token
print_status "Getting admin token using management client..."
ADMIN_TOKEN_RESPONSE=$(curl -s -X POST \
  "${KEYCLOAK_DOMAIN}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=${KEYCLOAK_MANAGEMENT_CLIENT_ID}" \
  -d "client_secret=${KEYCLOAK_MANAGEMENT_CLIENT_SECRET}")

ADMIN_TOKEN=$(echo "$ADMIN_TOKEN_RESPONSE" | jq -r '.access_token // empty')

if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" = "null" ]; then
    print_error "❌ Failed to get admin token"
    print_debug "Response: $ADMIN_TOKEN_RESPONSE"
    exit 1
fi

print_status "✅ Admin token acquired"

# Step 3: Check if realm exists
print_status "Checking if realm '$KEYCLOAK_REALM' exists..."
REALM_INFO=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}")

if [[ $(echo "$REALM_INFO" | jq -r '.realm // empty') == "$KEYCLOAK_REALM" ]]; then
    print_status "✅ Realm '$KEYCLOAK_REALM' exists"
else
    print_error "❌ Realm '$KEYCLOAK_REALM' not found"
    print_debug "Response: $REALM_INFO"
    exit 1
fi

# Step 4: Search for platform admin user
print_status "Searching for platform admin user by email..."
USER_SEARCH_RESPONSE=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/users?email=${PLATFORM_ADMIN_EMAIL}")

USER_COUNT=$(echo "$USER_SEARCH_RESPONSE" | jq length)
print_debug "Found $USER_COUNT users with email $PLATFORM_ADMIN_EMAIL"

if [ "$USER_COUNT" -eq 0 ]; then
    print_error "❌ Platform admin user not found by email"
    
    # Also try searching by username
    print_status "Searching by username 'platform-admin'..."
    USER_SEARCH_RESPONSE=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
      "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/users?username=platform-admin")
    
    USER_COUNT=$(echo "$USER_SEARCH_RESPONSE" | jq length)
    if [ "$USER_COUNT" -eq 0 ]; then
        print_error "❌ Platform admin user not found by username either"
        print_status "Available users in realm:"
        ALL_USERS=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
          "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/users?max=20")
        echo "$ALL_USERS" | jq -r '.[] | "\(.username) - \(.email)"'
        exit 1
    fi
fi

USER_ID=$(echo "$USER_SEARCH_RESPONSE" | jq -r '.[0].id')
print_status "✅ Platform admin user found: $USER_ID"

# Step 5: Get detailed user information
print_status "Getting detailed user information..."
USER_DETAILS=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/users/$USER_ID")

echo "User Details:"
echo "$USER_DETAILS" | jq '{
  id: .id,
  username: .username,
  email: .email,
  enabled: .enabled,
  emailVerified: .emailVerified,
  firstName: .firstName,
  lastName: .lastName,
  createdTimestamp: .createdTimestamp,
  attributes: .attributes
}'

ENABLED=$(echo "$USER_DETAILS" | jq -r '.enabled')
EMAIL_VERIFIED=$(echo "$USER_DETAILS" | jq -r '.emailVerified')

if [ "$ENABLED" != "true" ]; then
    print_error "❌ User is disabled"
    exit 1
fi

if [ "$EMAIL_VERIFIED" != "true" ]; then
    print_warning "⚠️ Email is not verified"
fi

# Step 6: Check user credentials
print_status "Checking user credentials..."
CREDENTIALS=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/users/$USER_ID/credentials")

echo "User Credentials:"
echo "$CREDENTIALS" | jq '.[] | {
  type: .type,
  temporary: .temporary,
  createdDate: .createdDate
}'

PASSWORD_CREDS=$(echo "$CREDENTIALS" | jq '.[] | select(.type == "password")')
if [ -z "$PASSWORD_CREDS" ] || [ "$PASSWORD_CREDS" = "null" ]; then
    print_error "❌ No password credentials found for user"
else
    print_status "✅ Password credentials exist"
fi

# Step 7: Check realm roles
print_status "Checking user's realm roles..."
REALM_ROLES=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/users/$USER_ID/role-mappings/realm")

echo "Assigned Realm Roles:"
echo "$REALM_ROLES" | jq -r '.[].name'

HAS_PLATFORM_ADMIN=$(echo "$REALM_ROLES" | jq -r '.[] | select(.name == "platform_admin") | .name')
HAS_MB_USER=$(echo "$REALM_ROLES" | jq -r '.[] | select(.name == "mb-user") | .name')

if [ -z "$HAS_PLATFORM_ADMIN" ]; then
    print_warning "⚠️ User does not have 'platform_admin' role"
fi

if [ -z "$HAS_MB_USER" ]; then
    print_warning "⚠️ User does not have 'mb-user' role"
fi

# Step 8: Check available realm roles
print_status "Checking available realm roles..."
AVAILABLE_REALM_ROLES=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/roles")

echo "Available Realm Roles:"
echo "$AVAILABLE_REALM_ROLES" | jq -r '.[].name'

# Step 9: Check account client configuration
print_status "Checking account client configuration..."
ACCOUNT_CLIENT=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/clients?clientId=account")

ACCOUNT_CLIENT_ID=$(echo "$ACCOUNT_CLIENT" | jq -r '.[0].id // empty')

if [ -n "$ACCOUNT_CLIENT_ID" ] && [ "$ACCOUNT_CLIENT_ID" != "null" ]; then
    ACCOUNT_CLIENT_DETAILS=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
      "${KEYCLOAK_DOMAIN}/admin/realms/${KEYCLOAK_REALM}/clients/$ACCOUNT_CLIENT_ID")
    
    echo "Account Client Configuration:"
    echo "$ACCOUNT_CLIENT_DETAILS" | jq '{
      clientId: .clientId,
      enabled: .enabled,
      publicClient: .publicClient,
      directAccessGrantsEnabled: .directAccessGrantsEnabled,
      standardFlowEnabled: .standardFlowEnabled,
      implicitFlowEnabled: .implicitFlowEnabled,
      serviceAccountsEnabled: .serviceAccountsEnabled
    }'
    
    DIRECT_ACCESS_ENABLED=$(echo "$ACCOUNT_CLIENT_DETAILS" | jq -r '.directAccessGrantsEnabled')
    if [ "$DIRECT_ACCESS_ENABLED" != "true" ]; then
        print_error "❌ Direct access grants are disabled for account client"
    fi
else
    print_error "❌ Account client not found"
fi

# Step 10: Test direct authentication
print_status "Testing direct authentication with platform admin credentials..."
AUTH_RESPONSE=$(curl -s -X POST \
  "${KEYCLOAK_DOMAIN}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=account" \
  -d "username=${PLATFORM_ADMIN_EMAIL}" \
  -d "password=${PLATFORM_ADMIN_PASSWORD}")

ACCESS_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.access_token // empty')
ERROR_MSG=$(echo "$AUTH_RESPONSE" | jq -r '.error // empty')
ERROR_DESCRIPTION=$(echo "$AUTH_RESPONSE" | jq -r '.error_description // empty')

if [ -n "$ACCESS_TOKEN" ] && [ "$ACCESS_TOKEN" != "null" ]; then
    print_status "✅ Authentication successful!"
    
    # Decode token to show user details
    TOKEN_PAYLOAD=$(echo "$ACCESS_TOKEN" | cut -d'.' -f2)
    # Add padding if needed for base64 decoding
    PADDING=$(( 4 - ${#TOKEN_PAYLOAD} % 4 ))
    if [ $PADDING -ne 4 ]; then
        TOKEN_PAYLOAD="${TOKEN_PAYLOAD}$(printf '=%.0s' $(seq 1 $PADDING))"
    fi
    
    echo "Token Claims:"
    echo "$TOKEN_PAYLOAD" | base64 -d 2>/dev/null | jq '{
      preferred_username: .preferred_username,
      email: .email,
      email_verified: .email_verified,
      realm_access: .realm_access.roles,
      resource_access: .resource_access
    }'
    
    print_status "Authentication is working correctly!"
    
elif [ -n "$ERROR_MSG" ] && [ "$ERROR_MSG" != "null" ]; then
    print_error "❌ Authentication failed"
    print_error "Error: $ERROR_MSG"
    if [ -n "$ERROR_DESCRIPTION" ] && [ "$ERROR_DESCRIPTION" != "null" ]; then
        print_error "Description: $ERROR_DESCRIPTION"
    fi
    
    case "$ERROR_MSG" in
        "invalid_grant")
            print_error "This usually means invalid username/password or user is disabled"
            ;;
        "unauthorized_client")
            print_error "Client is not authorized for password grant type"
            ;;
        "invalid_client")
            print_error "Client credentials are invalid"
            ;;
        *)
            print_error "Unknown authentication error"
            ;;
    esac
else
    print_error "❌ Unexpected authentication response"
    print_debug "Full response: $AUTH_RESPONSE"
fi

# Step 11: Test with different clients
print_status "Testing authentication with different client configurations..."

# Test with admin-cli client
print_status "Testing with admin-cli client..."
ADMIN_CLI_AUTH=$(curl -s -X POST \
  "${KEYCLOAK_DOMAIN}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" \
  -d "username=${PLATFORM_ADMIN_EMAIL}" \
  -d "password=${PLATFORM_ADMIN_PASSWORD}")

ADMIN_CLI_TOKEN=$(echo "$ADMIN_CLI_AUTH" | jq -r '.access_token // empty')
if [ -n "$ADMIN_CLI_TOKEN" ] && [ "$ADMIN_CLI_TOKEN" != "null" ]; then
    print_status "✅ Authentication successful with admin-cli client"
else
    print_warning "⚠️ Authentication failed with admin-cli client"
    print_debug "Response: $(echo "$ADMIN_CLI_AUTH" | jq -r '.error // "No error field"')"
fi

echo "========================================"
echo "INVESTIGATION COMPLETE"
echo "========================================"
