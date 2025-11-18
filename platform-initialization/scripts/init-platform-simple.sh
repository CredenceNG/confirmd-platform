#!/bin/bash

# Simple One-Command Platform Initialization
# Usage: ./init-platform-simple.sh "YOUR_API_TOKEN_HERE"
#
# This script is production-ready and can be run from any terminal with Docker access.
# It initializes the entire Confirmd platform with a single command.

set -e

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-confirmd-platform-postgres-1}"
DB_NAME="${DB_NAME:-credebl}"
DB_USER="${DB_USER:-postgres}"
API_TOKEN="$1"

echo "🚀 Confirmd Platform - One-Command Initialization"
echo ""

if [ -z "$API_TOKEN" ]; then
    echo "❌ Error: API token required"
    echo ""
    echo "Usage: $0 \"your-api-token-here\""
    echo ""
    echo "Example:"
    echo "  $0 \"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...\""
    exit 1
fi

# Check Docker
if ! docker ps &>/dev/null; then
    echo "❌ Error: Docker is not running or not accessible"
    exit 1
fi

# Check PostgreSQL
if ! docker ps | grep -q "$POSTGRES_CONTAINER"; then
    echo "❌ Error: PostgreSQL container not running"
    echo "   Expected: $POSTGRES_CONTAINER"
    exit 1
fi

echo "✅ Prerequisites met"
echo ""
echo "Initializing platform..."
echo ""

# All-in-one SQL initialization
docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" << 'EOSQL'
-- Agent Types
INSERT INTO agents_type (id, agent, "createDateTime", "lastChangedDateTime")
VALUES
    (gen_random_uuid(), 'AFJ', NOW(), NOW()),
    (gen_random_uuid(), 'ACAPY', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Org Agent Types
INSERT INTO org_agents_type (id, agent, "createDateTime", "lastChangedDateTime")
VALUES
    (gen_random_uuid(), 'DEDICATED', NOW(), NOW()),
    (gen_random_uuid(), 'SHARED', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Ledgers
DELETE FROM ledgers WHERE name IN ('bcovrin:testnet', 'indicio:testnet', 'indicio:demonet', 'indicio:mainnet');
INSERT INTO ledgers (id, name, "networkType", "poolConfig", "isActive", "networkString", "nymTxnEndpoint", "indyNamespace") VALUES
('ce187820-7c47-4c77-9813-ad30f862cdb1', 'bcovrin:testnet', 'testnet', '{"genesisTransactions":"http://test.bcovrin.vonx.io/genesis","indyNamespace":"bcovrin:testnet"}', true, 'testnet', 'http://test.bcovrin.vonx.io/register', 'bcovrin:testnet'),
(gen_random_uuid(), 'indicio:testnet', 'testnet', '{"genesisTransactions":"https://raw.githubusercontent.com/Indicio-tech/indicio-network/main/genesis_files/pool_transactions_testnet_genesis","indyNamespace":"indicio:testnet"}', true, 'testnet', 'https://selfserve.indiciotech.io/', 'indicio:testnet'),
(gen_random_uuid(), 'indicio:demonet', 'demonet', '{"genesisTransactions":"https://raw.githubusercontent.com/Indicio-tech/indicio-network/main/genesis_files/pool_transactions_demonet_genesis","indyNamespace":"indicio:demonet"}', true, 'demonet', 'https://selfserve.indiciotech.io/', 'indicio:demonet'),
(gen_random_uuid(), 'indicio:mainnet', 'mainnet', '{"genesisTransactions":"https://raw.githubusercontent.com/Indicio-tech/indicio-network/main/genesis_files/pool_transactions_mainnet_genesis","indyNamespace":"indicio:mainnet"}', false, 'mainnet', 'https://selfserve.indiciotech.io/', 'indicio:mainnet');

-- User Roles
INSERT INTO user_role (id, role, "createDateTime", "lastChangedDateTime")
SELECT gen_random_uuid(), 'DEFAULT_USER', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM user_role WHERE role = 'DEFAULT_USER');

INSERT INTO user_role (id, role, "createDateTime", "lastChangedDateTime")
SELECT gen_random_uuid(), 'HOLDER', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM user_role WHERE role = 'HOLDER');

-- Platform Admin User
INSERT INTO "user" (id, "createDateTime", "lastChangedDateTime", email, username, "firstName", "lastName", "isEmailVerified", "keycloakUserId")
VALUES ('1f7fafe5-9a0d-4f8e-9b60-d35f5b992973', NOW(), NOW(), 'admin@getconfirmd.com', 'platformadmin', 'Platform', 'Admin', true, '1f7fafe5-9a0d-4f8e-9b60-d35f5b992973')
ON CONFLICT (id) DO NOTHING;

-- Platform Admin Organization
INSERT INTO organisation (id, "createDateTime", "lastChangedDateTime", "createdBy", "lastChangedBy", name, description, "orgSlug", "publicProfile")
VALUES ('f856e3a4-b09c-4356-82de-b105594eec43', NOW(), NOW(), '1f7fafe5-9a0d-4f8e-9b60-d35f5b992973', '1f7fafe5-9a0d-4f8e-9b60-d35f5b992973', 'Platform Admin', 'System platform administrator organization', 'platform-admin', false)
ON CONFLICT (id) DO NOTHING;

-- Platform Admin Agent
INSERT INTO org_agents (id, "createDateTime", "lastChangedDateTime", "orgId", "createdBy", "lastChangedBy", "walletName", "agentEndPoint", "agentSpinUpStatus", "apiKey", "ledgerId", "orgAgentTypeId", "tenantId")
SELECT gen_random_uuid(), NOW(), NOW(), 'f856e3a4-b09c-4356-82de-b105594eec43', '1f7fafe5-9a0d-4f8e-9b60-d35f5b992973', '1f7fafe5-9a0d-4f8e-9b60-d35f5b992973', 'platform-admin', 'http://platform-admin-agent:8002', 3, 'PLACEHOLDER_TOKEN', 'ce187820-7c47-4c77-9813-ad30f862cdb1', (SELECT id FROM org_agents_type WHERE agent = 'DEDICATED' LIMIT 1), 'platform-admin-tenant'
WHERE NOT EXISTS (SELECT 1 FROM org_agents WHERE "orgId" = 'f856e3a4-b09c-4356-82de-b105594eec43');
EOSQL

echo "✅ Database initialized"
echo ""
echo "Updating API token..."
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Setup MinIO storage
echo ""
echo "📦 Setting up MinIO storage..."
cd "$SCRIPT_DIR"
if [ -f "./5-setup-minio.sh" ]; then
    bash ./5-setup-minio.sh
    echo "✅ MinIO setup complete"
else
    echo "⚠️  MinIO setup script not found, skipping..."
fi

# Update API token
if command -v node &> /dev/null; then
    cd "$SCRIPT_DIR"
    if node ./4-update-platform-token.js "$API_TOKEN"; then
        echo ""
        echo "╔═══════════════════════════════════════════════════════════╗"
        echo "║                                                           ║"
        echo "║   ✅ Platform Initialization Complete!                    ║"
        echo "║                                                           ║"
        echo "╚═══════════════════════════════════════════════════════════╝"
        echo ""
        echo "🔑 Platform Admin Credentials:"
        echo "  Email:    admin@getconfirmd.com"
        echo "  Password: PlatformAdmin123!"
        echo "  Org ID:   f856e3a4-b09c-4356-82de-b105594eec43"
        echo ""
        exit 0
    else
        echo "❌ Token update failed"
        exit 1
    fi
else
    echo "❌ Node.js not found. Please install Node.js to update the API token."
    echo "   Or run manually: node ./4-update-platform-token.js \"$API_TOKEN\""
    exit 1
fi
