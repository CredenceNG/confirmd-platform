#!/bin/bash

# Platform Admin Agent Entrypoint Script
# Processes environment variables into config.json

echo "🚀 Starting Platform Admin Agent..."

# Process config template with environment variables
if [ -f "/app/config.template.json" ]; then
    echo "📝 Processing config template with environment variables..."
    
    # Use envsubst if available, otherwise use the static config
    if command -v envsubst >/dev/null 2>&1; then
        envsubst < /app/config.template.json > /app/config.json
    else
        echo "📄 envsubst not available, creating config from environment variables..."
        # Create config directly from environment variables
        cat > /app/config.json << EOF
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
    fi
    
    echo "✅ Configuration processed successfully"
else
    echo "📄 Config template not found, using static configuration..."
    # Fallback to static config if template is missing
    cp /app/config.json.backup /app/config.json 2>/dev/null || cat > /app/config.json << 'EOF'
{
  "label": "platform-admin",
  "walletId": "platform-admin",
  "walletKey": "platform-admin-key",
  "walletType": "postgres",
  "walletUrl": "confirmd-platform-postgres-1:5432/platform-admin",
  "walletAccount": "postgres",
  "walletPassword": "postgres",
  "walletAdminAccount": "postgres",
  "walletAdminPassword": "postgres",
  "walletScheme": "DatabasePerWallet",
  "walletConnectTimeout": 60000,
  "walletMaxConnections": 90,
  "walletIdleTimeout": 180000,
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
      "genesisTransactions": "http://test.bcovrin.vonx.io/genesis",
      "indyNamespace": "bcovrin:testnet"
    }
  ],
  "endpoint": ["https://agent.confamd.com", "wss://agent.confamd.com"],
  "autoAcceptConnections": true,
  "autoAcceptCredentials": "always",
  "autoAcceptProofs": "contentApproved",
  "useLegacyDidSovPrefix": false,
  "useDidSovPrefixWhereApplicable": false,
  "logLevel": 1,
  "inboundTransport": [
    {
      "transport": "http",
      "port": 9002
    }
  ],
  "outboundTransport": ["http"],
  "autoAcceptMediationRequests": true,
  "adminPort": 8002,
  "tenancy": true,
  "webhookUrl": "http://nginx-proxy:5000/webhooks"
}
EOF
fi

# Show final config (basic info)
echo "🔧 Agent Configuration:"
echo "  Admin Port: ${ADMIN_PORT:-8002}"
echo "  Inbound Port: ${INBOUND_PORT:-9002}"
echo "  Database: ${WALLET_URL:-confirmd-platform-postgres-1:5432/platform-admin}"

# Verify config file was created
if [ -f "/app/config.json" ]; then
    echo "✅ Config file created successfully"
else
    echo "❌ Failed to create config file"
    exit 1
fi

# Start the actual credo-controller
echo "🎯 Starting Credo Controller..."

# Try different possible entry points
if [ -f "/app/lib/src/credo-rest.js" ]; then
    exec node lib/src/credo-rest.js --config /app/config.json
elif [ -f "/app/src/credo-rest.js" ]; then
    exec node src/credo-rest.js --config /app/config.json
elif [ -f "/app/credo-rest.js" ]; then
    exec node credo-rest.js --config /app/config.json
elif [ -f "/app/dist/src/credo-rest.js" ]; then
    exec node dist/src/credo-rest.js --config /app/config.json
elif [ -f "/app/build/src/credo-rest.js" ]; then
    exec node build/src/credo-rest.js --config /app/config.json
else
    echo "❌ Cannot find credo-rest.js entry point"
    echo "🔍 Searching for entry point..."
    find /app -name "*credo*.js" -type f 2>/dev/null | head -10
    echo "📁 Contents of /app:"
    ls -la /app/ 2>/dev/null | head -20
    exit 1
fi