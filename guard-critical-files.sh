#!/bin/bash

# CONFIRMD PLATFORM - CRITICAL FILES BACKUP & RECOVERY SCRIPT
# Protects against file loss and Docker directory replacement

BACKUP_DIR="./backups/critical-files"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Critical files that should never be lost
CRITICAL_FILES=(
    "platform-admin/config.master.json"
    "platform-admin/startup.sh" 
    "platform-admin/.env"
    "platform-admin-config.json"
    "platform-admin-config-backup.json"
    "apps/org-apps/"
    "libs/prisma-service/prisma/schema.prisma"
)

backup_critical_files() {
    print_info "Creating backup of critical files..."
    
    mkdir -p "$BACKUP_DIR/$TIMESTAMP"
    
    for file in "${CRITICAL_FILES[@]}"; do
        if [ -e "$file" ]; then
            # Create directory structure in backup
            backup_path="$BACKUP_DIR/$TIMESTAMP/$file"
            mkdir -p "$(dirname "$backup_path")"
            
            if [ -d "$file" ]; then
                cp -r "$file" "$backup_path"
                print_info "✓ Backed up directory: $file"
            else
                cp "$file" "$backup_path"
                print_info "✓ Backed up file: $file"
            fi
        else
            print_warn "⚠️  Missing: $file"
        fi
    done
    
    # Create restore script
    cat > "$BACKUP_DIR/$TIMESTAMP/restore.sh" << 'EOF'
#!/bin/bash
echo "🔄 Restoring critical files from backup..."
BACKUP_SOURCE=$(dirname "$0")
cd "$(git rev-parse --show-toplevel)"

for item in platform-admin apps/org-apps libs/prisma-service/prisma/schema.prisma platform-admin-*.json; do
    if [ -e "$BACKUP_SOURCE/$item" ]; then
        if [ -d "$BACKUP_SOURCE/$item" ]; then
            rm -rf "$item" 2>/dev/null
            cp -r "$BACKUP_SOURCE/$item" "$item"
            echo "✓ Restored directory: $item"
        else
            cp "$BACKUP_SOURCE/$item" "$item"
            echo "✓ Restored file: $item"
        fi
    fi
done

echo "🎉 Files restored! Run 'docker restart platform-admin-agent' if needed."
EOF
    
    chmod +x "$BACKUP_DIR/$TIMESTAMP/restore.sh"
    print_info "🎉 Backup created: $BACKUP_DIR/$TIMESTAMP"
    print_info "📝 To restore: run $BACKUP_DIR/$TIMESTAMP/restore.sh"
}

check_docker_mounts() {
    print_info "🔍 Checking for Docker directory replacements..."
    
    for file in "${CRITICAL_FILES[@]}"; do
        if [ -d "$file" ] && [[ "$file" == *.json ]] || [[ "$file" == *.sh ]]; then
            print_error "🚨 DOCKER ISSUE DETECTED: $file is a directory (should be file)!"
            
            # Check for Docker container attributes
            if ls -la@ "$file" 2>/dev/null | grep -q "user.containers.override_stat"; then
                print_error "   └─ Confirmed: Docker created this directory"
                print_warn "   └─ Fix: Stop containers, remove directory, restore file, restart"
            fi
        fi
    done
}

prevent_future_issues() {
    print_info "🛡️  Setting up prevention measures..."
    
    # Add to .gitignore exceptions to ensure tracking
    if ! grep -q "!platform-admin/config.master.json" .gitignore 2>/dev/null; then
        echo -e "\n# Critical platform-admin files (override .env ignores)" >> .gitignore
        echo "!platform-admin/config.master.json" >> .gitignore  
        echo "!platform-admin/startup.sh" >> .gitignore
        print_info "✓ Added critical files to git tracking"
    fi
    
    # Create file protection script
    cat > "./protect-files.sh" << 'EOF'
#!/bin/bash
# Run this before Docker operations to protect critical files

# Make critical files immutable (requires sudo on some systems)
# chattr +i platform-admin/config.master.json platform-admin/startup.sh 2>/dev/null || true

# Create hard links as backup (survives directory replacement)
mkdir -p .file-protection
ln platform-admin/config.master.json .file-protection/config.master.json.backup 2>/dev/null || true
ln platform-admin/startup.sh .file-protection/startup.sh.backup 2>/dev/null || true

echo "🛡️ Files protected"
EOF
    chmod +x "./protect-files.sh"
    
    print_info "✓ Created ./protect-files.sh - run before Docker operations"
}

case "$1" in
    "backup")
        backup_critical_files
        ;;
    "check")
        check_docker_mounts
        ;;
    "protect")
        prevent_future_issues
        ;;
    "all")
        backup_critical_files
        check_docker_mounts  
        prevent_future_issues
        ;;
    *)
        echo "Usage: $0 {backup|check|protect|all}"
        echo ""
        echo "Commands:"
        echo "  backup  - Create timestamped backup of critical files"
        echo "  check   - Check for Docker directory replacement issues"
        echo "  protect - Set up prevention measures"
        echo "  all     - Run all protection measures"
        exit 1
        ;;
esac