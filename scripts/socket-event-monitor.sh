#!/bin/bash

# Socket.IO Event Monitor for Wallet Creation
# Filters logs to show only Socket.IO events during wallet creation

echo "🔌 Socket.IO Event Monitor - Wallet Creation"
echo "============================================"
echo "Monitoring for these events:"
echo "  1. 🚀 agent-spinup-process-initiated"
echo "  2. ✅ agent-spinup-process-completed"
echo "  3. 📝 did-publish-process-initiated"
echo "  4. ✅ did-publish-process-completed"
echo "  5. 🔗 invitation-url-creation-started"
echo "  6. 🎉 invitation-url-creation-success"
echo "  ❌ error-in-wallet-creation-process"
echo ""
echo "🚀 READY! Start your wallet creation now..."
echo "============================================"

# Monitor agent-service for Socket.IO emissions
docker logs -f confirmd-platform-agent-service-1 2>&1 | while read line; do
    if [[ $line == *"socket.emit"* ]] || [[ $line == *"agent-spinup"* ]] || [[ $line == *"did-publish"* ]] || [[ $line == *"invitation-url"* ]] || [[ $line == *"error-in-wallet"* ]]; then
        echo "🔌 [$(date '+%H:%M:%S')] SOCKET EVENT: $line"
    elif [[ $line == *"createTenant"* ]] || [[ $line == *"createTenantAndNotify"* ]] || [[ $line == *"getPlatformAdminAndNotify"* ]]; then
        echo "⚙️  [$(date '+%H:%M:%S')] WALLET PROCESS: $line"
    elif [[ $line == *"Error"* ]] || [[ $line == *"error"* ]]; then
        echo "❌ [$(date '+%H:%M:%S')] ERROR: $line"
    fi
done &

# Monitor API gateway for Socket.IO activity
docker logs -f confirmd-platform-api-gateway-1 2>&1 | while read line; do
    if [[ $line == *"Socket"* ]] || [[ $line == *"emit"* ]] || [[ $line == *"agent-spinup"* ]] || [[ $line == *"did-publish"* ]] || [[ $line == *"invitation"* ]]; then
        echo "🌐 [$(date '+%H:%M:%S')] GATEWAY SOCKET: $line"
    fi
done &

wait
