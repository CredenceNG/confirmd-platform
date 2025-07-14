-- Seed script for ledgers table
-- This script populates the ledgers table with common Indy network configurations

-- Clear existing data (if any)
DELETE FROM ledgers WHERE name IN ('bcovrin:testnet', 'indicio:testnet', 'indicio:demonet', 'indicio:mainnet');

-- Insert common ledger configurations
INSERT INTO ledgers (
    id,
    name, 
    "networkType", 
    "poolConfig", 
    "isActive", 
    "networkString", 
    "nymTxnEndpoint", 
    "indyNamespace"
) VALUES 
(
    gen_random_uuid(),
    'bcovrin:testnet',
    'testnet',
    '{"genesisTransactions":"http://test.bcovrin.vonx.io/genesis","indyNamespace":"bcovrin:testnet"}',
    true,
    'testnet',
    'http://test.bcovrin.vonx.io/register',
    'bcovrin:testnet'
),
(
    gen_random_uuid(),
    'indicio:testnet',
    'testnet', 
    '{"genesisTransactions":"https://raw.githubusercontent.com/Indicio-tech/indicio-network/main/genesis_files/pool_transactions_testnet_genesis","indyNamespace":"indicio:testnet"}',
    true,
    'testnet',
    'https://selfserve.indiciotech.io/',
    'indicio:testnet'
),
(
    gen_random_uuid(),
    'indicio:demonet',
    'demonet',
    '{"genesisTransactions":"https://raw.githubusercontent.com/Indicio-tech/indicio-network/main/genesis_files/pool_transactions_demonet_genesis","indyNamespace":"indicio:demonet"}',
    true,
    'demonet', 
    'https://selfserve.indiciotech.io/',
    'indicio:demonet'
),
(
    gen_random_uuid(),
    'indicio:mainnet',
    'mainnet',
    '{"genesisTransactions":"https://raw.githubusercontent.com/Indicio-tech/indicio-network/main/genesis_files/pool_transactions_mainnet_genesis","indyNamespace":"indicio:mainnet"}',
    false,
    'mainnet',
    'https://selfserve.indiciotech.io/',
    'indicio:mainnet'
);

-- Verify the inserts
SELECT 
    name, 
    "networkType", 
    "isActive",
    LEFT("poolConfig"::text, 50) || '...' as poolConfig_preview
FROM ledgers 
WHERE name LIKE '%:%'
ORDER BY name;
