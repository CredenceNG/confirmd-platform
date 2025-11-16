-- Create Platform Admin Organization and Agent
-- This script sets up the platform admin organization and agent configuration

-- 1. Create Platform Admin Organization (if not exists)
INSERT INTO organisation (
    id,
    "createDateTime",
    "lastChangedDateTime",
    "createdBy",
    "lastChangedBy",
    name,
    description,
    "orgSlug",
    "publicProfile"
) VALUES (
    'f856e3a4-b09c-4356-82de-b105594eec43',
    NOW(),
    NOW(),
    '1f7fafe5-9a0d-4f8e-9b60-d35f5b992973', -- Platform Admin User ID
    '1f7fafe5-9a0d-4f8e-9b60-d35f5b992973',
    'Platform Admin',
    'System platform administrator organization',
    'platform-admin',
    false
)
ON CONFLICT (id) DO UPDATE SET
    "lastChangedDateTime" = NOW(),
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- 2. Create Platform Admin Agent record (will be updated with actual API token later)
-- Note: Replace 'ENCRYPTED_API_TOKEN_HERE' with actual encrypted token using script 4
INSERT INTO org_agents (
    id,
    "createDateTime",
    "lastChangedDateTime",
    "orgId",
    "createdBy",
    "lastChangedBy",
    "walletName",
    "agentEndPoint",
    "agentSpinUpStatus",
    "apiKey",
    "ledgerId",
    "orgAgentTypeId",
    "tenantId"
)
SELECT
    gen_random_uuid(),
    NOW(),
    NOW(),
    'f856e3a4-b09c-4356-82de-b105594eec43',
    '1f7fafe5-9a0d-4f8e-9b60-d35f5b992973',
    '1f7fafe5-9a0d-4f8e-9b60-d35f5b992973',
    'platform-admin',
    'http://platform-admin-agent:8002', -- Update this based on your actual agent endpoint
    3, -- Spin up complete
    'ENCRYPTED_API_TOKEN_HERE', -- Will be updated by script 4
    (SELECT id FROM ledgers WHERE name = 'bcovrin:testnet' LIMIT 1),
    (SELECT id FROM org_agents_type WHERE agent = 'DEDICATED' LIMIT 1),
    'platform-admin-tenant'
WHERE NOT EXISTS (
    SELECT 1 FROM org_agents WHERE "orgId" = 'f856e3a4-b09c-4356-82de-b105594eec43'
);

-- 3. Verify the setup
SELECT
    'Organization' as type,
    id,
    name,
    "orgSlug"
FROM organisation
WHERE id = 'f856e3a4-b09c-4356-82de-b105594eec43'

UNION ALL

SELECT
    'Agent' as type,
    id,
    "walletName" as name,
    "agentEndPoint" as "orgSlug"
FROM org_agents
WHERE "orgId" = 'f856e3a4-b09c-4356-82de-b105594eec43';
