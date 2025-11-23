# Production Platform Initialization - Quick Start

## ✅ Platform Successfully Initialized!

Your Confirmd platform has been initialized with the following:

### What Was Created

- ✅ **Agent Types**: AFJ, ACAPY
- ✅ **Org Agent Types**: DEDICATED, SHARED
- ✅ **Ledgers**: BCovrin testnet, Indicio networks
- ✅ **User Roles**: DEFAULT_USER, HOLDER
- ✅ **Platform Admin User**: admin@getconfirmd.com
- ✅ **Platform Admin Organization**: f856e3a4-b09c-4356-82de-b105594eec43
- ✅ **Platform Admin Agent**: SHARED agent - used by all organizations with SHARED agent type

---

## 🚀 For Future Production Deployments

### One-Command Initialization

```bash
cd platform-initialization/scripts

# Initialize everything with your API token
./init-platform-simple.sh "your-api-token-here"
```

### Manual Token Update Only

If you need to update just the token later:

```bash
node ./4-update-platform-token.js "new-token-here"
```

---

## 🔑 Platform Admin Credentials

**Email**: admin@getconfirmd.com
**Password**: PlatformAdmin123!
**Org ID**: f856e3a4-b09c-4356-82de-b105594eec43

⚠️ **IMPORTANT**: Change the default password in production!

---

## 📋 Prerequisites

- Docker running
- PostgreSQL container accessible (default: `confirmd-platform-postgres-1`)
- Node.js installed (for token encryption)
- `.env` file with `CRYPTO_PRIVATE_KEY` set

---

## 🔧 Environment Variables

The initialization scripts support these environment variables:

```bash
# Database Configuration
export POSTGRES_CONTAINER="confirmd-platform-postgres-1"  # Container name
export DB_NAME="credebl"                                  # Database name
export DB_USER="postgres"                                 # Database user
export DB_PASSWORD="postgres"                             # Database password
export DB_HOST="localhost"                                # Database host
export DB_PORT="5432"                                     # Database port

# Encryption
export CRYPTO_PRIVATE_KEY="dzIvVU5uMa0R3sYwdjEEuT4id17mPpjr"  # Required!
```

---

## 🐳 Docker Command Examples

### Check Services

```bash
docker ps --filter "name=confirmd-platform"
```

### Check PostgreSQL

```bash
docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -c "
SELECT 'Platform Admin' as check, COUNT(*)
FROM organisation
WHERE id = 'f856e3a4-b09c-4356-82de-b105594eec43';"
```

### View Platform Admin Agent

```bash
docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -c "
SELECT \"walletName\", \"agentEndPoint\", \"agentSpinUpStatus\"
FROM org_agents
WHERE \"orgId\" = 'f856e3a4-b09c-4356-82de-b105594eec43';"
```

---

## 🔄 Re-initialization

If you need to re-initialize (⚠️ **destroys all data**):

```bash
# Drop and recreate database
docker exec confirmd-platform-postgres-1 psql -U postgres -c "
DROP DATABASE IF EXISTS credebl;
CREATE DATABASE credebl;"

# Re-run migrations (restart agent-provisioning service)
docker restart confirmd-platform-agent-provisioning-1

# Wait for migrations to complete (check logs)
docker logs -f confirmd-platform-agent-provisioning-1

# Re-initialize platform
./init-platform-simple.sh "your-api-token"
```

---

## 📂 Script Files

- **`init-platform-simple.sh`** - One-command initialization (recommended for production)
- **`0-init-production.sh`** - Step-by-step initialization with prompts
- **`4-update-platform-token.js`** - Token updater (can auto-extract or use provided token)
- **`run-all.sh`** - Interactive initialization (for development)

---

## ✅ Verification Commands

```bash
# Check all seeded data
docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl << 'EOF'
SELECT 'Agent Types' as category, COUNT(*)::text as count FROM agents_type
UNION ALL SELECT 'Ledgers', COUNT(*)::text FROM ledgers
UNION ALL SELECT 'User Roles', COUNT(*)::text FROM user_role
UNION ALL SELECT 'Platform Admin', COUNT(*)::text FROM organisation
  WHERE id = 'f856e3a4-b09c-4356-82de-b105594eec43';
EOF
```

---

## 🆘 Troubleshooting

### Token Update Fails

```bash
# Check CRYPTO_PRIVATE_KEY is set
echo $CRYPTO_PRIVATE_KEY

# Verify .env file exists
cat .env | grep CRYPTO_PRIVATE_KEY

# Run token update with debug
node ./4-update-platform-token.js "your-token" 2>&1 | tee token-update.log
```

### Container Not Found

```bash
# List all containers
docker ps -a

# Set custom container name
export POSTGRES_CONTAINER="your-postgres-container-name"
./init-platform-simple.sh "your-token"
```

### Database Connection Issues

```bash
# Test database connection
docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -c "SELECT version();"

# Check if database exists
docker exec confirmd-platform-postgres-1 psql -U postgres -l | grep credebl
```

---

## 📚 Additional Documentation

- [README.md](../README.md) - Full initialization guide
- [INITIALIZATION_CHECKLIST.md](../docs/INITIALIZATION_CHECKLIST.md) - Step-by-step checklist
- [TROUBLESHOOTING.md](../docs/TROUBLESHOOTING.md) - Common issues and solutions
- [PLATFORM_ADMIN_SETUP.md](../docs/PLATFORM_ADMIN_SETUP.md) - Platform admin details
- [CHANGELOG.md](../CHANGELOG.md) - Version history and changes

---

## 🎯 Next Steps

1. ✅ Platform is initialized
2. Configure Keycloak (if using external Keycloak)
3. Test platform admin login
4. Create your first organization
5. Set up additional agents as needed

---

*Last Updated: November 17, 2024*
