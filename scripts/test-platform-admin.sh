#!/bin/bash

# Test Platform Admin Detection Script
# This script tests the Platform Admin functionality in the confirmd-platform

set -e

echo "🔍 Testing Platform Admin Detection - $(date)"
echo "================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test functions
test_database_connection() {
    echo -e "${BLUE}📊 Testing database connection...${NC}"
    
    # Test database connection
    if docker-compose -f docker-compose-dev.yml exec -T postgres psql -U postgres -d credebl -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Database connection successful${NC}"
        return 0
    else
        echo -e "${RED}❌ Database connection failed${NC}"
        return 1
    fi
}

test_platform_admin_user_exists() {
    echo -e "${BLUE}👤 Testing Platform Admin user existence...${NC}"
    
    # Check if Platform Admin user exists
    ADMIN_EMAIL="admin@getconfirmd.com"
    USER_COUNT=$(docker-compose -f docker-compose-dev.yml exec -T postgres psql -U postgres -d credebl -c "SELECT COUNT(*) FROM \"user\" WHERE email = '$ADMIN_EMAIL';" -t | tr -d ' ')
    
    if [ "$USER_COUNT" -eq 1 ]; then
        echo -e "${GREEN}✅ Platform Admin user exists: $ADMIN_EMAIL${NC}"
        
        # Get user ID
        USER_ID=$(docker-compose -f docker-compose-dev.yml exec -T postgres psql -U postgres -d credebl -c "SELECT id FROM \"user\" WHERE email = '$ADMIN_EMAIL';" -t | tr -d ' ')
        echo -e "${BLUE}📋 User ID: $USER_ID${NC}"
        
        return 0
    else
        echo -e "${RED}❌ Platform Admin user not found or duplicated${NC}"
        return 1
    fi
}

test_platform_admin_role_assignment() {
    echo -e "${BLUE}🎭 Testing Platform Admin role assignment...${NC}"
    
    ADMIN_EMAIL="admin@getconfirmd.com"
    
    # Check if Platform Admin has the platform_admin role
    ROLE_COUNT=$(docker-compose -f docker-compose-dev.yml exec -T postgres psql -U postgres -d credebl -c "
        SELECT COUNT(*) FROM \"user\" u 
        JOIN \"user_org_roles\" uor ON u.id = uor.\"userId\" 
        JOIN \"org_roles\" or_roles ON uor.\"orgRoleId\" = or_roles.id 
        WHERE u.email = '$ADMIN_EMAIL' AND or_roles.name = 'platform_admin';
    " -t | tr -d ' ')
    
    if [ "$ROLE_COUNT" -eq 1 ]; then
        echo -e "${GREEN}✅ Platform Admin role correctly assigned${NC}"
        
        # Show role details
        echo -e "${BLUE}📋 Role details:${NC}"
        docker-compose -f docker-compose-dev.yml exec -T postgres psql -U postgres -d credebl -c "
            SELECT u.email, or_roles.name as role_name, o.name as org_name 
            FROM \"user\" u 
            JOIN \"user_org_roles\" uor ON u.id = uor.\"userId\" 
            JOIN \"org_roles\" or_roles ON uor.\"orgRoleId\" = or_roles.id 
            JOIN \"organisation\" o ON uor.\"orgId\" = o.id 
            WHERE u.email = '$ADMIN_EMAIL';
        "
        
        return 0
    else
        echo -e "${RED}❌ Platform Admin role not found or duplicated${NC}"
        return 1
    fi
}

test_environment_variables() {
    echo -e "${BLUE}🌍 Testing environment variables...${NC}"
    
    # Check if PLATFORM_ADMIN_EMAIL is set
    PLATFORM_ADMIN_EMAIL=$(docker-compose -f docker-compose-dev.yml exec -T user sh -c "echo \$PLATFORM_ADMIN_EMAIL")
    
    if [ -n "$PLATFORM_ADMIN_EMAIL" ]; then
        echo -e "${GREEN}✅ PLATFORM_ADMIN_EMAIL is set: $PLATFORM_ADMIN_EMAIL${NC}"
    else
        echo -e "${RED}❌ PLATFORM_ADMIN_EMAIL is not set${NC}"
        return 1
    fi
    
    # Check if management client credentials are set
    KEYCLOAK_MANAGEMENT_CLIENT_ID=$(docker-compose -f docker-compose-dev.yml exec -T user sh -c "echo \$KEYCLOAK_MANAGEMENT_CLIENT_ID")
    KEYCLOAK_MANAGEMENT_CLIENT_SECRET=$(docker-compose -f docker-compose-dev.yml exec -T user sh -c "echo \$KEYCLOAK_MANAGEMENT_CLIENT_SECRET")
    
    if [ -n "$KEYCLOAK_MANAGEMENT_CLIENT_ID" ] && [ -n "$KEYCLOAK_MANAGEMENT_CLIENT_SECRET" ]; then
        echo -e "${GREEN}✅ Keycloak management client credentials are set${NC}"
        echo -e "${BLUE}📋 Management Client ID: $KEYCLOAK_MANAGEMENT_CLIENT_ID${NC}"
    else
        echo -e "${RED}❌ Keycloak management client credentials not set${NC}"
        return 1
    fi
    
    return 0
}

test_containers_running() {
    echo -e "${BLUE}🐳 Testing container status...${NC}"
    
    # Check if required containers are running
    USER_CONTAINER=$(docker-compose -f docker-compose-dev.yml ps -q user)
    POSTGRES_CONTAINER=$(docker-compose -f docker-compose-dev.yml ps -q postgres)
    API_GATEWAY_CONTAINER=$(docker-compose -f docker-compose-dev.yml ps -q api-gateway)
    
    if [ -n "$USER_CONTAINER" ] && [ -n "$POSTGRES_CONTAINER" ] && [ -n "$API_GATEWAY_CONTAINER" ]; then
        echo -e "${GREEN}✅ All required containers are running${NC}"
        
        # Show container details
        echo -e "${BLUE}📋 Container status:${NC}"
        docker-compose -f docker-compose-dev.yml ps user postgres api-gateway
        
        return 0
    else
        echo -e "${RED}❌ Some required containers are not running${NC}"
        docker-compose -f docker-compose-dev.yml ps
        return 1
    fi
}

test_user_service_logs() {
    echo -e "${BLUE}📝 Testing user service logs for Platform Admin detection...${NC}"
    
    # Check recent logs for Platform Admin detection
    echo -e "${BLUE}📋 Recent user service logs:${NC}"
    docker-compose -f docker-compose-dev.yml logs user --tail=20 --timestamps
    
    # Look for Platform Admin detection logs
    ADMIN_LOGS=$(docker-compose -f docker-compose-dev.yml logs user --tail=50 | grep -E "🔍|Platform Admin|isPlatformAdmin|🔐|👤" | tail -10)
    
    if [ -n "$ADMIN_LOGS" ]; then
        echo -e "${GREEN}✅ Platform Admin detection logs found:${NC}"
        echo "$ADMIN_LOGS"
    else
        echo -e "${YELLOW}⚠️ No Platform Admin detection logs found in recent logs${NC}"
    fi
    
    return 0
}

test_api_gateway_connectivity() {
    echo -e "${BLUE}🌐 Testing API Gateway connectivity...${NC}"
    
    # Test if API Gateway is accessible
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health | grep -q "200\|404"; then
        echo -e "${GREEN}✅ API Gateway is accessible on port 5000${NC}"
        return 0
    else
        echo -e "${RED}❌ API Gateway is not accessible on port 5000${NC}"
        return 1
    fi
}

manual_platform_admin_test() {
    echo -e "${BLUE}🧪 Manual Platform Admin detection test...${NC}"
    
    ADMIN_EMAIL="admin@getconfirmd.com"
    
    # Get user ID for testing
    USER_ID=$(docker-compose -f docker-compose-dev.yml exec -T postgres psql -U postgres -d credebl -c "SELECT id FROM \"user\" WHERE email = '$ADMIN_EMAIL';" -t | tr -d ' ')
    
    if [ -n "$USER_ID" ]; then
        echo -e "${BLUE}📋 Testing Platform Admin detection for User ID: $USER_ID${NC}"
        
        # Test the repository method directly via SQL
        echo -e "${BLUE}📋 SQL test for Platform Admin role:${NC}"
        docker-compose -f docker-compose-dev.yml exec -T postgres psql -U postgres -d credebl -c "
            SELECT 
                u.id, 
                u.email, 
                or_roles.name as role_name,
                CASE 
                    WHEN or_roles.name = 'platform_admin' THEN 'TRUE'
                    ELSE 'FALSE'
                END as is_platform_admin
            FROM \"user\" u 
            JOIN \"user_org_roles\" uor ON u.id = uor.\"userId\" 
            JOIN \"org_roles\" or_roles ON uor.\"orgRoleId\" = or_roles.id 
            WHERE u.id = '$USER_ID';
        "
        
        echo -e "${BLUE}📋 Email fallback test:${NC}"
        echo "User ID: $USER_ID"
        echo "Expected email: $ADMIN_EMAIL"
        echo "PLATFORM_ADMIN_EMAIL env var: $(docker-compose -f docker-compose-dev.yml exec -T user sh -c "echo \$PLATFORM_ADMIN_EMAIL")"
        
    else
        echo -e "${RED}❌ Could not get user ID for testing${NC}"
        return 1
    fi
    
    return 0
}

# Main test execution
main() {
    echo -e "${BLUE}🚀 Starting Platform Admin Detection Tests${NC}"
    echo ""
    
    TESTS_PASSED=0
    TESTS_FAILED=0
    
    # Run all tests
    TESTS=(
        "test_database_connection"
        "test_platform_admin_user_exists"
        "test_platform_admin_role_assignment"
        "test_environment_variables"
        "test_containers_running"
        "test_user_service_logs"
        "test_api_gateway_connectivity"
        "manual_platform_admin_test"
    )
    
    for test in "${TESTS[@]}"; do
        echo ""
        echo -e "${YELLOW}Running: $test${NC}"
        echo "----------------------------------------"
        
        if $test; then
            ((TESTS_PASSED++))
            echo -e "${GREEN}✅ $test PASSED${NC}"
        else
            ((TESTS_FAILED++))
            echo -e "${RED}❌ $test FAILED${NC}"
        fi
    done
    
    # Summary
    echo ""
    echo "================================================="
    echo -e "${BLUE}📊 Test Summary${NC}"
    echo "================================================="
    echo -e "${GREEN}✅ Tests Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}❌ Tests Failed: $TESTS_FAILED${NC}"
    echo ""
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}🎉 All tests passed! Platform Admin detection should be working correctly.${NC}"
        exit 0
    else
        echo -e "${RED}⚠️ Some tests failed. Please check the issues above.${NC}"
        exit 1
    fi
}

# Run the main function
main
