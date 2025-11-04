#!/bin/bash

# Local test script for platform-admin setup
# This simulates what happens in the Docker container

echo "🧪 Testing Platform Admin Configuration Locally..."

# Set some test environment variables
export AGENT_LABEL="platform-admin-test"
export ADMIN_PORT="8002"
export INBOUND_PORT="9002"
export WALLET_URL="confirmd-platform-postgres-1:5432/platform-admin"

# Create config in local directory instead of /app/
echo "📝 Creating test configuration..."

cat > ./test-config.json << EOF
{
  "label": "${AGENT_LABEL:-platform-admin}",
  "walletId": "${WALLET_ID:-platform-admin}",
  "walletKey": "${WALLET_KEY:-platform-admin-key}",
  "walletType": "${WALLET_TYPE:-postgres}",
  "walletUrl": "${WALLET_URL:-confirmd-platform-postgres-1:5432/platform-admin}",
  "walletAccount": "${WALLET_ACCOUNT:-postgres}",
  "walletPassword": "${WALLET_PASSWORD:-postgres}",
  "walletAdminAccount": "${WALLET_ADMIN_ACCOUNT:-postgres}",
  "walletAdminPassword": "${WALLET_ADMIN_PASSWORD:-postgres}",
  "walletScheme": "${WALLET_SCHEME:-DatabasePerWallet}",
  "walletConnectTimeout": ${WALLET_CONNECT_TIMEOUT:-60000},
  "walletMaxConnections": ${WALLET_MAX_CONNECTIONS:-90},
  "walletIdleTimeout": ${WALLET_IDLE_TIMEOUT:-180000},
  "indyLedger": [
    {
      "genesisTransactions": "https://raw.githubusercontent.com/Indicio-tech/indicio-network/main/genesis_files/pool_transactions_testnet_genesis",
      "indyNamespace": "indicio:testnet"
    },
    {
      "genesisTransactions": "https://raw.githubusercontent.com/Indicio-tech/indicio-network/main/genesis_files/pool_transactions_demonet_genesis",
      "indyNamespace": "indicio:demonet"
    },
    {
      "genesisTransactions": "${BCOVRIN_GENESIS_URL:-http://test.bcovrin.vonx.io/genesis}",
      "indyNamespace": "${BCOVRIN_NAMESPACE:-bcovrin:testnet}"
    }
  ],
  "endpoint": ["${AGENT_ENDPOINT_HTTP:-https://agent.confamd.com}", "${AGENT_ENDPOINT_WSS:-wss://agent.confamd.com}"],
  "autoAcceptConnections": ${AUTO_ACCEPT_CONNECTIONS:-true},
  "autoAcceptCredentials": "${AUTO_ACCEPT_CREDENTIALS:-always}",
  "autoAcceptProofs": "${AUTO_ACCEPT_PROOFS:-contentApproved}",
  "useLegacyDidSovPrefix": ${USE_LEGACY_DID_SOV_PREFIX:-false},
  "useDidSovPrefixWhereApplicable": ${USE_DID_SOV_PREFIX_WHERE_APPLICABLE:-false},
  "logLevel": ${LOG_LEVEL:-1},
  "inboundTransport": [
    {
      "transport": "http",
      "port": ${INBOUND_PORT:-9002}
    }
  ],
  "outboundTransport": ["http"],
  "autoAcceptMediationRequests": ${AUTO_ACCEPT_MEDIATION_REQUESTS:-true},
  "adminPort": ${ADMIN_PORT:-8002},
  "tenancy": ${TENANCY_ENABLED:-true},
  "webhookUrl": "${WEBHOOK_URL:-http://nginx-proxy:5000/webhooks}"
}
EOF

echo "✅ Test configuration created: ./test-config.json"
echo ""
echo "🔧 Configuration Preview:"
cat test-config.json | head -10
echo "..."
echo ""
echo "✅ Local test completed successfully!"
echo ""
echo "🚀 To run the actual platform admin agent:"
echo "   cd platform-admin"
echo "   docker-compose up -d"
echo ""
echo "🔍 To view logs:"
echo "   docker-compose logs -f platform-admin-agent"