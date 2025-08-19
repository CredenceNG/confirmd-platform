#!/bin/bash

echo "🔍 Searching for Test organization..."

# Find the Test organization
ORG_INFO=$(docker compose -f docker-compose-dev.yml exec -T postgres psql -U postgres -d credebl -t -c "SELECT id, name FROM organisation WHERE name ILIKE '%test%' LIMIT 1;")

if [ -z "$ORG_INFO" ] || [ "$ORG_INFO" = " " ]; then
    echo "❌ No Test organization found"
    exit 0
fi

echo "✅ Found Test organization: $ORG_INFO"

# Extract the organization ID (first column)
ORG_ID=$(echo "$ORG_INFO" | awk '{print $1}' | tr -d ' ')

echo "🗑️  Deleting organization with ID: $ORG_ID"

# Execute the deletion script
docker compose -f docker-compose-dev.yml exec -T postgres psql -U postgres -d credebl << EOF
-- Start transaction for safety
BEGIN;

-- Delete all related data in dependency order
DELETE FROM user_activity WHERE "orgId" = '$ORG_ID';
DELETE FROM file_data WHERE "fileUploadId" IN (SELECT id FROM file_upload WHERE "orgId" = '$ORG_ID');
DELETE FROM file_upload WHERE "orgId" = '$ORG_ID';
DELETE FROM credential_definition WHERE "orgId" = '$ORG_ID';
DELETE FROM schema WHERE "orgId" = '$ORG_ID';
DELETE FROM presentations WHERE "orgId" = '$ORG_ID';
DELETE FROM credentials WHERE "orgId" = '$ORG_ID';
DELETE FROM connections WHERE "orgId" = '$ORG_ID';
DELETE FROM agent_invitations WHERE "orgId" = '$ORG_ID';
DELETE FROM org_dids WHERE "orgAgentId" IN (SELECT id FROM org_agents WHERE "orgId" = '$ORG_ID');
DELETE FROM org_agents WHERE "orgId" = '$ORG_ID';
DELETE FROM org_invitations WHERE "orgId" = '$ORG_ID';
DELETE FROM user_org_roles WHERE "orgId" = '$ORG_ID';
DELETE FROM organisation WHERE id = '$ORG_ID';

-- Commit the transaction
COMMIT;

-- Verify deletion
SELECT 'Verification: Remaining Test organizations' as result;
SELECT COUNT(*) as count FROM organisation WHERE name ILIKE '%test%';
EOF

echo "✅ Test organization deletion completed!"
