#!/bin/bash

# Script 4: Update Platform Admin API Token
# Encrypts and updates the platform admin agent API token

set -e

# Check if API token was provided
if [ -z "$1" ]; then
    echo "❌ Error: API token not provided"
    echo ""
    echo "Usage: ./4-update-platform-token.sh \"your-api-token-here\""
    echo ""
    echo "Example:"
    echo "  ./4-update-platform-token.sh \"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...\""
    exit 1
fi

NEW_TOKEN="$1"

echo "═══════════════════════════════════════════════════════════"
echo "  Confirmd Platform - Update Platform Admin API Token"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check if services are running
if ! docker ps | grep -q confirmd-platform-agent-service-1; then
    echo "❌ Error: agent-service container is not running"
    exit 1
fi

if ! docker ps | grep -q confirmd-platform-postgres-1; then
    echo "❌ Error: PostgreSQL container is not running"
    exit 1
fi

echo "🔐 Encrypting API token..."
# Encrypt the token using the platform's AES encryption
docker exec confirmd-platform-agent-service-1 node -e "
const CryptoJS = require('crypto-js');
const secretKey = process.env.CRYPTO_PRIVATE_KEY || 'defaultsecretkey';
const encryptedToken = CryptoJS.AES.encrypt(JSON.stringify('$NEW_TOKEN'), secretKey).toString();
console.log(encryptedToken);
" 2>/dev/null | tail -1 > /tmp/encrypted_token.txt

ENCRYPTED_TOKEN=$(cat /tmp/encrypted_token.txt)

if [ -z "$ENCRYPTED_TOKEN" ]; then
    echo "❌ Error: Failed to encrypt token"
    rm -f /tmp/encrypted_token.txt
    exit 1
fi

echo "✅ Token encrypted successfully"
echo "   Preview: ${ENCRYPTED_TOKEN:0:50}..."
echo ""

echo "💾 Updating database..."
# Update the database with the encrypted token
docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -c "
UPDATE org_agents
SET \"apiKey\" = '$ENCRYPTED_TOKEN',
    \"lastChangedDateTime\" = NOW()
WHERE \"orgId\" = 'f856e3a4-b09c-4356-82de-b105594eec43';
"

# Verify the update
UPDATED_COUNT=$(docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -t -c "
SELECT COUNT(*) FROM org_agents
WHERE \"orgId\" = 'f856e3a4-b09c-4356-82de-b105594eec43'
AND \"apiKey\" = '$ENCRYPTED_TOKEN';
" | xargs)

if [ "$UPDATED_COUNT" = "1" ]; then
    echo "✅ Database updated successfully"
    echo ""
    echo "🔍 Verifying platform admin agent..."
    docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -c "
    SELECT
        \"walletName\",
        \"agentEndPoint\",
        \"agentSpinUpStatus\",
        LEFT(\"apiKey\", 40) || '...' as api_key_preview
    FROM org_agents
    WHERE \"orgId\" = 'f856e3a4-b09c-4356-82de-b105594eec43';
    "
else
    echo "❌ Error: Failed to update database"
    rm -f /tmp/encrypted_token.txt
    exit 1
fi

# Cleanup
rm -f /tmp/encrypted_token.txt

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Platform admin API token updated successfully!"
echo "═══════════════════════════════════════════════════════════"
