#!/bin/bash

# Development helper script for shared library changes
# Usage: ./scripts/dev-rebuild.sh [service-name]

set -e

SERVICE_NAME=${1:-user}
COMPOSE_FILE="docker-compose-dev.yml"

echo "🔄 Development rebuild for service: $SERVICE_NAME"

# Function to rebuild service with shared library changes
rebuild_service() {
    local service=$1
    
    echo "🏗️  Building shared libraries..."
    docker-compose -f $COMPOSE_FILE exec $service pnpm run build:libs || {
        echo "📦 Building libs outside container..."
        pnpm run build:libs
    }
    
    echo "🔨 Rebuilding $service container..."
    docker-compose -f $COMPOSE_FILE build $service --no-cache
    
    echo "🔄 Restarting $service..."
    docker-compose -f $COMPOSE_FILE restart $service
    
    echo "📋 Showing recent logs..."
    docker-compose -f $COMPOSE_FILE logs --tail=50 -f $service
}

# Function for hot reload development
start_hot_reload() {
    local service=$1
    
    echo "🔥 Starting hot reload mode for $service..."
    
    # Start lib watcher in background
    echo "👀 Starting library watcher..."
    docker-compose -f docker-compose-dev-hot-reload.yml up -d lib-watcher
    
    # Start service with hot reload
    echo "🚀 Starting $service with hot reload..."
    docker-compose -f docker-compose-dev-hot-reload.yml up $service
}

# Function to watch for file changes and auto-rebuild
watch_and_rebuild() {
    local service=$1
    
    echo "👀 Watching for changes in libs/ directory..."
    
    if command -v fswatch >/dev/null 2>&1; then
        fswatch -o libs/ | while read f; do
            echo "📝 Change detected in libs/, rebuilding $service..."
            rebuild_service $service
        done
    elif command -v inotifywait >/dev/null 2>&1; then
        while inotifywait -r -e modify,create,delete libs/; do
            echo "📝 Change detected in libs/, rebuilding $service..."
            rebuild_service $service
        done
    else
        echo "❌ No file watcher available. Install fswatch (macOS) or inotify-tools (Linux)"
        exit 1
    fi
}

# Main menu
case "${2:-rebuild}" in
    "rebuild")
        rebuild_service $SERVICE_NAME
        ;;
    "hot")
        start_hot_reload $SERVICE_NAME
        ;;
    "watch")
        watch_and_rebuild $SERVICE_NAME
        ;;
    *)
        echo "Usage: $0 [service-name] [rebuild|hot|watch]"
        echo "  rebuild: Force rebuild and restart (default)"
        echo "  hot:     Start hot reload mode"
        echo "  watch:   Watch for changes and auto-rebuild"
        exit 1
        ;;
esac
