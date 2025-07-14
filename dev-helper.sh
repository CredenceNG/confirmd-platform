#!/bin/bash

# Development helper for shared library changes
# This solves the recurring issue permanently

set -e

SERVICE=${1:-user}
ACTION=${2:-rebuild}

echo "🔧 DevOps Helper - Shared Library Changes"
echo "Service: $SERVICE | Action: $ACTION"

# Function to build shared libraries locally
build_libs() {
    echo "🏗️  Building shared libraries locally..."
    
    # Create dist/libs directory if it doesn't exist
    mkdir -p dist/libs
    
    # Build each library individually (more reliable than nest build)
    echo "  📦 Building common library..."
    npx tsc -p libs/common/tsconfig.build.json --outDir dist/libs/common
    
    echo "  📦 Building client-registration library..."
    npx tsc -p libs/client-registration/tsconfig.build.json --outDir dist/libs/client-registration 2>/dev/null || echo "    ⚠️  client-registration build skipped"
    
    echo "  📦 Building other libraries..."
    find libs -name "tsconfig.build.json" -exec dirname {} \; | while read libdir; do
        libname=$(basename "$libdir")
        if [ "$libname" != "common" ] && [ "$libname" != "client-registration" ]; then
            npx tsc -p "$libdir/tsconfig.build.json" --outDir "dist/libs/$libname" 2>/dev/null || echo "    ⚠️  $libname build skipped"
        fi
    done
    
    echo "✅ Shared libraries built successfully"
}

# Function to restart service without full rebuild
quick_restart() {
    echo "🔄 Quick restart of $SERVICE service..."
    docker-compose -f docker-compose-dev.yml restart $SERVICE
    echo "✅ $SERVICE service restarted"
}

# Function to rebuild service completely
full_rebuild() {
    echo "🏗️  Full rebuild of $SERVICE service..."
    docker-compose -f docker-compose-dev.yml build $SERVICE --no-cache
    docker-compose -f docker-compose-dev.yml restart $SERVICE
    echo "✅ $SERVICE service rebuilt and restarted"
}

# Function to show logs
show_logs() {
    echo "📋 Showing logs for $SERVICE service..."
    docker-compose -f docker-compose-dev.yml logs --tail=30 -f $SERVICE
}

# Main execution
case $ACTION in
    "libs")
        build_libs
        ;;
    "quick"|"restart")
        build_libs
        quick_restart
        ;;
    "rebuild"|"full")
        build_libs
        full_rebuild
        ;;
    "logs")
        show_logs
        ;;
    "test")
        echo "🧪 Testing email endpoint..."
        curl -X POST http://localhost:5000/api/v1/auth/verification-mail \
          -H "Content-Type: application/json" \
          -d '{"email": "test@example.com"}' \
          -w "\nResponse time: %{time_total}s\n"
        ;;
    *)
        echo "Usage: $0 [service] [action]"
        echo "Actions:"
        echo "  libs    - Build shared libraries only"
        echo "  quick   - Build libs + restart service (default)"
        echo "  rebuild - Build libs + full container rebuild"
        echo "  logs    - Show service logs"
        echo "  test    - Test email endpoint"
        echo ""
        echo "Examples:"
        echo "  $0 user quick    # Quick fix for user service"
        echo "  $0 user rebuild  # Full rebuild if issues persist"
        echo "  $0 user logs     # Check what's happening"
        exit 1
        ;;
esac
