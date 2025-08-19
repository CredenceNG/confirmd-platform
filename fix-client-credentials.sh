#!/bin/bash

# Script to delete existing Keycloak clients for organizations with 409 conflicts
# This allows them to be recreated with proper credentials

set -e

KEYCLOAK_DOMAIN="https://manager.credence.ng"
REALM="confirmd-bench"
MANAGEMENT_CLIENT_ID="confirmd-bench-management"
MANAGEMENT_CLIENT_SECRET="APwJSRD9xjvfjTTZO0RoUz3y7sWej2eO"

echo "🔐 Getting management token..."
TOKEN_RESPONSE=$(curl -s -X POST \
  "${KEYCLOAK_DOMAIN}/realms/${REALM}/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=${MANAGEMENT_CLIENT_ID}&client_secret=${MANAGEMENT_CLIENT_SECRET}")

ACCESS_TOKEN=$(echo $TOKEN_RESPONSE | jq -r '.access_token')

if [ "$ACCESS_TOKEN" = "null" ]; then
  echo "❌ Failed to get access token"
  echo "Response: $TOKEN_RESPONSE"
  exit 1
fi

echo "✅ Access token obtained"

# Organizations to fix
ORG_IDS=(
  "ac0a5dc4-ca2b-42f9-a5dc-19e72d2ee948"  # Zanzi Workshops
  "0f55a222-d750-4921-abc4-acf63d567560"  # University of Jos
)

for ORG_ID in "${ORG_IDS[@]}"; do
  echo "🔍 Checking client for organization: $ORG_ID"
  
  # Get client by clientId
  CLIENT_RESPONSE=$(curl -s -X GET \
    "${KEYCLOAK_DOMAIN}/admin/realms/${REALM}/clients?clientId=${ORG_ID}" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}")
  
  CLIENT_COUNT=$(echo $CLIENT_RESPONSE | jq '. | length')
  
  if [ "$CLIENT_COUNT" -gt 0 ]; then
    CLIENT_ID=$(echo $CLIENT_RESPONSE | jq -r '.[0].id')
    echo "🗑️ Deleting existing client with ID: $CLIENT_ID"
    
    DELETE_RESPONSE=$(curl -s -w "%{http_code}" -X DELETE \
      "${KEYCLOAK_DOMAIN}/admin/realms/${REALM}/clients/${CLIENT_ID}" \
      -H "Authorization: Bearer ${ACCESS_TOKEN}")
    
    if [[ "$DELETE_RESPONSE" == *"204"* ]]; then
      echo "✅ Successfully deleted client for organization: $ORG_ID"
    else
      echo "❌ Failed to delete client for organization: $ORG_ID"
      echo "Response: $DELETE_RESPONSE"
    fi
  else
    echo "ℹ️ No existing client found for organization: $ORG_ID"
  fi
  
  echo ""
done

echo "🎉 Client cleanup completed!"
echo "Organizations can now create new client credentials without 409 conflicts."