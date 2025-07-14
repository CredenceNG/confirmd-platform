#!/bin/bash

# Platform Admin User Creation Script
# This script creates the platform admin user in the platform database

echo "=== Creating Platform Admin User in Database ==="
echo "This script will create the platform admin user record in the platform database."
echo

# Load environment variables
source .env

# Database connection details
DB_HOST="${DATABASE_HOST:-localhost}"
DB_PORT="${DATABASE_PORT:-5432}"
DB_NAME="${DATABASE_NAME:-credebl}"
DB_USER="${DATABASE_USERNAME:-postgres}"
DB_PASSWORD="${DATABASE_PASSWORD:-postgres}"

# Platform admin details
ADMIN_EMAIL="admin@getconfirmd.com"
ADMIN_KEYCLOAK_ID="1f7fafe5-9a0d-4f8e-9b60-d35f5b992973"
ADMIN_FIRST_NAME="Platform"
ADMIN_LAST_NAME="Admin"
ADMIN_USERNAME="platformadmin"

echo "Database Details:"
echo "- Host: $DB_HOST"
echo "- Port: $DB_PORT"
echo "- Database: $DB_NAME"
echo "- User: $DB_USER"
echo

echo "Platform Admin Details:"
echo "- Email: $ADMIN_EMAIL"
echo "- Keycloak ID: $ADMIN_KEYCLOAK_ID"
echo "- Name: $ADMIN_FIRST_NAME $ADMIN_LAST_NAME"
echo "- Username: $ADMIN_USERNAME"
echo

# Check if user already exists
echo "Checking if user already exists..."
EXISTING_USER=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT email FROM \"user\" WHERE email = '$ADMIN_EMAIL';" 2>/dev/null)

if [ ! -z "$EXISTING_USER" ]; then
    echo "✓ User already exists in database: $EXISTING_USER"
    echo "Checking user details..."
    
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
    SELECT 
        email, 
        \"firstName\", 
        \"lastName\", 
        \"keycloakUserId\", 
        \"isEmailVerified\",
        \"publicProfile\"
    FROM \"user\" 
    WHERE email = '$ADMIN_EMAIL';"
    
    echo
    echo "User exists. If you need to update the user details, please run the update script."
    exit 0
fi

echo "User does not exist. Creating new user record..."

# Create the user record
echo "Creating platform admin user in database..."

CREATE_USER_SQL="
INSERT INTO \"user\" (
    id,
    \"createDateTime\",
    \"lastChangedDateTime\",
    \"firstName\",
    \"lastName\",
    email,
    username,
    \"isEmailVerified\",
    \"keycloakUserId\",
    \"publicProfile\"
) VALUES (
    gen_random_uuid(),
    NOW(),
    NOW(),
    '$ADMIN_FIRST_NAME',
    '$ADMIN_LAST_NAME',
    '$ADMIN_EMAIL',
    '$ADMIN_USERNAME',
    true,
    '$ADMIN_KEYCLOAK_ID',
    true
);"

echo "Executing SQL:"
echo "$CREATE_USER_SQL"
echo

# Execute the SQL
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "$CREATE_USER_SQL"

if [ $? -eq 0 ]; then
    echo "✓ Successfully created platform admin user in database!"
    
    # Verify creation
    echo
    echo "Verifying user creation..."
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
    SELECT 
        id,
        email, 
        \"firstName\", 
        \"lastName\", 
        \"keycloakUserId\", 
        \"isEmailVerified\",
        \"publicProfile\",
        \"createDateTime\"
    FROM \"user\" 
    WHERE email = '$ADMIN_EMAIL';"
    
    echo
    echo "✓ Platform admin user successfully created!"
    echo "✓ The user should now be able to login through the frontend."
else
    echo "✗ Failed to create platform admin user"
    exit 1
fi

echo
echo "=== Platform Admin User Creation Complete ==="
echo "You can now try logging in with:"
echo "- Email: $ADMIN_EMAIL"
echo "- Password: PlatformAdmin123!"
echo
