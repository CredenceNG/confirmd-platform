# CONFIRMD PLATFORM - Organized Folder Structure

## 📁 Directory Structure

```
confirmd-platform/
├── 📚 docs/                      # Documentation
│   ├── CONTRIBUTING.md
│   ├── DOCKER_FIXES_SUMMARY.md
│   ├── PLATFORM_ADMIN_ANALYSIS.md
│   ├── PLATFORM_ADMIN_FIX_SUMMARY.md
│   ├── PLATFORM_FEATURES_AND_ONBOARDING.md
│   ├── PRODUCTION_DEPLOYMENT_GUIDE.md
│   └── README-Microservice.md
├── 🛠️  scripts/                   # Shell scripts
│   ├── launch-platform.sh         # Main platform launcher
│   ├── quick-500-debug.sh         # Debug 500 errors
│   ├── reset-password.sh          # Reset admin password
│   ├── fix-platform-admin.sh      # Fix platform admin issues
│   └── ... (other management scripts)
├── 🧪 test-scripts/               # Test scripts
│   ├── test-admin-login.sh
│   └── test-platform-admin-fix.sh
├── ⚙️  config/                    # Configuration files
│   ├── nginx.conf                 # Nginx reverse proxy config
│   ├── nats-server.conf           # NATS messaging config
│   └── compass.yml                # Compass configuration
├── 🏗️  apps/                      # Microservices
│   ├── api-gateway/
│   ├── user/
│   ├── organization/
│   └── ... (other microservices)
├── 📦 libs/                       # Shared libraries
├── 🐳 Dockerfiles/                # Docker build files
├── 📄 docker-compose-dev.yml      # Development environment
├── 📄 docker-compose.yml          # Production environment
├── 📄 package.json                # Node.js dependencies
├── 📄 .env                        # Environment variables
└── 📄 README.md                   # This file
```

## 🚀 Quick Start

### Method 1: Using Quick Access Script
```bash
# Show all available commands
./quick-access.sh

# Interactive mode
./quick-access.sh -i
```

### Method 2: Direct Commands
```bash
# Launch the platform
./scripts/launch-platform.sh

# Or start with Docker Compose
docker compose -f docker-compose-dev.yml up --build
```

## 🌐 Access Points

- **Main Application**: http://localhost (nginx reverse proxy)
- **Direct API Gateway**: http://localhost:5000
- **API Documentation**: http://localhost/api/docs
- **Health Check**: http://localhost/health

## 🛠️ Common Commands

### Platform Management
```bash
./scripts/launch-platform.sh       # Start the platform
./scripts/quick-500-debug.sh       # Debug 500 errors
./scripts/reset-password.sh        # Reset admin password
./scripts/fix-platform-admin.sh    # Fix platform admin issues
```

### Testing
```bash
./test-scripts/test-admin-login.sh      # Test admin login
./test-scripts/test-platform-admin-fix.sh  # Test platform fix
```

### Docker Operations
```bash
# Start all services
docker compose -f docker-compose-dev.yml up -d

# Stop all services
docker compose -f docker-compose-dev.yml down

# View logs
docker compose -f docker-compose-dev.yml logs -f

# Rebuild and start
docker compose -f docker-compose-dev.yml up --build
```

## 📚 Documentation

- **[Microservice Guide](docs/README-Microservice.md)** - Detailed microservice documentation
- **[Platform Features](docs/PLATFORM_FEATURES_AND_ONBOARDING.md)** - Feature overview and onboarding
- **[Production Deployment](docs/PRODUCTION_DEPLOYMENT_GUIDE.md)** - Production deployment guide
- **[Docker Fixes](docs/DOCKER_FIXES_SUMMARY.md)** - Docker configuration fixes
- **[Platform Admin Analysis](docs/PLATFORM_ADMIN_ANALYSIS.md)** - Platform admin setup analysis

## 🔧 Configuration

Configuration files are organized in the `config/` directory:
- `nginx.conf` - Nginx reverse proxy configuration
- `nats-server.conf` - NATS messaging server configuration
- `compass.yml` - Compass configuration

## 🏗️ Architecture

The platform uses a microservices architecture with:
- **nginx** - Reverse proxy and load balancer
- **API Gateway** - Central API management
- **NATS** - Message bus for service communication
- **PostgreSQL** - Primary database
- **Redis** - Caching layer
- **Multiple microservices** - User, Organization, Issuance, Verification, etc.

## 🚨 Troubleshooting

### Quick Debug
```bash
./scripts/quick-500-debug.sh
```

### Common Issues
1. **Port 5000 conflict**: Use nginx on port 80 instead
2. **Service not starting**: Check Docker logs
3. **Database connection**: Verify PostgreSQL is running
4. **NATS communication**: Check service dependencies

### View Logs
```bash
# All services
docker compose -f docker-compose-dev.yml logs -f

# Specific service
docker logs confirmd-platform-[service-name]-1
```

## 📈 Development Workflow

1. **Start Development Environment**
   ```bash
   ./scripts/launch-platform.sh
   ```

2. **Make Changes**
   - Edit code in `apps/` or `libs/`
   - Update configuration in `config/`

3. **Test Changes**
   ```bash
   ./test-scripts/test-platform-admin-fix.sh
   ```

4. **Debug Issues**
   ```bash
   ./scripts/quick-500-debug.sh
   ```

5. **Rebuild if Needed**
   ```bash
   docker compose -f docker-compose-dev.yml up --build
   ```

## 🎯 Benefits of This Organization

- ✅ **Clean main folder** - Only essential files in root
- ✅ **Organized documentation** - All docs in one place
- ✅ **Script management** - Easy to find and manage scripts
- ✅ **Configuration centralization** - All config files together
- ✅ **Test separation** - Test scripts clearly separated
- ✅ **Quick access** - Easy commands for common tasks

## 🔒 Security

- Environment variables are stored in `.env` files
- Platform admin credentials use environment variables
- Configuration files are properly secured
- Docker secrets are managed appropriately

---

**Need Help?** Check the documentation in the `docs/` folder or run the debug script for troubleshooting!
