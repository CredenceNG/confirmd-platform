# Development Makefile for shared library changes
.PHONY: help build-libs rebuild-user rebuild-service logs test-email hot-reload

# Default service
SERVICE ?= user
COMPOSE_FILE = docker-compose-dev.yml

help: ## Show this help message
	@echo "🚀 Development commands for shared library changes:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "📝 Examples:"
	@echo "  make rebuild-user              # Rebuild user service"
	@echo "  make rebuild-service SERVICE=api-gateway  # Rebuild specific service"
	@echo "  make hot-reload                # Start hot reload mode"

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
status: ## Check development environment status
	@echo "📊 Development Environment Status:"
	@echo ""
	@echo "🐳 Docker Services:"
	@docker-compose -f $(COMPOSE_FILE) ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
	@echo ""
	@echo "📦 Node Modules Status:"
	@ls -la node_modules/.pnpm 2>/dev/null | head -3 || echo "  ❌ pnpm modules not found"
	@echo ""
	@echo "🏗️  Compiled Libraries:"
	@ls -la dist/libs/ 2>/dev/null | head -5 || echo "  ❌ No compiled libs found"
