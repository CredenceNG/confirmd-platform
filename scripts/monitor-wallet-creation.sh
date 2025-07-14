#!/bin/bash

# Real-time Wallet Creation Monitoring Script
# This script monitors all relevant services during wallet creation

echo "🔍 Setting up wallet creation monitoring..."
echo "📊 Monitoring services: agent-service, api-gateway, platform-admin"
echo ""

# Check if Docker containers are running
check_container() {
    local container=$1
    if ! docker ps --format "table {{.Names}}" | grep -q "$container"; then
        echo "❌ Container $container is not running"
        return 1
    else
        echo "✅ Container $container is running"
        return 0
    fi
}

echo "🔍 Checking container status..."
containers=(
    "confirmd-platform-agent-service-1"
    "confirmd-platform-api-gateway-1"
    "f856e3a4-b09c-4356-82de-b105594eec43_Platform-admin"
)

all_running=true
for container in "${containers[@]}"; do
    if ! check_container "$container"; then
        all_running=false
    fi
done

if [ "$all_running" = false ]; then
    echo ""
    echo "❌ Some containers are not running. Please start them with:"
    echo "   docker-compose -f docker-compose-dev.yml up -d"
    exit 1
fi

echo ""
echo "🚀 READY FOR WALLET CREATION!"
echo "   Start your wallet creation request now."
echo "   Use: ./test-wallet-creation.sh"
echo "   This monitor will show real-time logs from all services."
echo ""
echo "🎯 Watch for these key events:"
echo "   • Agent creation started/completed"
echo "   • DID publishing to ledger"
echo "   • Invitation URL generation"
echo "   • Socket.IO events"
echo ""
echo "Press Ctrl+C to stop monitoring"
echo "=================================="

# Function to add timestamps and service labels to logs
monitor_service() {
    local service=$1
    local label=$2
    local color=$3
    
    # Check if container exists before monitoring
    if ! docker ps --format "table {{.Names}}" | grep -q "$service"; then
        echo "⚠️  [$label] Container not found: $service"
        return
    fi
    
    docker logs -f $service 2>&1 | while read line; do
        # Filter for wallet-related logs
        if echo "$line" | grep -iE "(wallet|agent|did|invitation|socket|error)" > /dev/null; then
            echo -e "${color}[$label] $(date '+%H:%M:%S') $line\033[0m"
        fi
    done &
}

# Color codes for different services
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'

# Start monitoring all services with colors
monitor_service "confirmd-platform-agent-service-1" "AGENT-SERVICE" "$GREEN"
monitor_service "confirmd-platform-api-gateway-1" "API-GATEWAY" "$BLUE"  
monitor_service "f856e3a4-b09c-4356-82de-b105594eec43_Platform-admin" "PLATFORM-ADMIN" "$YELLOW"

# Also monitor the credo controller if it's running
if docker ps --format "table {{.Names}}" | grep -q "confirmd-credo-controller"; then
    echo "🎯 Also monitoring Credo Controller..."
    monitor_service "confirmd-credo-controller" "CREDO-CONTROLLER" "$RED"
fi

echo ""
echo "📡 Monitoring started... Create a wallet to see logs!"

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Stopping monitoring..."
    jobs -p | xargs -r kill
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for user to stop
wait
