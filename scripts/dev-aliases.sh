#!/bin/bash

# Quick development commands for shared library changes
# Source this file: source scripts/dev-aliases.sh

# Aliases for common development tasks
alias dev-rebuild-user="docker-compose -f docker-compose-dev.yml build user --no-cache && docker-compose -f docker-compose-dev.yml restart user"
alias dev-logs-user="docker-compose -f docker-compose-dev.yml logs -f user"
alias dev-rebuild-libs="pnpm run build:libs"
alias dev-test-email="curl -X POST http://localhost:5000/api/v1/auth/verification-mail -H 'Content-Type: application/json' -d '{\"email\": \"test@example.com\"}'"

# Function to rebuild any service after lib changes
dev-rebuild() {
    local service=${1:-user}
    echo "🔄 Rebuilding $service with shared library changes..."
    docker-compose -f docker-compose-dev.yml build $service --no-cache
    docker-compose -f docker-compose-dev.yml restart $service
    echo "✅ $service rebuilt and restarted"
}

# Function to rebuild libs and restart service
dev-lib-change() {
    local service=${1:-user}
    echo "🔨 Building shared libraries..."
    pnpm run build:libs
    echo "🔄 Rebuilding $service..."
    dev-rebuild $service
    echo "📋 Showing logs..."
    docker-compose -f docker-compose-dev.yml logs --tail=20 -f $service
}

# Function to quickly test email endpoint
dev-test-email-endpoint() {
    echo "📧 Testing email verification endpoint..."
    curl -X POST http://localhost:5000/api/v1/auth/verification-mail \
      -H "Content-Type: application/json" \
      -d '{"email": "test@example.com"}' \
      -w "\n⏱️  Response time: %{time_total}s\n" \
      -s -o /dev/null -w "📊 Status: %{http_code}\n" || echo "❌ Request failed"
}

echo "🚀 Development aliases loaded!"
echo "Available commands:"
echo "  dev-rebuild [service]     - Rebuild service with lib changes"
echo "  dev-lib-change [service]  - Build libs and rebuild service"
echo "  dev-test-email-endpoint   - Test email verification endpoint"
echo "  dev-rebuild-user          - Quick rebuild user service"
echo "  dev-logs-user             - Show user service logs"
