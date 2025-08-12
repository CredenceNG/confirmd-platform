# ConfirmD Platform - Complete Development Makefile
.PHONY: help build-libs rebuild-user rebuild-service logs test-email hot-reload start-all stop-all health check

# Configuration
SERVICE ?= user
COMPOSE_FILE = docker-compose-dev.yml
COMPOSE_FILE_HOT = docker-compose-dev-hot-reload.yml
SERVICES_CORE = postgres redis nats api-gateway minio nginx-proxy
SERVICES_ALL = $(SERVICES_CORE) user organization cloud-wallet connection agent-service issuance ledger verification agent-provisioning utility geolocation webhook notification

help: ## Show this help message
	@echo "🚀 ConfirmD Platform - Quick Commands"
	@echo ""
	@echo "⚡ QUICK START (5 minutes):"
	@echo "  make start-all     - Start all services + tunnel"
	@echo "  make health        - Check if everything works"
	@echo "  make stop-all      - Stop everything"
	@echo ""
	@echo "🔧 Development (Library Changes):"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E "(build-libs|rebuild|hot-reload)" | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "� Debugging & Monitoring:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E "(logs|status|check|health)" | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "🌐 Infrastructure:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E "(tunnel|nginx|fix)" | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ============================================================================
# 🚀 QUICK START COMMANDS (5-minute platform startup)
# ============================================================================

start-all: ## Start all services + Cloudflare tunnel (complete platform)
	@echo "🚀 Starting ConfirmD Platform..."
	@echo "Step 1/4: Starting core infrastructure..."
	@docker-compose -f $(COMPOSE_FILE_HOT) up -d $(SERVICES_CORE)
	@echo "Step 2/4: Starting all microservices..."
	@docker-compose -f $(COMPOSE_FILE_HOT) up -d $(SERVICES_ALL)
	@echo "Step 3/4: Starting Cloudflare tunnel..."
	@pkill -f cloudflared || true
	@nohup cloudflared tunnel --config cloudflared-config.yml run > cloudflared.log 2>&1 &
	@echo "Step 4/4: Waiting for services to be ready..."
	@sleep 10
	@echo "✅ All services started! Run 'make health' to verify."

start-core: ## Start only core infrastructure (postgres, redis, nats, api-gateway, nginx)
	@echo "🔧 Starting core infrastructure..."
	@docker-compose -f $(COMPOSE_FILE_HOT) up -d $(SERVICES_CORE)
	@echo "✅ Core services started."

stop-all: ## Stop all services and tunnel
	@echo "🛑 Stopping all services..."
	@docker-compose -f $(COMPOSE_FILE_HOT) down
	@pkill -f cloudflared || true
	@echo "✅ All services stopped."

restart-all: stop-all start-all ## Restart everything (full reset)

health: ## Complete health check (recommended after start-all)
	@echo "🔍 Health Check:"
	@echo "1. Service Status:"
	@docker-compose -f $(COMPOSE_FILE_HOT) ps | grep -E "(Up|Exit)"
	@echo ""
	@echo "2. Nginx Proxy Port Mapping:"
	@docker-compose -f $(COMPOSE_FILE_HOT) ps | grep nginx-proxy | grep "5000"
	@echo ""
	@echo "3. Testing /orgs endpoint (should return 401, not 500):"
	@curl -s -w "HTTP Status: %{http_code}\n" "https://platform.confamd.com/orgs?pageNumber=1&pageSize=20&search=" || echo "❌ Failed to connect"
	@echo ""
	@echo "4. Testing health endpoint:"
	@curl -s -w "HTTP Status: %{http_code}\n" "https://platform.confamd.com/health" || echo "❌ Failed to connect"
	@echo ""
	@echo "5. Cloudflare Tunnel Status:"
	@pgrep -f cloudflared > /dev/null && echo "✅ Tunnel running" || echo "❌ Tunnel not running"

# ============================================================================
# 🔍 DEBUGGING & MONITORING
# ============================================================================

check: ## Comprehensive check (status + health + error logs)
	@make status
	@echo ""
	@make health
	@echo ""
	@echo "6. Recent Error Logs:"
	@docker-compose -f $(COMPOSE_FILE_HOT) logs --tail=5 2>&1 | grep -i error || echo "✅ No recent errors"

logs-all: ## Show logs for all services
	@docker-compose -f $(COMPOSE_FILE_HOT) logs --tail=20

logs-org: ## Show organization service logs (most common debug target)
	@echo "📋 Organization Service Logs:"
	@docker-compose -f $(COMPOSE_FILE_HOT) logs --tail=50 organization

logs-api: ## Show api-gateway logs
	@echo "📋 API Gateway Logs:"
	@docker-compose -f $(COMPOSE_FILE_HOT) logs --tail=50 api-gateway

logs-nginx: ## Show nginx proxy logs
	@echo "📋 Nginx Proxy Logs:"
	@docker-compose -f $(COMPOSE_FILE_HOT) logs --tail=50 nginx-proxy

logs-nats: ## Show NATS logs (for microservice communication issues)
	@echo "📋 NATS Logs:"
	@docker-compose -f $(COMPOSE_FILE_HOT) logs --tail=50 nats

# ============================================================================
# 🌐 TUNNEL & INFRASTRUCTURE MANAGEMENT
# ============================================================================

tunnel-start: ## Start Cloudflare tunnel
	@echo "🌐 Starting Cloudflare tunnel..."
	@pkill -f cloudflared || true
	@nohup cloudflared tunnel --config cloudflared-config.yml run > cloudflared.log 2>&1 &
	@echo "✅ Tunnel started in background."

tunnel-stop: ## Stop Cloudflare tunnel
	@echo "🌐 Stopping Cloudflare tunnel..."
	@pkill -f cloudflared || true
	@echo "✅ Tunnel stopped."

tunnel-list: ## List available Cloudflare tunnels
	@echo "🌐 Available Cloudflare tunnels:"
	@cloudflared tunnel list

fix-org: ## Quick fix for organization service (most common issue)
	@echo "🔧 Quick fix for organization service..."
	@docker-compose -f $(COMPOSE_FILE_HOT) restart organization
	@sleep 5
	@echo "📋 Recent logs:"
	@docker-compose -f $(COMPOSE_FILE_HOT) logs --tail=10 organization

fix-nginx: ## Quick fix for nginx proxy (tunnel connectivity)
	@echo "🔧 Quick fix for nginx proxy..."
	@docker-compose -f $(COMPOSE_FILE_HOT) up -d nginx-proxy
	@echo "📋 Port mapping:"
	@docker-compose -f $(COMPOSE_FILE_HOT) ps | grep nginx-proxy

# ============================================================================
# 🔧 DEVELOPMENT & LIBRARY COMMANDS (original functionality preserved)
# ============================================================================

build-libs: ## Build shared libraries
	@echo "🔨 Building shared libraries..."
	@pnpm run build:libs

rebuild-user: build-libs ## Rebuild user service with lib changes (quick command)
	@echo "🔄 Rebuilding user service..."
	@docker-compose -f $(COMPOSE_FILE) build user --no-cache
	@docker-compose -f $(COMPOSE_FILE) restart user
	@echo "✅ User service rebuilt and restarted"

rebuild-service: build-libs ## Rebuild specific service (use SERVICE=name)
	@echo "🔄 Rebuilding $(SERVICE) service..."
	@docker-compose -f $(COMPOSE_FILE) build $(SERVICE) --no-cache
	@docker-compose -f $(COMPOSE_FILE) restart $(SERVICE)
	@echo "✅ $(SERVICE) service rebuilt and restarted"

logs: ## Show logs for service (use SERVICE=name)
	@echo "📋 Showing logs for $(SERVICE)..."
	@docker-compose -f $(COMPOSE_FILE) logs -f $(SERVICE)

test-email: ## Test email verification endpoint
	@echo "📧 Testing email verification endpoint..."
	@curl -X POST http://localhost:5000/api/v1/auth/verification-mail \
		-H "Content-Type: application/json" \
		-d '{"email": "test@example.com"}' \
		-w "\n⏱️  Response time: %{time_total}s\n" \
		-s -o /dev/null -w "📊 Status: %{http_code}\n" || echo "❌ Request failed"

hot-reload: ## Start hot reload development mode
	@echo "🔥 Starting hot reload mode..."
	@docker-compose -f docker-compose-dev-hot-reload.yml up --build

watch-libs: ## Watch libraries for changes and auto-rebuild user
	@echo "👀 Watching libraries for changes..."
	@if command -v fswatch >/dev/null 2>&1; then \
		fswatch -o libs/ | while read f; do \
			echo "📝 Library change detected, rebuilding user service..."; \
			make rebuild-user; \
		done; \
	else \
		echo "❌ fswatch not available. Install with: brew install fswatch"; \
	fi

# Emergency rebuild - when everything is broken
emergency-rebuild: ## Nuclear option - rebuild everything
	@echo "🚨 Emergency rebuild - rebuilding all services..."
	@docker-compose -f $(COMPOSE_FILE) down
	@docker-compose -f $(COMPOSE_FILE) build --no-cache
	@docker-compose -f $(COMPOSE_FILE) up -d
	@echo "🔥 Emergency rebuild complete"

# Development status check
status: ## Check development environment status (docker services + libs)
	@echo "📊 Development Environment Status:"
	@echo ""
	@echo "🐳 Docker Services:"
	@docker-compose -f $(COMPOSE_FILE_HOT) ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
	@echo ""
	@echo "📦 Node Modules Status:"
	@ls -la node_modules/.pnpm 2>/dev/null | head -3 || echo "  ❌ pnpm modules not found"
	@echo ""
	@echo "🏗️  Compiled Libraries:"
	@ls -la dist/libs/ 2>/dev/null | head -5 || echo "  ❌ No compiled libs found"

# ============================================================================
# ⚠️ EMERGENCY COMMANDS (when everything is broken)
# ============================================================================

emergency-rebuild: ## Nuclear option - rebuild everything from scratch
	@echo "🚨 Emergency rebuild - rebuilding all services..."
	@docker-compose -f $(COMPOSE_FILE_HOT) down
	@docker-compose -f $(COMPOSE_FILE_HOT) build --no-cache
	@docker-compose -f $(COMPOSE_FILE_HOT) up -d
	@echo "🔥 Emergency rebuild complete"

dev-reset: ## Restart all services (keep data)
	@echo "🔄 Development reset (keep data)..."
	@docker-compose -f $(COMPOSE_FILE_HOT) restart $(SERVICES_ALL)
	@echo "✅ All services restarted."

dev-clean: ## Clean rebuild (may lose data)
	@echo "🧹 Clean rebuild (may lose data)..."
	@docker-compose -f $(COMPOSE_FILE_HOT) down -v
	@docker-compose -f $(COMPOSE_FILE_HOT) build --no-cache
	@docker-compose -f $(COMPOSE_FILE_HOT) up -d
	@echo "✅ Clean rebuild complete."

# ============================================================================
# 🏗️ SPECIFIC SERVICE COMMANDS
# ============================================================================

restart-service: ## Restart specific service (use SERVICE=name)
	@echo "🔄 Restarting $(SERVICE)..."
	@docker-compose -f $(COMPOSE_FILE_HOT) restart $(SERVICE)
	@echo "✅ $(SERVICE) restarted."

rebuild-specific: ## Rebuild specific service from cache (use SERVICE=name)
	@echo "🔨 Rebuilding $(SERVICE)..."
	@docker-compose -f $(COMPOSE_FILE_HOT) stop $(SERVICE)
	@docker-compose -f $(COMPOSE_FILE_HOT) build --no-cache $(SERVICE)
	@docker-compose -f $(COMPOSE_FILE_HOT) up -d $(SERVICE)
	@echo "✅ $(SERVICE) rebuilt and started."
