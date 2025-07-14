#!/bin/bash

# Quick Access Script for Confirmd Platform
# This script provides easy access to commonly used commands

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}🚀 CONFIRMD PLATFORM - Quick Access${NC}"
echo -e "${BLUE}====================================${NC}"
echo ""
echo "Available commands:"
echo ""
echo -e "${YELLOW}Platform Management:${NC}"
echo "  1. Launch Platform      → ./scripts/launch-platform.sh"
echo "  2. Debug 500 Errors     → ./scripts/quick-500-debug.sh"
echo "  3. Reset Password       → ./scripts/reset-password.sh"
echo "  4. Fix Platform Admin   → ./scripts/fix-platform-admin.sh"
echo ""
echo -e "${YELLOW}Testing:${NC}"
echo "  5. Test Admin Login     → ./test-scripts/test-admin-login.sh"
echo "  6. Test Platform Fix    → ./test-scripts/test-platform-admin-fix.sh"
echo ""
echo -e "${YELLOW}Docker Commands:${NC}"
echo "  7. Start All Services   → docker compose -f docker-compose-dev.yml up -d"
echo "  8. Stop All Services    → docker compose -f docker-compose-dev.yml down"
echo "  9. View Logs            → docker compose -f docker-compose-dev.yml logs -f"
echo "  10. Rebuild & Start     → docker compose -f docker-compose-dev.yml up --build"
echo ""
echo -e "${YELLOW}Documentation:${NC}"
echo "  • Main README           → README.md"
echo "  • Microservice Guide    → docs/README-Microservice.md"
echo "  • Platform Features     → docs/PLATFORM_FEATURES_AND_ONBOARDING.md"
echo "  • Deployment Guide      → docs/PRODUCTION_DEPLOYMENT_GUIDE.md"
echo ""
echo -e "${YELLOW}Quick Start:${NC}"
echo "  docker compose -f docker-compose-dev.yml up --build"
echo "  # Then access: http://localhost (nginx) or http://localhost:5000 (direct)"
echo ""

# Interactive menu
if [ "$1" = "-i" ] || [ "$1" = "--interactive" ]; then
    echo "Select an option (1-10):"
    read -p "Enter choice: " choice
    
    case $choice in
        1) ./scripts/launch-platform.sh ;;
        2) ./scripts/quick-500-debug.sh ;;
        3) ./scripts/reset-password.sh ;;
        4) ./scripts/fix-platform-admin.sh ;;
        5) ./test-scripts/test-admin-login.sh ;;
        6) ./test-scripts/test-platform-admin-fix.sh ;;
        7) docker compose -f docker-compose-dev.yml up -d ;;
        8) docker compose -f docker-compose-dev.yml down ;;
        9) docker compose -f docker-compose-dev.yml logs -f ;;
        10) docker compose -f docker-compose-dev.yml up --build ;;
        *) echo "Invalid choice" ;;
    esac
fi
