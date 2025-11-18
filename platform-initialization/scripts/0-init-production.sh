#!/bin/bash

# Production Platform Initialization Script
# This script can be run from any terminal with Docker access
# Designed for production deployments

set -e

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║   Confirmd Platform - Production Initialization          ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Configuration
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-confirmd-platform-postgres-1}"
DB_NAME="${DB_NAME:-credebl}"
DB_USER="${DB_USER:-postgres}"
PLATFORM_ADMIN_TOKEN="$1"

# Change to scripts directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Check prerequisites
echo "🔍 Checking prerequisites..."
echo ""

if ! docker ps | grep -q "$POSTGRES_CONTAINER"; then
    echo "❌ Error: PostgreSQL container ($POSTGRES_CONTAINER) is not running"
    echo ""
    echo "Please start services first or set POSTGRES_CONTAINER environment variable"
    exit 1
fi

echo "✅ PostgreSQL container is running"
echo ""

# ===================================================================
# STEP 1: Seed Agent Types
# ===================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 1/5: Seeding Agent Types"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" << 'EOF'
-- Seed agents_type table (idempotent)
INSERT INTO agents_type (id, agent)
SELECT gen_random_uuid(), 'AFJ'
WHERE NOT EXISTS (SELECT 1 FROM agents_type WHERE agent = 'AFJ');

INSERT INTO agents_type (id, agent)
SELECT gen_random_uuid(), 'ACAPY'
WHERE NOT EXISTS (SELECT 1 FROM agents_type WHERE agent = 'ACAPY');

-- Seed org_agents_type table (idempotent)
INSERT INTO org_agents_type (id, agent)
SELECT gen_random_uuid(), 'DEDICATED'
WHERE NOT EXISTS (SELECT 1 FROM org_agents_type WHERE agent = 'DEDICATED');

INSERT INTO org_agents_type (id, agent)
SELECT gen_random_uuid(), 'SHARED'
WHERE NOT EXISTS (SELECT 1 FROM org_agents_type WHERE agent = 'SHARED');

SELECT 'Agent Types Seeded:' as status;
SELECT agent FROM agents_type ORDER BY agent;
SELECT agent FROM org_agents_type ORDER BY agent;
EOF

echo "✅ Agent types seeded"
echo ""

# ===================================================================
# STEP 2: Seed Ledgers
# ===================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 2/5: Seeding Ledger Configurations"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -f - < ../sql/seed-ledgers.sql

echo "✅ Ledger configurations seeded"
echo ""

# ===================================================================
# STEP 3: Seed User Roles
# ===================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 3/5: Seeding User Roles"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" << 'EOF'
-- Seed user roles (idempotent)
INSERT INTO user_role (id, role, "createDateTime", "lastChangedDateTime")
SELECT gen_random_uuid(), 'DEFAULT_USER', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM user_role WHERE role = 'DEFAULT_USER');

INSERT INTO user_role (id, role, "createDateTime", "lastChangedDateTime")
SELECT gen_random_uuid(), 'HOLDER', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM user_role WHERE role = 'HOLDER');

SELECT 'User Roles Seeded:' as status;
SELECT id, role FROM user_role ORDER BY role;
EOF

echo "✅ User roles seeded"
echo ""

# ===================================================================
# STEP 4: Create Platform Admin Organization
# ===================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 4/5: Creating Platform Admin Organization"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -f - < ../sql/create-platform-admin-org.sql

echo "✅ Platform admin organization created"
echo ""

# ===================================================================
# STEP 5: Update Platform Admin API Token
# ===================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 5/5: Updating Platform Admin API Token"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -n "$PLATFORM_ADMIN_TOKEN" ]; then
    echo "Using provided API token..."
    node ./4-update-platform-token.js "$PLATFORM_ADMIN_TOKEN"
    if [ $? -eq 0 ]; then
        TOKEN_UPDATED=true
    fi
else
    echo "Attempting automatic token extraction..."
    node ./4-update-platform-token.js
    if [ $? -eq 0 ]; then
        TOKEN_UPDATED=true
    else
        echo ""
        echo "⚠️  Auto-extraction failed. You can update the token later with:"
        echo "   node ./4-update-platform-token.js \"your-token-here\""
    fi
fi

echo ""

# ===================================================================
# Verification
# ===================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" << 'EOF'
SELECT 'Initialization Summary:' as status;
SELECT 'Agent Types' as category, COUNT(*)::text as count FROM agents_type
UNION ALL
SELECT 'Org Agent Types', COUNT(*)::text FROM org_agents_type
UNION ALL
SELECT 'Ledgers', COUNT(*)::text FROM ledgers
UNION ALL
SELECT 'User Roles', COUNT(*)::text FROM user_role
UNION ALL
SELECT 'Platform Admin Org', COUNT(*)::text FROM organisation WHERE id = 'f856e3a4-b09c-4356-82de-b105594eec43'
UNION ALL
SELECT 'Platform Admin Agent', COUNT(*)::text FROM org_agents WHERE "orgId" = 'f856e3a4-b09c-4356-82de-b105594eec43'
ORDER BY category;
EOF

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║   ✅ Platform Initialization Complete!                    ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "📋 Summary:"
echo "  ✅ Agent types seeded"
echo "  ✅ Ledger configurations loaded"
echo "  ✅ User roles created"
echo "  ✅ Platform admin organization created"
echo "  $([ "$TOKEN_UPDATED" = true ] && echo '✅' || echo '⚠️ ') Platform admin API token $([ "$TOKEN_UPDATED" = true ] && echo 'updated' || echo 'pending')"
echo ""
echo "🔑 Platform Admin Credentials:"
echo "  Email:    admin@getconfirmd.com"
echo "  Password: PlatformAdmin123!"
echo "  Org ID:   f856e3a4-b09c-4356-82de-b105594eec43"
echo ""
echo "📚 Documentation: platform-initialization/docs/"
echo ""
