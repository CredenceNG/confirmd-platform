#!/bin/bash

# Connection URL Monitor Script
# This script tests the POST /orgs/{orgId}/connections endpoint and monitors the response

# Configuration
API_BASE_URL="http://localhost:5000"
LOG_FILE="connection-test-$(date +%Y%m%d_%H%M%S).log"
ORG_ID="${1:-test-org-id}"
AUTH_TOKEN="${AUTH_TOKEN:-your-auth-token-here}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging function
log() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local message="[$timestamp] $1"
    echo -e "$message" | tee -a "$LOG_FILE"
}

# Print header
print_header() {
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}🔍 Connection URL Monitor - Testing POST /orgs/{orgId}/connections${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════════${NC}"
    log "🚀 Starting connection URL monitoring for orgId: $ORG_ID"
    log "📁 Log file: $LOG_FILE"
    log "🌐 API Base URL: $API_BASE_URL"
}

# Test connection creation
test_connection_creation() {
    local endpoint="$API_BASE_URL/orgs/$ORG_ID/connections"
    
    log "🧪 Testing connection creation endpoint: $endpoint"
    
    # Create the request payload
    local payload='{
        "label": "Monitor Test Connection",
        "alias": "monitor-test-'$(date +%s)'",
        "multiUseInvitation": true,
        "autoAcceptConnection": true,
        "goal": "Test connection for monitoring",
        "goalCode": "aries.connect"
    }'
    
    log "📦 Request payload:"
    echo "$payload" | jq . 2>/dev/null || echo "$payload"
    
    # Make the request and capture response
    log "🚀 Making POST request..."
    
    local response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -d "$payload" \
        "$endpoint" 2>&1)
    
    # Extract HTTP status and body
    local http_status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    local response_body=$(echo "$response" | sed -E 's/HTTPSTATUS:[0-9]*$//')
    
    log "📊 HTTP Status: $http_status"
    
    if [ "$http_status" = "201" ] || [ "$http_status" = "200" ]; then
        log "✅ Request successful!"
        
        # Parse and analyze the response
        log "📱 Response body:"
        echo "$response_body" | jq . 2>/dev/null || echo "$response_body"
        
        # Extract connection invitation URL
        local connection_invitation=$(echo "$response_body" | jq -r '.data.connectionInvitation // empty' 2>/dev/null)
        local shortened_url=$(echo "$response_body" | jq -r '.data.shortenedUrl // empty' 2>/dev/null)
        
        if [ -n "$connection_invitation" ] && [ "$connection_invitation" != "null" ]; then
            echo -e "${GREEN}🎯 CONNECTION INVITATION URL DETECTED:${NC}"
            echo -e "${YELLOW}📱 connectionInvitation: $connection_invitation${NC}"
            echo -e "${YELLOW}🔗 shortenedUrl: ${shortened_url:-N/A}${NC}"
            
            # Analyze the URL
            analyze_connection_url "$connection_invitation"
            
            # Log to file
            log "🎯 CONNECTION INVITATION URL: $connection_invitation"
            log "🔗 SHORTENED URL: ${shortened_url:-N/A}"
            
        else
            echo -e "${RED}❌ No connectionInvitation URL found in response${NC}"
            log "❌ No connectionInvitation URL found in response"
        fi
        
    else
        echo -e "${RED}❌ Request failed with status: $http_status${NC}"
        log "❌ Request failed with status: $http_status"
        log "📱 Response: $response_body"
    fi
}

# Analyze connection URL
analyze_connection_url() {
    local url="$1"
    
    echo -e "${PURPLE}🔍 URL Analysis:${NC}"
    
    # Check domain
    if echo "$url" | grep -q "platform-admin.confamd.com"; then
        echo -e "${GREEN}  ✅ Contains expected domain: platform-admin.confamd.com${NC}"
        log "✅ URL contains expected domain: platform-admin.confamd.com"
    else
        echo -e "${RED}  ⚠️  URL does not contain expected domain${NC}"
        log "⚠️ URL does not contain expected domain"
    fi
    
    # Check OOB format
    if echo "$url" | grep -q "?oob="; then
        echo -e "${GREEN}  ✅ Has proper OOB (Out-of-Band) format${NC}"
        log "✅ URL has proper OOB format"
        
        # Extract OOB parameter
        local oob_param=$(echo "$url" | sed -n 's/.*?oob=\([^&]*\).*/\1/p')
        if [ -n "$oob_param" ]; then
            local oob_preview=$(echo "$oob_param" | cut -c1-50)
            echo -e "${BLUE}  🔐 OOB Parameter Preview: ${oob_preview}...${NC}"
            log "🔐 OOB Parameter Preview: ${oob_preview}..."
        fi
    else
        echo -e "${RED}  ⚠️  URL does not have OOB format${NC}"
        log "⚠️ URL does not have OOB format"
    fi
    
    # Check URL length
    local url_length=${#url}
    echo -e "${BLUE}  📏 URL Length: $url_length characters${NC}"
    log "📏 URL Length: $url_length characters"
    
    # Check if it's a valid URL
    if echo "$url" | grep -qE '^https?://'; then
        echo -e "${GREEN}  ✅ Valid URL format${NC}"
        log "✅ Valid URL format"
    else
        echo -e "${RED}  ❌ Invalid URL format${NC}"
        log "❌ Invalid URL format"
    fi
}

# Monitor Docker logs
monitor_docker_logs() {
    log "📋 Starting Docker logs monitoring in background..."
    
    # Monitor connection service logs
    docker-compose logs -f connection 2>/dev/null | while read line; do
        if echo "$line" | grep -q -E "(connectionInvitation|createConnectionInvitation|resolvedInvitationUrl)"; then
            log "🐳 CONNECTION SERVICE: $line"
        fi
    done &
    
    # Monitor api-gateway logs
    docker-compose logs -f api-gateway 2>/dev/null | while read line; do
        if echo "$line" | grep -q -E "(/connections|createConnectionInvitation)"; then
            log "🌐 API-GATEWAY: $line"
        fi
    done &
    
    log "📋 Docker logs monitoring started in background"
}

# Continuous monitoring
continuous_monitor() {
    local interval="${1:-30}"
    
    log "🔄 Starting continuous monitoring (interval: ${interval}s)"
    log "Press Ctrl+C to stop"
    
    # Start Docker logs monitoring
    monitor_docker_logs
    
    # Continuous testing
    while true; do
        echo -e "\n${CYAN}🔄 Running periodic test...${NC}"
        test_connection_creation
        echo -e "${CYAN}⏱️  Waiting ${interval} seconds...${NC}"
        sleep "$interval"
    done
}

# Show usage
show_usage() {
    echo -e "${CYAN}🔍 Connection URL Monitor Script${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "Usage: $0 [ORG_ID] [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  test           - Run single connection test (default)"
    echo "  monitor [SEC]  - Continuous monitoring (default: 30s interval)"
    echo "  logs           - Monitor Docker logs only"
    echo "  tail           - Tail the current log file"
    echo ""
    echo "Examples:"
    echo "  $0 abc123                    # Single test with orgId 'abc123'"
    echo "  $0 abc123 monitor 15         # Monitor every 15 seconds"
    echo "  $0 abc123 logs               # Monitor Docker logs only"
    echo "  $0 abc123 tail               # Tail current log file"
    echo ""
    echo "Environment Variables:"
    echo "  AUTH_TOKEN - Bearer token for API authentication"
    echo ""
    echo "Current Settings:"
    echo "  ORG_ID: $ORG_ID"
    echo "  AUTH_TOKEN: ${AUTH_TOKEN:0:20}..."
    echo "  LOG_FILE: $LOG_FILE"
}

# Main execution
main() {
    local command="${2:-test}"
    
    case "$command" in
        "test")
            print_header
            test_connection_creation
            echo -e "\n${GREEN}✅ Test completed. Check log file: $LOG_FILE${NC}"
            ;;
        "monitor")
            local interval="${3:-30}"
            print_header
            continuous_monitor "$interval"
            ;;
        "logs")
            print_header
            log "📋 Monitoring Docker logs only..."
            monitor_docker_logs
            echo -e "${CYAN}Press Ctrl+C to stop${NC}"
            wait
            ;;
        "tail")
            if [ -f "$LOG_FILE" ]; then
                tail -f "$LOG_FILE"
            else
                echo -e "${RED}❌ Log file not found: $LOG_FILE${NC}"
                exit 1
            fi
            ;;
        "help"|"-h"|"--help")
            show_usage
            ;;
        *)
            echo -e "${RED}❌ Unknown command: $command${NC}"
            show_usage
            exit 1
            ;;
    esac
}

# Check dependencies
check_dependencies() {
    if ! command -v curl &> /dev/null; then
        echo -e "${RED}❌ curl is required but not installed${NC}"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        echo -e "${YELLOW}⚠️  jq not found. JSON formatting will be limited${NC}"
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${YELLOW}⚠️  docker-compose not found. Docker logs monitoring disabled${NC}"
    fi
}

# Trap Ctrl+C
trap 'echo -e "\n${YELLOW}🛑 Monitoring stopped${NC}"; exit 0' INT

# Run checks and execute main function
check_dependencies
main "$@"
