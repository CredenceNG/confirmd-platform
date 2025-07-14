#!/bin/bash

# Permanent solution for shared library development
# This script ensures shared lib changes are always applied

set -e

echo "🔧 === SHARED LIBRARY DEVELOPMENT HELPER ==="
echo "This solves the recurring 'changes not in runtime' issue permanently"

SERVICE=${1:-user}
ACTION=${2:-rebuild}

# Function to build shared libraries locally and copy to container
apply_lib_changes() {
    echo "📦 Building shared libraries in container..."
    
    # Build shared libraries inside the running container
    docker-compose -f docker-compose-dev.yml exec $SERVICE sh -c "
        echo '🏗️ Rebuilding shared libraries inside container...'
        cd /app
        npm run build common
        echo '✅ Shared libraries rebuilt successfully'
    " || {
        echo "⚠️ Container exec failed, building service with new changes..."
        docker-compose -f docker-compose-dev.yml build $SERVICE --no-cache
        docker-compose -f docker-compose-dev.yml restart $SERVICE
    }
}

# Function to restart service and show logs
restart_and_monitor() {
    echo "🔄 Restarting $SERVICE to pick up changes..."
    docker-compose -f docker-compose-dev.yml restart $SERVICE
    
    echo "⏱️ Waiting for service to start..."
    sleep 3
    
    echo "📋 Showing recent logs..."
    docker-compose -f docker-compose-dev.yml logs --tail=20 $SERVICE
}

# Function to test email endpoint
test_email() {
    echo "🧪 Testing email verification endpoint..."
    curl -X POST http://localhost:5000/auth/verification-mail \
      -H "Content-Type: application/json" \
      -d '{"email": "test@example.com", "clientId": "confirmd-bench-management", "clientSecret": "APwJSRD9xjvfjTTZO0RoUz3y7sWej2eO"}' \
      -w "\n⏱️ Response time: %{time_total}s\n" || echo "❌ Test failed"
    
    echo "📋 Checking logs for our enhanced debugging..."
    docker-compose -f docker-compose-dev.yml logs --tail=10 $SERVICE | grep -E "(📧|🔑|📤|✅|❌)" || echo "🔍 No enhanced email debugging found - lib changes not applied"
}

# Main execution
case $ACTION in
    "apply"|"libs")
        apply_lib_changes
        restart_and_monitor
        ;;
    "test")
        test_email
        ;;
    "rebuild")
        echo "🏗️ Full rebuild of $SERVICE..."
        docker-compose -f docker-compose-dev.yml build $SERVICE --no-cache
        docker-compose -f docker-compose-dev.yml restart $SERVICE
        echo "✅ $SERVICE rebuilt and restarted"
        ;;
    "logs")
        docker-compose -f docker-compose-dev.yml logs --tail=50 -f $SERVICE
        ;;
    *)
        echo "Usage: $0 [service] [action]"
        echo "Actions:"
        echo "  apply   - Apply shared lib changes to running container (recommended)"
        echo "  test    - Test email endpoint and check for enhanced debugging"
        echo "  rebuild - Full container rebuild (slower but guaranteed)"
        echo "  logs    - Show service logs"
        echo ""
        echo "Examples:"
        echo "  $0 user apply   # Apply lib changes without rebuild"
        echo "  $0 user test    # Test if enhanced email debugging is working"
        echo "  $0 user rebuild # Nuclear option - full rebuild"
        exit 1
        ;;
esac
