#!/bin/bash

# Test Wallet Creation API and Socket.IO Events
# This script simulates a frontend wallet creation request

echo "🧪 Testing Wallet Creation Flow..."

# Configuration - use existing organization
ORG_ID="${ORG_ID:-cf735998-1632-469f-833f-f7cd29adf914}"  # Confirmd Issuer org
API_URL="${API_URL:-http://localhost:5000}"
AUTH_TOKEN="${AUTH_TOKEN:-your-auth-token-here}"  # Set via environment variable

echo "📋 Test Configuration:"
echo "   Organization ID: $ORG_ID"
echo "   API URL: $API_URL"
echo "   Socket ID: test-socket-$(date +%s)"

# Pre-flight checks
echo ""
echo "🔍 Pre-flight checks..."

# Check if the API Gateway is running
if ! curl -s "$API_URL/health" > /dev/null 2>&1; then
    echo "❌ API Gateway not responding at $API_URL"
    echo "   Make sure the confirmd platform is running locally"
    echo "   Try: docker-compose -f docker-compose-dev.yml up"
    exit 1
else
    echo "✅ API Gateway is responding at $API_URL"
fi

# Check if required Docker containers are running
echo "🐳 Checking Docker containers..."
required_containers=(
    "confirmd-platform-agent-service-1"
    "confirmd-platform-api-gateway-1"
    "postgres"
    "redis"
    "nats"
)

for container in "${required_containers[@]}"; do
    if docker ps --format "table {{.Names}}" | grep -q "$container"; then
        echo "✅ $container is running"
    else
        echo "❌ $container is not running"
        echo "   Start with: docker-compose -f docker-compose-dev.yml up -d"
        exit 1
    fi
done

# Check external Keycloak connectivity
echo "🔐 Checking external Keycloak connectivity..."
KEYCLOAK_URL="https://manager.credence.ng/realms/confirmd-bench"
if curl -s "$KEYCLOAK_URL" > /dev/null 2>&1; then
    echo "✅ External Keycloak is accessible"
else
    echo "⚠️  External Keycloak connectivity issue"
    echo "   URL: $KEYCLOAK_URL"
    echo "   This may affect authentication"
fi

# Check if auth token is provided
if [[ "$AUTH_TOKEN" == "your-auth-token-here" ]]; then
    echo ""
    echo "⚠️  Warning: Using placeholder auth token"
    echo "   Set AUTH_TOKEN environment variable with a valid token"
    echo "   Example: export AUTH_TOKEN='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'"
    echo ""
    echo "📋 To get a valid token:"
    echo "   1. Login to the frontend application"
    echo "   2. Open browser dev tools > Network tab"
    echo "   3. Make any API request and copy the Authorization header"
    echo ""
fi

# Create test payload
SOCKET_ID="test-socket-$(date +%s)"
PAYLOAD=$(cat <<EOF
{
  "label": "Test_Wallet_$(date +%s)",
  "keyType": "ed25519",
  "method": "indy",
  "network": "indicio:testnet",
  "clientSocketId": "$SOCKET_ID"
}
EOF
)

echo ""
echo "📤 Sending wallet creation request..."
echo "Payload: $PAYLOAD"

# Make API request
RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d "$PAYLOAD" \
  "$API_URL/orgs/$ORG_ID/agents/wallet")

# Extract status code and body
HTTP_STATUS=$(echo $RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
HTTP_BODY=$(echo $RESPONSE | sed -e 's/HTTPSTATUS\:.*//g')

echo ""
echo "📨 API Response:"
echo "   Status Code: $HTTP_STATUS"
echo "   Response Body: $HTTP_BODY"

if [[ $HTTP_STATUS -eq 201 ]]; then
    echo "✅ Wallet creation request submitted successfully!"
    echo "🔍 Check Socket.IO events in frontend for real-time updates"
    echo ""
    echo "Expected events sequence:"
    echo "   1. 🚀 agent-spinup-process-initiated"
    echo "   2. ✅ agent-spinup-process-completed"
    echo "   3. 📝 did-publish-process-initiated"
    echo "   4. ✅ did-publish-process-completed"
    echo "   5. 🔗 invitation-url-creation-started"
    echo "   6. 🎉 invitation-url-creation-success"
    
    # Try to extract wallet details from response
    if command -v jq > /dev/null 2>&1; then
        echo ""
        echo "📋 Wallet Creation Details:"
        echo "$HTTP_BODY" | jq '.' 2>/dev/null || echo "$HTTP_BODY"
    else
        echo ""
        echo "📋 Raw Response: $HTTP_BODY"
        echo "   (Install 'jq' for prettier JSON formatting)"
    fi
    
elif [[ $HTTP_STATUS -eq 401 ]]; then
    echo "❌ Authentication failed (401 Unauthorized)"
    echo "   Check your AUTH_TOKEN - it may be expired or invalid"
    echo "   Response: $HTTP_BODY"
elif [[ $HTTP_STATUS -eq 403 ]]; then
    echo "❌ Access forbidden (403 Forbidden)"
    echo "   Check if your user has permission to create wallets for this organization"
    echo "   Response: $HTTP_BODY"
elif [[ $HTTP_STATUS -eq 404 ]]; then
    echo "❌ Organization not found (404 Not Found)"
    echo "   Check if organization '$ORG_ID' exists"
    echo "   Response: $HTTP_BODY"
elif [[ $HTTP_STATUS -eq 409 ]]; then
    echo "❌ Wallet already exists (409 Conflict)"
    echo "   This organization already has a wallet"
    echo "   Response: $HTTP_BODY"
else
    echo "❌ Wallet creation request failed"
    echo "   Status Code: $HTTP_STATUS"
    echo "   Response: $HTTP_BODY"
    echo "   Check authentication token and organization setup"
fi

echo ""
echo "🔍 Monitoring backend logs for wallet creation process..."
echo "Use: docker logs -f confirmd-platform-agent-service-1"
