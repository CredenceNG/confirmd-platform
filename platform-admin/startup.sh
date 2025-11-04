#!/bin/bash

# Platform Admin Agent Startup Script
# Protects the original config from being overwritten

echo "🚀 Starting Platform Admin Agent..."

# Copy master config to working location
if [ -f "/app/config.master.json" ]; then
    echo "📄 Restoring configuration from master template..."
    cp /app/config.master.json /app/config.json
    echo "✅ Configuration restored"
else
    echo "❌ Master configuration not found!"
    exit 1
fi

# Show configuration summary
echo "🔧 Agent Configuration:"
echo "  Label: $(cat /app/config.json | jq -r '.label // "N/A"' 2>/dev/null || echo 'N/A')"
echo "  Admin Port: $(cat /app/config.json | jq -r '.adminPort // "N/A"' 2>/dev/null || echo 'N/A')"
echo "  Database: $(cat /app/config.json | jq -r '.walletUrl // "N/A"' 2>/dev/null || echo 'N/A')"

# Start the credo-controller using its default entry point
echo "🎯 Starting Credo Controller..."
exec node ./bin/afj-rest --config /app/config.json