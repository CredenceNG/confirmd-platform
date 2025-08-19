#!/bin/bash

# Cleanup script for orphaned Keycloak clients
# This script removes Keycloak clients that exist but don't have corresponding complete organization records

set -e

KEYCLOAK_DOMAIN="https://manager.credence.ng"
KEYCLOAK_REALM="confirmd-bench"
KEYCLOAK_MANAGEMENT_CLIENT_ID="confirmd-bench-management"
KEYCLOAK_MANAGEMENT_CLIENT_SECRET="APwJSRD9xjvfjTTZO0RoUz3y7sWej2eO"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration
KEYCLOAK_DOMAIN="${KEYCLOAK_DOMAIN:-https://manager.credence.ng/}"
KEYCLOAK_REALM="${KEYCLOAK_REALM:-confirmd-bench}"
ORPHANED_CLIENT_ID="ac0a5dc4-ca2b-42f9-a5dc-19e72d2ee948"
ORGANIZATION_NAME="Zanzi Workshops"

# Check if required environment variables are set
if [[ -z "$KEYCLOAK_MANAGEMENT_CLIENT_ID" || -z "$KEYCLOAK_MANAGEMENT_CLIENT_SECRET" ]]; then
    print_error "Required environment variables not set:"
    print_error "  KEYCLOAK_MANAGEMENT_CLIENT_ID"
    print_error "  KEYCLOAK_MANAGEMENT_CLIENT_SECRET"
    exit 1
fi

print_status "=== Keycloak Orphaned Client Cleanup ==="
print_status "Domain: $KEYCLOAK_DOMAIN"
print_status "Realm: $KEYCLOAK_REALM"
print_status "Target Client ID: $ORPHANED_CLIENT_ID"
print_status "Organization: $ORGANIZATION_NAME"
echo

# Get management token
print_status "Getting management token..."
TOKEN_RESPONSE=$(curl -s -X POST \
    "${KEYCLOAK_DOMAIN}realms/${KEYCLOAK_REALM}/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=client_credentials" \
    -d "client_id=${KEYCLOAK_MANAGEMENT_CLIENT_ID}" \
    -d "client_secret=${KEYCLOAK_MANAGEMENT_CLIENT_SECRET}")

if [[ $? -ne 0 ]]; then
    print_error "Failed to get management token"
    exit 1
fi

ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token')
if [[ "$ACCESS_TOKEN" == "null" || -z "$ACCESS_TOKEN" ]]; then
    print_error "Failed to extract access token from response"
    print_error "Response: $TOKEN_RESPONSE"
    exit 1
fi

print_success "Management token obtained"

# Check if client exists
print_status "Checking if client exists in Keycloak..."
CLIENT_SEARCH_URL="${KEYCLOAK_DOMAIN}admin/realms/${KEYCLOAK_REALM}/clients?clientId=${ORPHANED_CLIENT_ID}"

CLIENT_RESPONSE=$(curl -s -X GET \
    "$CLIENT_SEARCH_URL" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json")

if [[ $? -ne 0 ]]; then
    print_error "Failed to search for client"
    exit 1
fi

# Parse response to get client internal ID
CLIENT_COUNT=$(echo "$CLIENT_RESPONSE" | jq '. | length')
if [[ "$CLIENT_COUNT" == "0" ]]; then
    print_warning "Client $ORPHANED_CLIENT_ID not found in Keycloak"
    print_success "No cleanup needed - client doesn't exist"
    exit 0
fi

# Get the internal client ID (different from clientId)
INTERNAL_CLIENT_ID=$(echo "$CLIENT_RESPONSE" | jq -r '.[0].id')
CLIENT_NAME=$(echo "$CLIENT_RESPONSE" | jq -r '.[0].name')

print_status "Found client:"
print_status "  Client ID: $ORPHANED_CLIENT_ID"
print_status "  Internal ID: $INTERNAL_CLIENT_ID"
print_status "  Name: $CLIENT_NAME"

# Confirm deletion
echo
print_warning "This will delete the Keycloak client for '$ORGANIZATION_NAME'"
print_warning "Client ID: $ORPHANED_CLIENT_ID"
print_warning "Internal ID: $INTERNAL_CLIENT_ID"
echo
read -p "Are you sure you want to delete this client? (y/N): " confirm

if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    print_status "Cleanup cancelled by user"
    exit 0
fi

# Delete the client
print_status "Deleting client from Keycloak..."
DELETE_URL="${KEYCLOAK_DOMAIN}admin/realms/${KEYCLOAK_REALM}/clients/${INTERNAL_CLIENT_ID}"

DELETE_RESPONSE=$(curl -s -w "%{http_code}" -X DELETE \
    "$DELETE_URL" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

HTTP_CODE="${DELETE_RESPONSE: -3}"
if [[ "$HTTP_CODE" == "204" ]]; then
    print_success "Client deleted successfully"
else
    print_error "Failed to delete client. HTTP Code: $HTTP_CODE"
    print_error "Response: ${DELETE_RESPONSE%???}"
    exit 1
fi

# Verify deletion
print_status "Verifying client deletion..."
VERIFY_RESPONSE=$(curl -s -X GET \
    "$CLIENT_SEARCH_URL" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json")

VERIFY_COUNT=$(echo "$VERIFY_RESPONSE" | jq '. | length')
if [[ "$VERIFY_COUNT" == "0" ]]; then
    print_success "Client deletion verified - client no longer exists"
else
    print_warning "Client may still exist after deletion attempt"
fi

echo
print_success "=== Cleanup completed ==="
print_status "The organization '$ORGANIZATION_NAME' can now be created again"
print_status "The 409 conflict error should be resolved"