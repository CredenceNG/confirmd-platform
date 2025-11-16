-- Seed agents_type table
INSERT INTO agents_type (id, agent) VALUES 
(gen_random_uuid(), 'AFJ'),
(gen_random_uuid(), 'ACAPY');

-- Seed org_agents_type table  
INSERT INTO org_agents_type (id, agent) VALUES
(gen_random_uuid(), 'DEDICATED'),
(gen_random_uuid(), 'SHARED');

-- Verify the inserts
SELECT 'agents_type' as table_name, agent FROM agents_type
UNION ALL
SELECT 'org_agents_type' as table_name, agent FROM org_agents_type
ORDER BY table_name, agent;
