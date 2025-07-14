#!/bin/bash

# Simple Debug Script for Confirmd Platform
echo "🔍 SIMPLE PLATFORM DEBUG"
echo "========================"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    local status=$1
    local message=$2
    case $status in
        "OK") echo -e "${GREEN}✅ $message${NC}" ;;
        "ERROR") echo -e "${RED}❌ $message${NC}" ;;
        "WARNING") echo -e "${YELLOW}⚠️ $message${NC}" ;;
    esac
}

# Check if Docker is responsive
echo "Testing Docker responsiveness..."
if timeout 3 docker ps >/dev/null 2>&1; then
    print_status "OK" "Docker is responsive"
    
    # Check running containers
    echo "Checking running containers..."
    containers=$(docker ps --format "table {{.Names}}")
    if echo "$containers" | grep -q "confirmd-platform"; then
        print_status "OK" "Confirmd platform containers are running"
        echo "$containers" | grep "confirmd-platform"
    else
        print_status "ERROR" "No Confirmd platform containers running"
        echo "Available containers:"
        echo "$containers"
    fi
else
    print_status "ERROR" "Docker is not responsive or not running"
    echo "Please check Docker Desktop or Docker daemon"
fi

# Check if services are accessible
echo
echo "Testing API endpoints..."
if timeout 5 curl -s http://localhost:5000/users/profile >/dev/null 2>&1; then
    print_status "OK" "API Gateway is accessible"
else
    print_status "ERROR" "API Gateway not accessible on port 5000"
fi

if timeout 5 curl -s http://localhost:3000 >/dev/null 2>&1; then
    print_status "OK" "Frontend is accessible"
else
    print_status "ERROR" "Frontend not accessible on port 3000"
fi

echo
echo "Debug complete!"
