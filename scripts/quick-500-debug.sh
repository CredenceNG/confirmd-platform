#!/bin/bash

# Quick 500 Error Diagnostic Script for Confirmd Platform
# Author: Development Team
# Date: July 4, 2025
# Purpose: Rapidly diagnose 500 errors in organization creation and other operations

echo "🚀 QUICK 500 ERROR DIAGNOSTIC - Confirmd Platform"
echo "=================================================="
echo

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "OK") echo -e "${GREEN}✅ $message${NC}" ;;
        "ERROR") echo -e "${RED}❌ $message${NC}" ;;
        "WARNING") echo -e "${YELLOW}⚠️ $message${NC}" ;;
        "INFO") echo -e "${BLUE}ℹ️ $message${NC}" ;;
    esac
}

# Function to check service status
check_service() {
    local service=$1
    if timeout 5 docker ps --filter "name=$service" --filter "status=running" | grep -q "$service"; then
        print_status "OK" "$service is running"
        return 0
    else
        print_status "ERROR" "$service is not running or not found"
        return 1
    fi
}

# 1. QUICK INFRASTRUCTURE CHECK (10 seconds)
echo "1️⃣ INFRASTRUCTURE CHECK"
echo "----------------------"
print_status "INFO" "Checking Docker services..."

services=("confirmd-platform-postgres-1" "confirmd-platform-api-gateway-1" "confirmd-platform-organization-1" "nats")
all_services_ok=true

for service in "${services[@]}"; do
    if ! check_service "$service"; then
        all_services_ok=false
    fi
done

if [ "$all_services_ok" = false ]; then
    print_status "ERROR" "Critical services are down. Run: docker-compose -f docker-compose-dev.yml up -d"
    exit 1
fi

echo

# 2. QUICK DATABASE CHECK (5 seconds)
echo "2️⃣ DATABASE CHECK"
echo "-----------------"
print_status "INFO" "Checking database connectivity..."

# Check if platform admin user exists (with timeout)
admin_exists=$(timeout 10 docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -t -c "SELECT EXISTS(SELECT 1 FROM \"user\" WHERE email = 'admin@getconfirmd.com');" 2>/dev/null | tr -d '[:space:]' || echo "timeout")

if [[ "$admin_exists" == "t" ]]; then
    print_status "OK" "Platform admin user exists in database"
elif [[ "$admin_exists" == "timeout" ]]; then
    print_status "ERROR" "Database query timed out - possible connection issues"
    print_status "INFO" "Try: docker-compose -f docker-compose-dev.yml restart postgres"
else
    print_status "ERROR" "Platform admin user missing in database"
    echo
    print_status "INFO" "QUICK FIX: Run the emergency setup command from PLATFORM_ADMIN_LOGIN_GUIDE.md"
fi

# Check database connectivity
if timeout 5 docker exec confirmd-platform-postgres-1 pg_isready -U postgres >/dev/null 2>&1; then
    print_status "OK" "Database is accessible"
else
    print_status "ERROR" "Database connection failed"
fi

echo

# 3. NATS COMMUNICATION CHECK (5 seconds)
echo "3️⃣ NATS COMMUNICATION"
echo "---------------------"
print_status "INFO" "Testing NATS connectivity..."

# Check NATS connectivity from container
nats_check=$(timeout 5 docker exec confirmd-platform-api-gateway-1 nc -z nats 4222 2>/dev/null && echo "OK" || echo "FAIL")
if [[ "$nats_check" == "OK" ]]; then
    print_status "OK" "NATS is reachable from API Gateway"
else
    print_status "ERROR" "NATS communication failed"
fi

echo

# 4. RECENT ERROR LOGS (10 seconds)
echo "4️⃣ RECENT ERROR LOGS"
echo "--------------------"

print_status "INFO" "Checking last 10 API Gateway logs for errors..."
recent_errors=$(timeout 5 docker logs confirmd-platform-api-gateway-1 --tail 10 2>&1 | grep -E "(ERROR|500|RpcException|timeout)" | wc -l)

if [ "$recent_errors" -gt 0 ]; then
    print_status "WARNING" "Found $recent_errors recent errors in API Gateway logs"
    echo "Recent errors:"
    timeout 5 docker logs confirmd-platform-api-gateway-1 --tail 10 2>&1 | grep -E "(ERROR|500|RpcException|timeout)" | tail -3
else
    print_status "OK" "No recent errors in API Gateway logs"
fi

echo

print_status "INFO" "Checking organization service logs..."
org_errors=$(timeout 5 docker logs confirmd-platform-organization-1 --tail 10 2>&1 | grep -E "(ERROR|Exception|Failed)" | wc -l)

if [ "$org_errors" -gt 0 ]; then
    print_status "WARNING" "Found $org_errors recent errors in Organization service logs"
    echo "Recent errors:"
    timeout 5 docker logs confirmd-platform-organization-1 --tail 10 2>&1 | grep -E "(ERROR|Exception|Failed)" | tail -3
else
    print_status "OK" "No recent errors in Organization service logs"
fi

echo

# 5. QUICK HEALTH TEST (5 seconds)
echo "5️⃣ QUICK HEALTH TEST"
echo "--------------------"
print_status "INFO" "Testing API endpoints..."

# Test API Gateway basic connectivity
api_health=$(timeout 10 curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/users/profile 2>/dev/null || echo "000")
if [[ "$api_health" == "401" ]]; then
    print_status "OK" "API Gateway is responding (401 = authentication required)"
    api_health="401"
elif [[ "$api_health" == "200" ]]; then
    print_status "OK" "API Gateway is responding normally"
else
    print_status "ERROR" "API Gateway connection failed (HTTP $api_health)"
fi

# Test organization endpoint specifically
org_health=$(timeout 10 curl -s -o /dev/null -w "%{http_code}" "http://localhost:5000/orgs?pageNumber=1&pageSize=9&search=" 2>/dev/null || echo "000")
if [[ "$org_health" == "401" ]]; then
    print_status "OK" "Organization endpoint is responding (401 = authentication required)"
elif [[ "$org_health" == "500" ]]; then
    print_status "ERROR" "Organization endpoint returning 500 errors - RPC/NATS issue likely"
else
    print_status "WARNING" "Organization endpoint returned HTTP $org_health"
fi

echo

# 6. COMMON FIXES
echo "6️⃣ COMMON QUICK FIXES"
echo "---------------------"

# Calculate total issues first
total_issues=0
if [ "$all_services_ok" = false ]; then ((total_issues++)); fi
if [[ "$admin_exists" != "t" ]]; then ((total_issues++)); fi
if [[ "$nats_check" != "OK" ]]; then ((total_issues++)); fi
if [ "$recent_errors" -gt 3 ]; then ((total_issues++)); fi
if [[ "$api_health" != "200" && "$api_health" != "401" ]]; then ((total_issues++)); fi
if [[ "$org_health" == "500" ]]; then ((total_issues++)); fi

if [ "$total_issues" -eq 0 ]; then
    print_status "INFO" "System is healthy! If you're still seeing 500 errors:"
    echo
    echo "1. Check authentication - endpoints require valid JWT tokens"
    echo "2. Verify frontend is properly handling authentication"
    echo "3. Check browser console for authentication errors"
    echo "4. Ensure platform admin login works at: http://localhost:3000/sign-in"
else
    print_status "INFO" "If you're experiencing 500 errors, try these in order:"
    echo
    echo "1. Restart services:"
    echo "   docker-compose -f docker-compose-dev.yml restart api-gateway organization"
    echo
    echo "2. Fix platform admin (if missing):"
    echo "   ./create-platform-admin-client.sh"
    echo "   ./reset-password.sh"
    echo
    echo "3. Check environment variables:"
    echo "   grep -E 'KEYCLOAK|NATS|DATABASE' .env"
    echo
    echo "4. Full restart (last resort):"
    echo "   docker-compose -f docker-compose-dev.yml down && docker-compose -f docker-compose-dev.yml up -d"
fi

echo
echo "🎯 DIAGNOSIS COMPLETE"
echo "===================="

# Summary
if [ "$total_issues" -eq 0 ]; then
    print_status "OK" "No critical issues found. System appears healthy."
    echo
    print_status "INFO" "If you're still experiencing 500 errors:"
    echo "   • Check authentication tokens in browser/frontend"
    echo "   • Try logging in at: http://localhost:3000/sign-in"
    echo "   • Check browser console for authentication errors"
else
    print_status "WARNING" "Found $total_issues potential issues. Check the fixes above."
fi

echo
print_status "INFO" "Total diagnostic time: ~30 seconds"
echo "For detailed troubleshooting, see: docs/PLATFORM_ADMIN_LOGIN_GUIDE.md"
