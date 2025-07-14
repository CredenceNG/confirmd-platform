#!/bin/bash

# Main Folder Organization Script
# This script organizes the main folder by moving files to appropriate directories

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🗂️  ORGANIZING MAIN FOLDER${NC}"
echo -e "${BLUE}============================${NC}"

# Create directories if they don't exist
echo -e "${YELLOW}Creating directory structure...${NC}"
mkdir -p docs
mkdir -p scripts
mkdir -p test-scripts
mkdir -p config

# Function to move files
move_file() {
    local file=$1
    local destination=$2
    local description=$3
    
    if [ -f "$file" ]; then
        echo -e "${YELLOW}Moving $file to $destination/${NC}"
        mv "$file" "$destination/"
        echo -e "${GREEN}✓ Moved $description${NC}"
    fi
}

# Move all .md files to docs (except README.md)
echo -e "${BLUE}1. Moving documentation files to docs/...${NC}"
move_file "CONTRIBUTING.md" "docs" "contributing guide"
move_file "DOCKER_FIXES_SUMMARY.md" "docs" "docker fixes summary"
move_file "PLATFORM_ADMIN_ANALYSIS.md" "docs" "platform admin analysis"
move_file "PLATFORM_ADMIN_FIX_SUMMARY.md" "docs" "platform admin fix summary"
move_file "PLATFORM_FEATURES_AND_ONBOARDING.md" "docs" "platform features guide"
move_file "PRODUCTION_DEPLOYMENT_GUIDE.md" "docs" "production deployment guide"
move_file "README-Microservice.md" "docs" "microservice readme"

# Move shell scripts to scripts (except test scripts)
echo -e "${BLUE}2. Moving shell scripts to scripts/...${NC}"
move_file "check-mappers.sh" "scripts" "check mappers script"
move_file "create-platform-admin-client.sh" "scripts" "create platform admin client"
move_file "create-platform-admin-role.sh" "scripts" "create platform admin role"
move_file "create-platform-admin-user.sh" "scripts" "create platform admin user"
move_file "debug-token.sh" "scripts" "debug token script"
move_file "encrypt-platform-admin-credentials.sh" "scripts" "encrypt credentials script"
move_file "fix-client-scopes.sh" "scripts" "fix client scopes script"
move_file "fix-platform-admin.sh" "scripts" "fix platform admin script"
move_file "fix-realm-roles-mapper.sh" "scripts" "fix realm roles mapper"
move_file "investigate-platform-admin.sh" "scripts" "investigate platform admin"
move_file "launch-platform.sh" "scripts" "launch platform script"
move_file "reset-password.sh" "scripts" "reset password script"
move_file "quick-500-debug.sh" "scripts" "quick debug script"
move_file "simple-debug.sh" "scripts" "simple debug script"

# Move test scripts to test-scripts
echo -e "${BLUE}3. Moving test scripts to test-scripts/...${NC}"
move_file "test-admin-login.sh" "test-scripts" "test admin login script"
move_file "test-platform-admin-fix.sh" "test-scripts" "test platform admin fix script"

# Move configuration files to config
echo -e "${BLUE}4. Moving configuration files to config/...${NC}"
move_file "compass.yml" "config" "compass configuration"
move_file "nats-server.conf" "config" "NATS server configuration"
move_file "nginx.conf" "config" "nginx configuration"

# Clean up unnecessary files
echo -e "${BLUE}5. Cleaning up unnecessary files...${NC}"
if [ -f "docker-compose.dev.yml" ]; then
    echo -e "${YELLOW}Removing duplicate docker-compose.dev.yml (keeping docker-compose-dev.yml)${NC}"
    rm "docker-compose.dev.yml"
    echo -e "${GREEN}✓ Removed duplicate docker-compose file${NC}"
fi

if [ -d "node_modules" ]; then
    echo -e "${YELLOW}Removing root node_modules directory${NC}"
    rm -rf "node_modules"
    echo -e "${GREEN}✓ Removed root node_modules${NC}"
fi

if [ -d "dist" ]; then
    echo -e "${YELLOW}Removing dist directory${NC}"
    rm -rf "dist"
    echo -e "${GREEN}✓ Removed dist directory${NC}"
fi

# Remove system files
echo -e "${YELLOW}Removing system files...${NC}"
rm -f .DS_Store
rm -f Thumbs.db
rm -f *.log
rm -f *.tmp
echo -e "${GREEN}✓ Removed system files${NC}"

echo -e "${BLUE}6. Updating file references...${NC}"
# Update launch-platform.sh reference in scripts
if [ -f "scripts/launch-platform.sh" ]; then
    echo -e "${YELLOW}Updating launch-platform.sh path references...${NC}"
    # You might need to update any references to ./launch-platform.sh to ./scripts/launch-platform.sh
fi

# Update nginx.conf reference in docker-compose
if [ -f "docker-compose-dev.yml" ]; then
    echo -e "${YELLOW}Updating nginx.conf path in docker-compose-dev.yml...${NC}"
    sed -i '' 's|./nginx.conf|./config/nginx.conf|g' docker-compose-dev.yml
    echo -e "${GREEN}✓ Updated nginx.conf path in docker-compose-dev.yml${NC}"
fi

# Update nats-server.conf reference if needed
if [ -f "docker-compose-dev.yml" ]; then
    echo -e "${YELLOW}Updating nats-server.conf path references...${NC}"
    sed -i '' 's|./nats-server.conf|./config/nats-server.conf|g' docker-compose-dev.yml
    echo -e "${GREEN}✓ Updated nats-server.conf path references${NC}"
fi

echo -e "${GREEN}✅ FOLDER ORGANIZATION COMPLETE!${NC}"
echo ""
echo -e "${BLUE}📁 New folder structure:${NC}"
echo "├── docs/                  # All documentation files"
echo "├── scripts/               # Shell scripts for platform management"
echo "├── test-scripts/          # Test and validation scripts"
echo "├── config/                # Configuration files"
echo "├── apps/                  # Application microservices"
echo "├── libs/                  # Shared libraries"
echo "├── Dockerfiles/           # Docker build files"
echo "├── resources/             # Static resources"
echo "├── docker-compose*.yml    # Docker compose configurations"
echo "├── package.json           # Root package configuration"
echo "├── .env files             # Environment configurations"
echo "└── README.md              # Main project documentation"
echo ""
echo -e "${YELLOW}💡 Next steps:${NC}"
echo "1. Update any hardcoded paths in your scripts"
echo "2. Test platform startup: ./scripts/launch-platform.sh"
echo "3. Verify nginx configuration with new path"
echo "4. Consider adding this organization script to your maintenance routine"
echo ""
echo -e "${GREEN}🎉 Main folder is now clean and organized!${NC}"
