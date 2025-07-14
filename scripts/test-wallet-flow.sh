#!/bin/bash

# Comprehensive Wallet Creation Testing Workflow
# This script orchestrates the complete wallet creation testing process

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🧪 Comprehensive Wallet Creation Testing Workflow"
echo "=================================================="
echo ""

# Configuration
API_URL="${API_URL:-http://localhost:5000}"
ORG_ID="${ORG_ID:-test-org-$(date +%s)}"
AUTH_TOKEN="${AUTH_TOKEN:-your-auth-token-here}"

echo "📋 Configuration:"
echo "   API URL: $API_URL"
echo "   Organization ID: $ORG_ID"
echo "   Auth Token: ${AUTH_TOKEN:0:20}..."
echo ""

# Step 1: Pre-flight checks
echo "🔍 Step 1: Pre-flight checks..."
if ! curl -s "$API_URL/health" > /dev/null 2>&1; then
    echo "❌ API not responding. Please start the platform:"
    echo "   docker-compose -f docker-compose-dev.yml up -d"
    exit 1
fi

# Check required containers
required_containers=(
    "confirmd-platform-agent-service-1"
    "confirmd-platform-api-gateway-1"
    "f856e3a4-b09c-4356-82de-b105594eec43_Platform-admin"
)

for container in "${required_containers[@]}"; do
    if ! docker ps --format "table {{.Names}}" | grep -q "$container"; then
        echo "❌ Required container not running: $container"
        echo "   Please start with: docker-compose -f docker-compose-dev.yml up -d"
        exit 1
    fi
done

echo "✅ All required services are running"
echo ""

# Step 2: Start monitoring
echo "🔍 Step 2: Starting log monitoring..."
if [ -f "$SCRIPT_DIR/monitor-wallet-creation.sh" ]; then
    echo "   Starting monitoring in background..."
    bash "$SCRIPT_DIR/monitor-wallet-creation.sh" > /tmp/wallet-creation-monitor.log 2>&1 &
    MONITOR_PID=$!
    echo "   Monitor PID: $MONITOR_PID"
    sleep 2
else
    echo "⚠️  Monitor script not found, continuing without monitoring"
fi

# Step 3: Execute wallet creation test
echo "🚀 Step 3: Creating wallet..."
if [ -f "$SCRIPT_DIR/test-wallet-creation.sh" ]; then
    export ORG_ID
    export API_URL
    export AUTH_TOKEN
    
    echo "   Executing wallet creation test..."
    bash "$SCRIPT_DIR/test-wallet-creation.sh"
    WALLET_RESULT=$?
else
    echo "❌ Wallet creation test script not found!"
    exit 1
fi

# Step 4: Cleanup and results
echo ""
echo "🧹 Step 4: Cleanup and results..."

if [ -n "$MONITOR_PID" ]; then
    echo "   Stopping monitor (PID: $MONITOR_PID)..."
    kill $MONITOR_PID 2>/dev/null || true
    wait $MONITOR_PID 2>/dev/null || true
fi

if [ $WALLET_RESULT -eq 0 ]; then
    echo "✅ Wallet creation test completed successfully!"
    echo ""
    echo "📊 Next steps:"
    echo "   • Check the created wallet in the database"
    echo "   • Verify the agent is accessible via API"
    echo "   • Test connection invitations"
else
    echo "❌ Wallet creation test failed!"
    echo ""
    echo "🔍 Troubleshooting:"
    echo "   • Check logs: tail -f /tmp/wallet-creation-monitor.log"
    echo "   • Verify database connection"
    echo "   • Check Keycloak configuration"
    echo "   • Ensure all environment variables are set"
fi

echo ""
echo "📝 Log files:"
echo "   Monitor logs: /tmp/wallet-creation-monitor.log"
echo "   Docker logs: docker logs [container-name]"
