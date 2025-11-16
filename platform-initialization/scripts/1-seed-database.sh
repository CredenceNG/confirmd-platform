#!/bin/bash

# Script 1: Seed Database with Base Data
# Seeds agent types, ledgers, and user roles

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  Confirmd Platform - Database Seeding"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check if postgres container is running
if ! docker ps | grep -q confirmd-platform-postgres-1; then
    echo "❌ Error: PostgreSQL container is not running"
    echo "   Please start services with: docker compose -f docker-compose-dev.yml up -d"
    exit 1
fi

echo "✅ PostgreSQL container is running"
echo ""

# 1. Seed Agent Types
echo "📦 1/3: Seeding Agent Types..."
docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -f - < ../sql/seed-agent-types.sql
echo "✅ Agent types seeded"
echo ""

# 2. Seed Ledgers
echo "🌐 2/3: Seeding Ledger Configurations..."
docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -f - < ../sql/seed-ledgers.sql
echo "✅ Ledger configurations seeded"
echo ""

# 3. Seed User Roles
echo "👥 3/3: Seeding User Roles..."
docker exec confirmd-platform-agent-service-1 node ../../../scripts/seed-platform-roles.js
echo "✅ User roles seeded"
echo ""

# Verification
echo "🔍 Verifying seeded data..."
docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -c "
SELECT 'Agent Types' as category, COUNT(*)::text as count FROM agents_type
UNION ALL
SELECT 'Org Agent Types', COUNT(*)::text FROM org_agents_type
UNION ALL
SELECT 'Ledgers', COUNT(*)::text FROM ledgers
UNION ALL
SELECT 'User Roles', COUNT(*)::text FROM user_role
ORDER BY category;
"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Database seeding completed successfully!"
echo "═══════════════════════════════════════════════════════════"
