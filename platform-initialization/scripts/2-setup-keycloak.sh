#!/bin/bash

# Script 2: Setup Keycloak Authentication
# Configures Keycloak realm, roles, and platform admin user
# NOTE: This assumes Keycloak is already running and accessible

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  Confirmd Platform - Keycloak Setup"
echo "═══════════════════════════════════════════════════════════"
echo ""

echo "⚠️  This script requires Keycloak to be running and accessible."
echo ""
echo "If you haven't set up Keycloak yet, please refer to:"
echo "  - ../../scripts/setup-keycloak-roles.sh for full setup"
echo "  - ../../docs/PLATFORM_ADMIN_LOGIN_GUIDE.md for detailed instructions"
echo ""

# Check if the main setup script exists
if [ -f "../../scripts/setup-keycloak-roles.sh" ]; then
    echo "Running Keycloak setup script..."
    cd ../../scripts
    ./setup-keycloak-roles.sh
    cd ../platform-initialization/scripts
    echo ""
    echo "✅ Keycloak setup completed"
else
    echo "⚠️  Keycloak setup script not found."
    echo "   Please set up Keycloak manually or run the setup script from the scripts directory."
    echo ""
    echo "   Key requirements:"
    echo "   - Realm: confirmd-bench"
    echo "   - Client: platform-admin (public client)"
    echo "   - User: admin@getconfirmd.com"
    echo "   - Password: PlatformAdmin123!"
    echo "   - Role: platform_admin"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "Keycloak Setup Step Complete"
echo "═══════════════════════════════════════════════════════════"
