#!/bin/bash

# Keycloak Admin API Test and Role Setup Script
# This script tests the Keycloak Admin API connection and creates all required roles

set -e  # Exit on any error

# Configuration from .env file
KEYCLOAK_DOMAIN="https://manager.credence.ng"
KEYCLOAK_ADMIN_URL="https://manager.credence.ng"
KEYCLOAK_MASTER_REALM="master"
KEYCLOAK_REALM="confirmd-bench"
KEYCLOAK_MANAGEMENT_CLIENT_ID="confirmd-bench-management"
KEYCLOAK_MANAGEMENT_CLIENT_SECRET="APwJSRD9xjvfjTTZO0RoUz3y7sWej2eO"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}[HEADER]${NC} $1"
}

# Function to get admin access token
get_admin_token() {
    print_status "Getting admin access token..."
    
    local response=$(curl -s -X POST \
        "${KEYCLOAK_ADMIN_URL}/realms/${KEYCLOAK_MASTER_REALM}/protocol/openid-connect/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "grant_type=client_credentials" \
        -d "client_id=${KEYCLOAK_MANAGEMENT_CLIENT_ID}" \
        -d "client_secret=${KEYCLOAK_MANAGEMENT_CLIENT_SECRET}")
    
    if [ $? -eq 0 ]; then
        local token=$(echo "$response" | jq -r '.access_token // empty')
        if [ -n "$token" ] && [ "$token" != "null" ]; then
            echo "$token"
            return 0
        else
            print_error "Failed to extract token from response: $response"
            return 1
        fi
    else
        print_error "Failed to get admin token"
        return 1
    fi
}

# Function to test API connection
test_api_connection() {
    print_status "Testing Keycloak Admin API connection..."
    
    local token="$1"
    local response=$(curl -s -w "%{http_code}" -o /tmp/keycloak_test.json \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        "${KEYCLOAK_ADMIN_URL}/admin/realms")
    
    if [ "$response" = "200" ]; then
        print_status "✅ Successfully connected to Keycloak Admin API"
        local realm_count=$(jq length /tmp/keycloak_test.json)
        print_status "Found $realm_count realms"
        return 0
    else
        print_error "❌ Failed to connect to Keycloak Admin API (HTTP $response)"
        return 1
    fi
}

# Function to check if realm exists
check_realm_exists() {
    local token="$1"
    local realm="$2"
    
    print_status "Checking if realm '$realm' exists..."
    
    local response=$(curl -s -w "%{http_code}" -o /tmp/realm_check.json \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        "${KEYCLOAK_ADMIN_URL}/admin/realms/$realm")
    
    if [ "$response" = "200" ]; then
        print_status "✅ Realm '$realm' exists"
        return 0
    else
        print_warning "⚠️  Realm '$realm' does not exist (HTTP $response)"
        return 1
    fi
}

# Function to create realm-level roles
create_realm_roles() {
    local token="$1"
    local realm="$2"
    
    print_header "Creating realm-level roles in '$realm'..."
    
    # Define realm-level roles based on CREDEBL requirements
    local realm_roles=(
        "platform_admin:Platform Administrator with full cross-organization access"
        "holder:Individual credential holder for mobile wallet users"
        "mb-user:Basic authenticated user role for platform access"
    )
    
    for role_def in "${realm_roles[@]}"; do
        local role_name=$(echo "$role_def" | cut -d':' -f1)
        local role_description=$(echo "$role_def" | cut -d':' -f2)
        
        print_status "Creating realm role: $role_name"
        
        # Check if role exists
        local check_response=$(curl -s -w "%{http_code}" -o /tmp/role_check.json \
            -H "Authorization: Bearer $token" \
            "${KEYCLOAK_ADMIN_URL}/admin/realms/$realm/roles/$role_name")
        
        if [ "$check_response" = "200" ]; then
            print_warning "Role '$role_name' already exists, skipping..."
            continue
        fi
        
        # Create the role
        local create_response=$(curl -s -w "%{http_code}" -o /tmp/role_create.json \
            -X POST \
            -H "Authorization: Bearer $token" \
            -H "Content-Type: application/json" \
            -d "{
                \"name\": \"$role_name\",
                \"description\": \"$role_description\",
                \"composite\": false,
                \"clientRole\": false
            }" \
            "${KEYCLOAK_ADMIN_URL}/admin/realms/$realm/roles")
        
        if [ "$create_response" = "201" ]; then
            print_status "✅ Created realm role: $role_name"
        else
            print_error "❌ Failed to create realm role '$role_name' (HTTP $create_response)"
            cat /tmp/role_create.json
        fi
    done
}

# Function to get management client ID
get_management_client_id() {
    local token="$1"
    local realm="$2"
    local client_id="$3"
    
    print_status "Getting client UUID for '$client_id'..."
    
    local response=$(curl -s -w "%{http_code}" -o /tmp/client_search.json \
        -H "Authorization: Bearer $token" \
        "${KEYCLOAK_ADMIN_URL}/admin/realms/$realm/clients?clientId=$client_id")
    
    if [ "$response" = "200" ]; then
        local uuid=$(jq -r '.[0].id // empty' /tmp/client_search.json)
        if [ -n "$uuid" ] && [ "$uuid" != "null" ]; then
            echo "$uuid"
            return 0
        else
            print_error "Client '$client_id' not found in realm '$realm'"
            return 1
        fi
    else
        print_error "Failed to search for client '$client_id' (HTTP $response)"
        return 1
    fi
}

# Function to create organization client template
create_organization_template_client() {
    local token="$1"
    local realm="$2"
    
    print_header "Creating organization template client..."
    
    local template_client_id="organization-template"
    
    # Check if template client exists
    local check_response=$(curl -s -w "%{http_code}" -o /tmp/template_check.json \
        -H "Authorization: Bearer $token" \
        "${KEYCLOAK_ADMIN_URL}/admin/realms/$realm/clients?clientId=$template_client_id")
    
    if [ "$check_response" = "200" ]; then
        local client_count=$(jq length /tmp/template_check.json)
        if [ "$client_count" -gt 0 ]; then
            print_warning "Template client already exists, skipping creation..."
            local template_client_uuid=$(jq -r '.[0].id' /tmp/template_check.json)
            echo "$template_client_uuid"
            return 0
        fi
    fi
    
    # Create template client
    local client_create_response=$(curl -s -w "%{http_code}" -o /tmp/template_client_create.json \
        -X POST \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d "{
            \"clientId\": \"$template_client_id\",
            \"name\": \"Organization Template Client\",
            \"description\": \"Template client showing standard organization roles for CREDEBL\",
            \"enabled\": true,
            \"clientAuthenticatorType\": \"client-secret\",
            \"secret\": \"template-secret-change-in-production\",
            \"standardFlowEnabled\": true,
            \"serviceAccountsEnabled\": true,
            \"publicClient\": false,
            \"directAccessGrantsEnabled\": true,
            \"attributes\": {
                \"access.token.lifespan\": \"36000\",
                \"client.secret.creation.time\": \"$(date +%s)\"
            }
        }" \
        "${KEYCLOAK_ADMIN_URL}/admin/realms/$realm/clients")
    
    if [ "$client_create_response" = "201" ]; then
        print_status "✅ Created organization template client"
        
        # Get the created client UUID
        local template_client_uuid=$(get_management_client_id "$token" "$realm" "$template_client_id")
        echo "$template_client_uuid"
        return 0
    else
        print_error "❌ Failed to create template client (HTTP $client_create_response)"
        cat /tmp/template_client_create.json
        return 1
    fi
}

# Function to create organization client roles
create_organization_client_roles() {
    local token="$1"
    local realm="$2"
    local client_uuid="$3"
    
    print_header "Creating organization client roles..."
    
    # Define organization roles based on CREDEBL platform requirements
    local org_roles=(
        "owner:Organization owner with full control and management capabilities"
        "admin:Organization administrator with user management and settings access"
        "super_admin:Organization super administrator with extended privileges"
        "issuer:Credential issuer role for creating and issuing verifiable credentials"
        "verifier:Credential verifier role for requesting and verifying proofs"
        "member:Basic organization member with limited access to organization features"
    )
    
    for role_def in "${org_roles[@]}"; do
        local role_name=$(echo "$role_def" | cut -d':' -f1)
        local role_description=$(echo "$role_def" | cut -d':' -f2)
        
        print_status "Creating organization role: $role_name"
        
        # Check if role exists
        local check_response=$(curl -s -w "%{http_code}" -o /tmp/org_role_check.json \
            -H "Authorization: Bearer $token" \
            "${KEYCLOAK_ADMIN_URL}/admin/realms/$realm/clients/$client_uuid/roles/$role_name")
        
        if [ "$check_response" = "200" ]; then
            print_warning "Organization role '$role_name' already exists, skipping..."
            continue
        fi
        
        # Create the role
        local create_response=$(curl -s -w "%{http_code}" -o /tmp/org_role_create.json \
            -X POST \
            -H "Authorization: Bearer $token" \
            -H "Content-Type: application/json" \
            -d "{
                \"name\": \"$role_name\",
                \"description\": \"$role_description\",
                \"composite\": false,
                \"clientRole\": true
            }" \
            "${KEYCLOAK_ADMIN_URL}/admin/realms/$realm/clients/$client_uuid/roles")
        
        if [ "$create_response" = "201" ]; then
            print_status "✅ Created organization role: $role_name"
        else
            print_error "❌ Failed to create organization role '$role_name' (HTTP $create_response)"
            cat /tmp/org_role_create.json
        fi
    done
}

# Function to create test platform admin user
create_test_platform_admin() {
    local token="$1"
    local realm="$2"
    
    print_header "Creating test platform admin user..."
    
    local admin_username="platform-admin"
    local admin_email="admin@getconfirmd.com"
    local admin_password="PlatformAdmin123!"
    
    # Check if user exists
    local check_response=$(curl -s -w "%{http_code}" -o /tmp/user_check.json \
        -H "Authorization: Bearer $token" \
        "${KEYCLOAK_ADMIN_URL}/admin/realms/$realm/users?username=$admin_username")
    
    if [ "$check_response" = "200" ]; then
        local user_count=$(jq length /tmp/user_check.json)
        if [ "$user_count" -gt 0 ]; then
            print_warning "Platform admin user already exists, updating roles..."
            local user_id=$(jq -r '.[0].id' /tmp/user_check.json)
            assign_platform_admin_role "$token" "$realm" "$user_id"
            return 0
        fi
    fi
    
    # Create the user
    local create_response=$(curl -s -w "%{http_code}" -o /tmp/user_create.json \
        -X POST \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d "{
            \"username\": \"$admin_username\",
            \"email\": \"$admin_email\",
            \"firstName\": \"Platform\",
            \"lastName\": \"Administrator\",
            \"enabled\": true,
            \"emailVerified\": true,
            \"credentials\": [{
                \"type\": \"password\",
                \"value\": \"$admin_password\",
                \"temporary\": false
            }],
            \"attributes\": {
                \"department\": [\"Platform Administration\"],
                \"role_type\": [\"platform_admin\"]
            }
        }" \
        "${KEYCLOAK_ADMIN_URL}/admin/realms/$realm/users")
    
    if [ "$create_response" = "201" ]; then
        print_status "✅ Created platform admin user"
        
        # Get user ID and assign platform-admin role
        local user_search_response=$(curl -s -w "%{http_code}" -o /tmp/user_search.json \
            -H "Authorization: Bearer $token" \
            "${KEYCLOAK_ADMIN_URL}/admin/realms/$realm/users?username=$admin_username")
        
        if [ "$user_search_response" = "200" ]; then
            local user_id=$(jq -r '.[0].id // empty' /tmp/user_search.json)
            if [ -n "$user_id" ] && [ "$user_id" != "null" ]; then
                assign_platform_admin_role "$token" "$realm" "$user_id"
            fi
        fi
    else
        print_error "❌ Failed to create platform admin user (HTTP $create_response)"
        cat /tmp/user_create.json
    fi
}

# Function to assign platform admin role
assign_platform_admin_role() {
    local token="$1"
    local realm="$2"
    local user_id="$3"
    
    print_status "Assigning platform_admin role to user..."
    
    # Get the platform_admin role details
    local role_response=$(curl -s -w "%{http_code}" -o /tmp/platform_admin_role.json \
        -H "Authorization: Bearer $token" \
        "${KEYCLOAK_ADMIN_URL}/admin/realms/$realm/roles/platform_admin")
    
    if [ "$role_response" = "200" ]; then
        local role_data=$(cat /tmp/platform_admin_role.json)
        
        # Assign platform_admin role
        local role_assign_response=$(curl -s -w "%{http_code}" -o /tmp/role_assign.json \
            -X POST \
            -H "Authorization: Bearer $token" \
            -H "Content-Type: application/json" \
            -d "[$role_data]" \
            "${KEYCLOAK_ADMIN_URL}/admin/realms/$realm/users/$user_id/role-mappings/realm")
        
        if [ "$role_assign_response" = "204" ]; then
            print_status "✅ Assigned platform_admin role to user"
        else
            print_error "❌ Failed to assign platform_admin role (HTTP $role_assign_response)"
        fi
        
        # Also assign mb-user role for basic access
        local mb_user_role_response=$(curl -s -w "%{http_code}" -o /tmp/mb_user_role.json \
            -H "Authorization: Bearer $token" \
            "${KEYCLOAK_ADMIN_URL}/admin/realms/$realm/roles/mb-user")
        
        if [ "$mb_user_role_response" = "200" ]; then
            local mb_user_role_data=$(cat /tmp/mb_user_role.json)
            
            local mb_user_assign_response=$(curl -s -w "%{http_code}" -o /tmp/mb_user_assign.json \
                -X POST \
                -H "Authorization: Bearer $token" \
                -H "Content-Type: application/json" \
                -d "[$mb_user_role_data]" \
                "${KEYCLOAK_ADMIN_URL}/admin/realms/$realm/users/$user_id/role-mappings/realm")
            
            if [ "$mb_user_assign_response" = "204" ]; then
                print_status "✅ Assigned mb-user role to user"
            fi
        fi
    else
        print_error "❌ Failed to get platform_admin role details"
    fi
}

# Function to test the created setup
test_setup() {
    print_header "Testing the created setup..."
    
    # Test platform admin login
    print_status "Testing platform admin authentication..."
    
    local login_response=$(curl -s -X POST \
        "${KEYCLOAK_DOMAIN}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "grant_type=password" \
        -d "client_id=account" \
        -d "username=platform-admin" \
        -d "password=PlatformAdmin123!")
    
    local access_token=$(echo "$login_response" | jq -r '.access_token // empty')
    if [ -n "$access_token" ] && [ "$access_token" != "null" ]; then
        print_status "✅ Platform admin login successful"
        
        # Decode and display token claims
        local token_payload=$(echo "$access_token" | cut -d'.' -f2)
        # Add padding if needed for base64 decoding
        local padding=$(( 4 - ${#token_payload} % 4 ))
        if [ $padding -ne 4 ]; then
            token_payload="${token_payload}$(printf '=%.0s' $(seq 1 $padding))"
        fi
        
        local decoded=$(echo "$token_payload" | base64 -d 2>/dev/null || echo "{}")
        local realm_roles=$(echo "$decoded" | jq -r '.realm_access.roles // [] | join(", ")')
        local resource_access=$(echo "$decoded" | jq -r '.resource_access // {} | keys | join(", ")')
        
        print_status "Platform admin realm roles: $realm_roles"
        if [ -n "$resource_access" ] && [ "$resource_access" != "" ]; then
            print_status "Platform admin resource access: $resource_access"
        fi
    else
        print_error "❌ Platform admin login failed"
        echo "Login response: $login_response"
    fi
}

# Function to generate summary report
generate_summary() {
    print_header "=== KEYCLOAK SETUP SUMMARY ==="
    echo
    print_status "Configuration:"
    echo "  Keycloak Domain: $KEYCLOAK_DOMAIN"
    echo "  Target Realm: $KEYCLOAK_REALM"
    echo "  Management Client: $KEYCLOAK_MANAGEMENT_CLIENT_ID"
    echo
    print_status "Created Realm Roles:"
    echo "  - platform_admin: Platform Administrator with cross-organization access"
    echo "  - holder: Individual credential holder for mobile wallet users"
    echo "  - mb-user: Basic authenticated user role"
    echo
    print_status "Created Organization Template Client: 'organization-template'"
    echo "  Organization Client Roles:"
    echo "  - owner: Organization owner with full control"
    echo "  - admin: Organization administrator"
    echo "  - super_admin: Organization super administrator"
    echo "  - issuer: Credential issuer"
    echo "  - verifier: Credential verifier"
    echo "  - member: Organization member"
    echo
    print_status "Test Platform Admin User:"
    echo "  Username: platform-admin"
    echo "  Email: admin@getconfirmd.com"
    echo "  Password: PlatformAdmin123!"
    echo "  Assigned Roles: platform_admin, mb-user"
    echo
    print_status "Next Steps for CREDEBL Integration:"
    echo "  1. Each organization will automatically get a client with the template roles"
    echo "  2. Users will be assigned organization-specific roles via client role mappings"
    echo "  3. Platform admin can manage users across all organizations"
    echo "  4. Update the platform admin password for production use"
    echo "  5. Configure CREDEBL environment variables with Keycloak endpoints"
    echo
    print_status "CREDEBL Environment Variables to Set:"
    echo "  KEYCLOAK_DOMAIN=$KEYCLOAK_DOMAIN"
    echo "  KEYCLOAK_REALM=$KEYCLOAK_REALM"
    echo "  KEYCLOAK_MANAGEMENT_CLIENT_ID=$KEYCLOAK_MANAGEMENT_CLIENT_ID"
    echo "  KEYCLOAK_MANAGEMENT_CLIENT_SECRET=$KEYCLOAK_MANAGEMENT_CLIENT_SECRET"
}

# Main execution
main() {
    print_header "Starting Keycloak Admin API Test and Role Setup for CREDEBL..."
    print_status "Target Keycloak: $KEYCLOAK_ADMIN_URL"
    print_status "Target Realm: $KEYCLOAK_REALM"
    echo
    
    # Check if required tools are installed
    command -v curl >/dev/null 2>&1 || { print_error "curl is required but not installed. Aborting."; exit 1; }
    command -v jq >/dev/null 2>&1 || { print_error "jq is required but not installed. Aborting."; exit 1; }
    
    # Step 1: Get admin token
    local admin_token=$(get_admin_token)
    if [ $? -ne 0 ]; then
        print_error "Failed to get admin token. Please check your credentials."
        exit 1
    fi
    
    # Step 2: Test API connection
    if ! test_api_connection "$admin_token"; then
        print_error "API connection test failed. Please check your Keycloak configuration."
        exit 1
    fi
    
    # Step 3: Check if realm exists
    if ! check_realm_exists "$admin_token" "$KEYCLOAK_REALM"; then
        print_error "Realm '$KEYCLOAK_REALM' does not exist. Please create it first."
        exit 1
    fi
    
    # Step 4: Create realm-level roles
    create_realm_roles "$admin_token" "$KEYCLOAK_REALM"
    
    # Step 5: Create organization template client and roles
    local template_client_uuid=$(create_organization_template_client "$admin_token" "$KEYCLOAK_REALM")
    if [ $? -eq 0 ] && [ -n "$template_client_uuid" ]; then
        create_organization_client_roles "$admin_token" "$KEYCLOAK_REALM" "$template_client_uuid"
    else
        print_warning "Failed to create template client, skipping organization role creation"
    fi
    
    # Step 6: Create test platform admin user
    create_test_platform_admin "$admin_token" "$KEYCLOAK_REALM"
    
    # Step 7: Test the setup
    test_setup
    
    # Step 8: Generate summary
    generate_summary
    
    print_header "Keycloak setup completed successfully for CREDEBL! ✅"
    
    # Cleanup temporary files
    rm -f /tmp/keycloak_test.json /tmp/realm_check.json /tmp/role_*.json /tmp/client_*.json /tmp/user_*.json /tmp/template_*.json /tmp/org_role_*.json /tmp/platform_admin_*.json /tmp/mb_user_*.json
}

# Execute main function
main "$@"
