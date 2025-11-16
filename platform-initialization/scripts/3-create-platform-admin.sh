#!/bin/bash

# Script 3: Create Platform Admin Organization and Agent
# Creates the platform admin organization and agent records in the database

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  Confirmd Platform - Platform Admin Setup"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check if postgres container is running
if ! docker ps | grep -q confirmd-platform-postgres-1; then
    echo "❌ Error: PostgreSQL container is not running"
    exit 1
fi

echo "Creating platform admin organization and agent..."
echo ""

# Run the SQL script
docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -f - < ../sql/create-platform-admin-org.sql

echo ""
echo "⚠️  IMPORTANT: The platform admin agent record has been created with a placeholder API token."
echo "   You MUST run script 4 to update it with the actual encrypted API token:"
echo ""
echo "   ./4-update-platform-token.sh \"your-actual-api-token\""
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Platform admin organization created!"
echo "═══════════════════════════════════════════════════════════"
