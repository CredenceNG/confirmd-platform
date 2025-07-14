#!/bin/bash

# CREDEBL Platform Docker Launch Script with Parallel Build Optimization
# This script launches the CREDEBL platform with optimized parallel processing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_success "Docker is running"
}

# Function to check if Docker Compose is available
check_docker_compose() {
    if ! command -v docker-compose > /dev/null 2>&1; then
        print_error "Docker Compose is not installed. Please install Docker Compose and try again."
        exit 1
    fi
    print_success "Docker Compose is available"
}

# Function to check environment file
check_env_file() {
    if [ ! -f ".env" ]; then
        print_warning ".env file not found. Creating from .env.demo..."
        if [ -f ".env.demo" ]; then
            cp .env.demo .env
            print_success "Created .env file from .env.demo"
        else
            print_error "No .env.demo file found. Please create .env file manually."
            exit 1
        fi
    else
        print_success ".env file found"
    fi
}

# Function to check required directories
check_directories() {
    local dirs=(
        "apps/agent-provisioning/AFJ/agent-config"
        "libs/prisma-service/prisma/data"
    )
    
    for dir in "${dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            print_warning "Creating missing directory: $dir"
            mkdir -p "$dir"
        fi
    done
    
    # Create master table file if it doesn't exist
    if [ ! -f "libs/prisma-service/prisma/data/credebl-master-table.json" ]; then
        print_warning "Creating empty master table file"
        echo "[]" > "libs/prisma-service/prisma/data/credebl-master-table.json"
    fi
    
    print_success "All required directories are available"
}

# Function to pull all images in parallel
pull_images() {
    print_status "Pulling Docker images in parallel..."
    
    # Get list of images from docker-compose file
    local images=(
        "nats:2.9-alpine"
        "redis:6.2-alpine"
        "ghcr.io/credebl/seed:latest"
        "ghcr.io/credebl/api-gateway:latest"
        "ghcr.io/credebl/user:latest"
        "ghcr.io/credebl/utility:latest"
        "ghcr.io/credebl/connection:latest"
        "ghcr.io/credebl/organization:latest"
        "ghcr.io/credebl/issuance:latest"
        "ghcr.io/credebl/verification:latest"
        "ghcr.io/credebl/ledger:latest"
        "ghcr.io/credebl/agent-provisioning:latest"
        "ghcr.io/credebl/agent-service:latest"
        "ghcr.io/credebl/cloud-wallet:latest"
        "ghcr.io/credebl/geolocation:latest"
        "ghcr.io/credebl/notification:latest"
        "ghcr.io/credebl/webhook:latest"
        "ghcr.io/credebl/schema-file-server:latest"
    )
    
    # Pull images in parallel (max 4 concurrent pulls)
    echo "${images[@]}" | xargs -n 1 -P 4 docker pull
    
    print_success "All Docker images pulled successfully"
}

# Function to start infrastructure services first
start_infrastructure() {
    print_status "Starting infrastructure services (NATS, Redis)..."
    
    docker-compose -f docker-compose-dev.yml up -d nats redis
    
    # Wait for infrastructure services to be healthy
    print_status "Waiting for infrastructure services to be ready..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if docker-compose -f docker-compose-dev.yml ps nats | grep -q "healthy" && \
           docker-compose -f docker-compose-dev.yml ps redis | grep -q "healthy"; then
            print_success "Infrastructure services are ready"
            return 0
        fi
        
        print_status "Attempt $attempt/$max_attempts - Infrastructure services not ready yet..."
        sleep 2
        ((attempt++))
    done
    
    print_error "Infrastructure services failed to start within expected time"
    exit 1
}

# Function to start core services
start_core_services() {
    print_status "Starting core services (Seed, API Gateway)..."
    
    docker-compose -f docker-compose-dev.yml up -d seed api-gateway
    
    # Wait for API Gateway to be healthy
    print_status "Waiting for API Gateway to be ready..."
    
    local max_attempts=60
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:5000/health > /dev/null 2>&1; then
            print_success "API Gateway is ready"
            return 0
        fi
        
        print_status "Attempt $attempt/$max_attempts - API Gateway not ready yet..."
        sleep 3
        ((attempt++))
    done
    
    print_error "API Gateway failed to start within expected time"
    exit 1
}

# Function to start tier 1 services in parallel
start_tier1_services() {
    print_status "Starting Tier 1 services in parallel..."
    
    docker-compose -f docker-compose-dev.yml up -d \
        user utility cloud-wallet geolocation notification webhook schema-file-server
    
    print_success "Tier 1 services started"
}

# Function to start tier 2 services
start_tier2_services() {
    print_status "Starting Tier 2 services..."
    
    docker-compose -f docker-compose-dev.yml up -d connection organization
    
    print_success "Tier 2 services started"
}

# Function to start tier 3 services in parallel
start_tier3_services() {
    print_status "Starting Tier 3 services in parallel..."
    
    docker-compose -f docker-compose-dev.yml up -d issuance verification ledger
    
    print_success "Tier 3 services started"
}

# Function to start agent services
start_agent_services() {
    print_status "Starting Agent services..."
    
    docker-compose -f docker-compose-dev.yml up -d agent-provisioning
    
    # Wait a bit for agent-provisioning to initialize
    print_status "Waiting for agent-provisioning to initialize..."
    sleep 10
    
    docker-compose -f docker-compose-dev.yml up -d agent-service
    
    print_success "Agent services started"
}

# Function to show service status
show_status() {
    print_status "Current service status:"
    docker-compose -f docker-compose-dev.yml ps
    
    print_status "\nService logs (last 10 lines):"
    docker-compose -f docker-compose-dev.yml logs --tail=10
}

# Function to show access URLs
show_access_info() {
    echo ""
    print_success "🚀 CREDEBL Platform is now running!"
    echo ""
    echo -e "${BLUE}Access URLs:${NC}"
    echo "  📋 API Gateway:          http://localhost:5000"
    echo "  📋 API Documentation:    http://localhost:5000/api/docs"
    echo "  📋 Health Check:         http://localhost:5000/health"
    echo "  📊 NATS Monitoring:      http://localhost:8222"
    echo "  🔧 Redis CLI:            redis-cli -h localhost -p 6379"
    echo ""
    echo -e "${BLUE}Useful Commands:${NC}"
    echo "  📋 View logs:            docker-compose -f docker-compose-dev.yml logs -f [service_name]"
    echo "  📋 Stop services:        docker-compose -f docker-compose-dev.yml down"
    echo "  📋 Restart service:      docker-compose -f docker-compose-dev.yml restart [service_name]"
    echo "  📋 Service status:       docker-compose -f docker-compose-dev.yml ps"
    echo ""
}

# Function to cleanup on exit
cleanup() {
    print_status "Cleaning up..."
    # This function can be used for cleanup if needed
}

# Trap to cleanup on script exit
trap cleanup EXIT

# Main execution
main() {
    echo ""
    print_status "🚀 Starting CREDEBL Platform with Parallel Build Optimization"
    echo ""
    
    # Pre-flight checks
    check_docker
    check_docker_compose
    check_env_file
    check_directories
    
    # Pull images in parallel
    pull_images
    
    # Start services in optimized order
    start_infrastructure
    start_core_services
    start_tier1_services
    start_tier2_services
    start_tier3_services
    start_agent_services
    
    # Show final status
    show_status
    show_access_info
    
    print_success "✅ CREDEBL Platform launched successfully!"
    print_status "Press Ctrl+C to view logs or run 'docker-compose -f docker-compose-dev.yml logs -f' in another terminal"
    
    # Follow logs
    docker-compose -f docker-compose-dev.yml logs -f
}

# Help function
show_help() {
    echo "CREDEBL Platform Docker Launch Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -s, --status   Show current service status"
    echo "  -d, --down     Stop all services"
    echo "  -r, --restart  Restart all services"
    echo "  -p, --pull     Pull latest images"
    echo ""
    echo "Examples:"
    echo "  $0              # Start all services"
    echo "  $0 --status     # Show service status"
    echo "  $0 --down       # Stop all services"
    echo ""
}

# Parse command line arguments
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    -s|--status)
        docker-compose -f docker-compose-dev.yml ps
        exit 0
        ;;
    -d|--down)
        print_status "Stopping all services..."
        docker-compose -f docker-compose-dev.yml down
        print_success "All services stopped"
        exit 0
        ;;
    -r|--restart)
        print_status "Restarting all services..."
        docker-compose -f docker-compose-dev.yml down
        main
        exit 0
        ;;
    -p|--pull)
        pull_images
        exit 0
        ;;
    "")
        main
        ;;
    *)
        print_error "Unknown option: $1"
        show_help
        exit 1
        ;;
esac
