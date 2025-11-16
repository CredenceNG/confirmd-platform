#!/bin/bash

# Master Initialization Script
# Runs all platform initialization steps in order

set -e

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║   Confirmd Platform - Complete Initialization            ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Change to scripts directory
cd "$(dirname "$0")"

# Check prerequisites
echo "🔍 Checking prerequisites..."
echo ""

if ! docker ps | grep -q confirmd-platform-postgres-1; then
    echo "❌ Error: Services are not running"
    echo ""
    echo "Please start services first:"
    echo "  docker compose -f docker-compose-dev.yml up -d"
    echo ""
    exit 1
fi

echo "✅ All services are running"
echo ""

# Confirmation prompt
read -p "⚠️  This will initialize the entire platform. Continue? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Initialization cancelled."
    exit 0
fi

echo ""
echo "Starting initialization process..."
echo ""

# Step 1: Seed Database
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 1/4: Database Seeding"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
./1-seed-database.sh
echo ""

# Step 2: Setup Keycloak
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 2/4: Keycloak Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
./2-setup-keycloak.sh
echo ""

# Step 3: Create Platform Admin
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 3/4: Platform Admin Organization"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
./3-create-platform-admin.sh
echo ""

# Step 4: Update Platform Token (if provided)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 4/4: Platform Admin API Token"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  Platform admin API token update required."
echo ""
read -p "Do you have the platform admin API token? (y/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Please paste your platform admin API token:"
    read -r API_TOKEN
    if [ -n "$API_TOKEN" ]; then
        ./4-update-platform-token.sh "$API_TOKEN"
    else
        echo "⚠️  No token provided. You can update it later with:"
        echo "   ./4-update-platform-token.sh \"your-token-here\""
    fi
else
    echo ""
    echo "⚠️  Skipping token update. You can update it later with:"
    echo "   ./4-update-platform-token.sh \"your-token-here\""
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║   ✅ Platform Initialization Complete!                    ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "📋 Summary:"
echo "  ✅ Database seeded with base data"
echo "  ✅ Keycloak configured"
echo "  ✅ Platform admin organization created"
echo "  $([ -n "$API_TOKEN" ] && echo '✅' || echo '⚠️ ') Platform admin API token $([ -n "$API_TOKEN" ] && echo 'updated' || echo 'pending')"
echo ""
echo "🎯 Next Steps:"
echo "  1. Verify setup with: docker compose -f docker-compose-dev.yml ps"
echo "  2. Check logs: docker compose -f docker-compose-dev.yml logs -f"
echo "  3. Access platform at: http://localhost:5000"
echo ""
echo "📚 Documentation: platform-initialization/docs/"
echo ""
