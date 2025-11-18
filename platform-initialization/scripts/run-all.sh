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

# Step 4: Update Platform Token (auto-extract or manual)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 4/4: Platform Admin API Token"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "This step will automatically extract the JWT token from platform-admin-agent logs."
echo ""
read -p "Proceed with automatic token extraction? (Y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    echo ""
    echo "Attempting automatic token extraction..."
    node ./4-update-platform-token.js
    TOKEN_UPDATE_STATUS=$?
    if [ $TOKEN_UPDATE_STATUS -eq 0 ]; then
        echo ""
        echo "✅ Token updated successfully via auto-extraction"
        TOKEN_UPDATED=true
    else
        echo ""
        echo "⚠️  Auto-extraction failed. You can provide the token manually:"
        read -p "Do you want to provide the token manually? (y/N) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo ""
            echo "Please paste your platform admin API token:"
            read -r API_TOKEN
            if [ -n "$API_TOKEN" ]; then
                node ./4-update-platform-token.js "$API_TOKEN"
                if [ $? -eq 0 ]; then
                    TOKEN_UPDATED=true
                fi
            else
                echo "⚠️  No token provided. You can update it later with:"
                echo "   node ./4-update-platform-token.js \"your-token-here\""
            fi
        else
            echo ""
            echo "⚠️  Skipping token update. You can update it later with:"
            echo "   node ./4-update-platform-token.js"
        fi
    fi
else
    echo ""
    echo "⚠️  Skipping token update. You can update it later with:"
    echo "   node ./4-update-platform-token.js"
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
echo "  $([ "$TOKEN_UPDATED" = true ] && echo '✅' || echo '⚠️ ') Platform admin API token $([ "$TOKEN_UPDATED" = true ] && echo 'updated' || echo 'pending')"
echo ""
echo "🎯 Next Steps:"
echo "  1. Verify setup with: docker compose -f docker-compose-dev.yml ps"
echo "  2. Check logs: docker compose -f docker-compose-dev.yml logs -f"
echo "  3. Access platform at: http://localhost:5000"
echo ""
echo "📚 Documentation: platform-initialization/docs/"
echo ""
