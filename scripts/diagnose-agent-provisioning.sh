#!/bin/bash

# Agent Provisioning Diagnostic Script
# This script performs comprehensive checks on agent provisioning status

set -e

echo "======================================="
echo "Agent Provisioning Diagnostic Script"
echo "======================================="
echo "Started at: $(date)"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "OK")
            echo -e "${GREEN}✓ $message${NC}"
            ;;
        "WARN")
            echo -e "${YELLOW}⚠ $message${NC}"
            ;;
        "ERROR")
            echo -e "${RED}✗ $message${NC}"
            ;;
        *)
            echo "  $message"
            ;;
    esac
}

# Check if we're in the correct directory
if [ ! -f "docker-compose-dev.yml" ]; then
    print_status "ERROR" "docker-compose-dev.yml not found. Please run this script from the project root directory."
    exit 1
fi

echo "1. Checking Docker Services Status"
echo "================================="

# Check if Docker is running
if ! docker ps >/dev/null 2>&1; then
    print_status "ERROR" "Docker is not running or not accessible"
    exit 1
else
    print_status "OK" "Docker is running"
fi

# Check service status
echo ""
echo "Service Status:"
docker-compose -f docker-compose-dev.yml ps --format table

echo ""
echo "2. Checking Database Connectivity"
echo "================================="

# Test database connection
if docker-compose -f docker-compose-dev.yml exec -T confirmd-platform-postgres psql -U postgres -d platform_dev -c "SELECT 1;" >/dev/null 2>&1; then
    print_status "OK" "Database is accessible"
else
    print_status "ERROR" "Cannot connect to database"
    exit 1
fi

echo ""
echo "3. Checking Agent Records in Database"
echo "====================================="

# Check for organizations
echo "Organizations in database:"
docker-compose -f docker-compose-dev.yml exec -T confirmd-platform-postgres psql -U postgres -d platform_dev -c "SELECT id, name, description FROM organizations;" 2>/dev/null || {
    print_status "ERROR" "Cannot query organizations table"
}

echo ""
echo "Agents in database:"
docker-compose -f docker-compose-dev.yml exec -T confirmd-platform-postgres psql -U postgres -d platform_dev -c "SELECT id, org_id, agent_endpoint, label FROM agents;" 2>/dev/null || {
    print_status "WARN" "Cannot query agents table (may not exist yet)"
}

echo ""
echo "4. Checking Agent Configuration Files"
echo "====================================="

# Check AFJ directories
AFJ_BASE_DIR="apps/agent-provisioning/AFJ"

if [ -d "$AFJ_BASE_DIR" ]; then
    print_status "OK" "AFJ base directory exists"
    
    # Check subdirectories
    for subdir in agent-config endpoints token port-file scripts; do
        if [ -d "$AFJ_BASE_DIR/$subdir" ]; then
            print_status "OK" "$subdir directory exists"
            
            # List files in each directory
            file_count=$(ls -1 "$AFJ_BASE_DIR/$subdir" 2>/dev/null | wc -l)
            if [ $file_count -gt 0 ]; then
                print_status "OK" "$subdir contains $file_count files"
                echo "    Files: $(ls -1 "$AFJ_BASE_DIR/$subdir" 2>/dev/null | tr '\n' ' ')"
            else
                print_status "WARN" "$subdir directory is empty"
            fi
        else
            print_status "WARN" "$subdir directory does not exist"
        fi
    done
else
    print_status "ERROR" "AFJ base directory does not exist"
fi

echo ""
echo "5. Checking Port Files"
echo "====================="

# Check port files
for port_file in last-admin-port.txt last-inbound-port.txt; do
    port_file_path="$AFJ_BASE_DIR/port-file/$port_file"
    if [ -f "$port_file_path" ]; then
        port_value=$(cat "$port_file_path" 2>/dev/null)
        print_status "OK" "$port_file exists with value: $port_value"
    else
        print_status "WARN" "$port_file does not exist"
    fi
done

echo ""
echo "6. Checking Network Connectivity"
echo "==============================="

# Check if services can reach each other
echo "Testing service connectivity..."

# Test agent-service to postgres
if docker-compose -f docker-compose-dev.yml exec -T confirmd-platform-agent-service nc -z confirmd-platform-postgres 5432 >/dev/null 2>&1; then
    print_status "OK" "Agent service can reach PostgreSQL"
else
    print_status "WARN" "Agent service cannot reach PostgreSQL"
fi

# Test agent-provisioning to postgres
if docker-compose -f docker-compose-dev.yml exec -T confirmd-platform-agent-provisioning nc -z confirmd-platform-postgres 5432 >/dev/null 2>&1; then
    print_status "OK" "Agent provisioning can reach PostgreSQL"
else
    print_status "WARN" "Agent provisioning cannot reach PostgreSQL"
fi

echo ""
echo "7. Checking Environment Variables"
echo "==============================="

# Check key environment variables
key_vars=(
    "WALLET_STORAGE_HOST"
    "WALLET_STORAGE_PORT"
    "WALLET_STORAGE_USER"
    "AFJ_AGENT_SPIN_UP"
    "AFJ_AGENT_ENDPOINT_PATH"
    "AFJ_AGENT_TOKEN_PATH"
    "AGENT_HOST"
)

for var in "${key_vars[@]}"; do
    if docker-compose -f docker-compose-dev.yml exec -T confirmd-platform-agent-provisioning printenv "$var" >/dev/null 2>&1; then
        value=$(docker-compose -f docker-compose-dev.yml exec -T confirmd-platform-agent-provisioning printenv "$var" 2>/dev/null | tr -d '\r')
        print_status "OK" "$var is set to: $value"
    else
        print_status "WARN" "$var is not set"
    fi
done

echo ""
echo "8. Checking Recent Logs"
echo "======================"

echo "Recent agent-service logs:"
docker-compose -f docker-compose-dev.yml logs --tail=10 confirmd-platform-agent-service 2>/dev/null || print_status "WARN" "Cannot retrieve agent-service logs"

echo ""
echo "Recent agent-provisioning logs:"
docker-compose -f docker-compose-dev.yml logs --tail=10 confirmd-platform-agent-provisioning 2>/dev/null || print_status "WARN" "Cannot retrieve agent-provisioning logs"

echo ""
echo "9. Checking for Platform-Admin Agent"
echo "==================================="

# Look for platform-admin specific files
platform_admin_files=$(find "$AFJ_BASE_DIR" -name "*platform-admin*" 2>/dev/null || true)
if [ -n "$platform_admin_files" ]; then
    print_status "OK" "Platform-admin agent files found:"
    echo "$platform_admin_files"
else
    print_status "WARN" "No platform-admin agent files found"
fi

# Check database for platform-admin records
echo ""
echo "Checking database for platform-admin records:"
docker-compose -f docker-compose-dev.yml exec -T confirmd-platform-postgres psql -U postgres -d platform_dev -c "SELECT * FROM organizations WHERE name LIKE '%platform-admin%';" 2>/dev/null || {
    print_status "WARN" "Cannot check for platform-admin organization"
}

echo ""
echo "10. Summary and Recommendations"
echo "=============================="

echo "Diagnostic completed at: $(date)"
echo ""
echo "Next steps based on findings:"
echo "1. If platform-admin agent files are missing, trigger wallet creation"
echo "2. If database connectivity issues exist, check Docker networking"
echo "3. If environment variables are missing, update docker-compose-dev.yml"
echo "4. If services are down, restart with: docker-compose -f docker-compose-dev.yml up -d"
echo ""
echo "For detailed troubleshooting, see:"
echo "- docs/AGENT_PROVISIONING_TROUBLESHOOTING.md"
echo "- docs/AGENT_PROVISIONING_DOCUMENTATION.md"
echo ""
echo "======================================="
echo "Diagnostic Script Complete"
echo "======================================="
