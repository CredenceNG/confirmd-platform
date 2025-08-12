#!/usr/bin/env node

const crypto = require('crypto');

// Current API token from the running agent logs
const CURRENT_API_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZ2VudEluZm8iOiJhZ2VudEluZm8iLCJpYXQiOjE3NTQwODYyMTd9.HQD5bF94POAatDYTiRg_D-ootltwVv8cPVbuCxexwb0';
const CRYPTO_PRIVATE_KEY = 'dzIvVU5uMa0R3sYwdjEEuT4id17mPpjr';

/**
 * Encrypts data using AES-256-CBC (same as common service)
 */
function encryptString(text, key) {
  const algorithm = 'aes-256-cbc';
  const cipher = crypto.createCipher(algorithm, key);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

/**
 * Test decryption
 */
function decryptString(encryptedText, key) {
  try {
    const algorithm = 'aes-256-cbc';
    const decipher = crypto.createDecipher(algorithm, key);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error.message);
    return null;
  }
}

console.log('🔧 Updating Platform Admin API Key in Database...\n');

console.log('📋 Current Details:');
console.log('- API Token from agent logs:', CURRENT_API_TOKEN);
console.log('- Crypto key:', CRYPTO_PRIVATE_KEY);

// Create the API key object structure that the decryptor expects
const apiKeyObject = {
  token: CURRENT_API_TOKEN,
  endpoint: 'http://localhost:8002',
  createdAt: new Date().toISOString(),
  agentLabel: 'platform-admin-agent'
};

// JSON.stringify the object before encrypting (as expected by decryptor)
const apiKeyJson = JSON.stringify(apiKeyObject);

// Encrypt the JSON string
const encryptedApiKey = encryptString(apiKeyJson, CRYPTO_PRIVATE_KEY);
console.log('- Encrypted API key:', encryptedApiKey);

// Test decryption
const testDecrypt = decryptString(encryptedApiKey, CRYPTO_PRIVATE_KEY);
console.log('- Decrypted JSON:', testDecrypt);

// Parse the decrypted JSON and check if it matches
let decryptedObject;
try {
  decryptedObject = JSON.parse(testDecrypt);
  console.log('- Parsed object:', decryptedObject);
  console.log('- Token matches:', decryptedObject.token === CURRENT_API_TOKEN ? '✅ SUCCESS' : '❌ FAILED');
} catch (error) {
  console.log('❌ JSON parsing failed:', error.message);
  process.exit(1);
}

if (decryptedObject.token !== CURRENT_API_TOKEN) {
  console.log('❌ Token mismatch! Exiting...');
  process.exit(1);
}

// Generate SQL to update the existing platform admin record
const now = new Date().toISOString();
const updateSQL = `-- Update platform admin API key with current token from agent logs
UPDATE org_agents 
SET 
    "apiKey" = '${encryptedApiKey}',
    "lastChangedDateTime" = '${now}'
WHERE "orgId" = (
    SELECT id FROM organisation WHERE name = 'Platform-admin'
);

-- Verify the update
SELECT 
    id,
    "orgId", 
    "agentEndPoint",
    "apiKey",
    "lastChangedDateTime"
FROM org_agents 
WHERE "orgId" = (
    SELECT id FROM organisation WHERE name = 'Platform-admin'
);`;

console.log('\n📝 SQL Update Statement:');
console.log(updateSQL);

console.log('\n🔑 Token Comparison:');
console.log('Agent generates iat: 1754086217 (from logs)');
console.log('Previous DB iat:    1754159349 (from old script)');
console.log('The agent is using a different timestamp, which is why auth fails!');

console.log('\n✅ Next Steps:');
console.log('1. Run the SQL above to update the database with current agent token');
console.log('2. Test authentication with the current API token');
console.log('3. Verify that API endpoints work correctly');

console.log('\n💡 Why This Happens:');
console.log('- Agent generates JWT with current iat (issued at time)');
console.log('- Database had JWT with different iat from previous session');
console.log("- Authentication fails because tokens don't match");
console.log("- Need to sync database with agent's current token");

console.log('\n🧪 Test Command After Update:');
console.log(`curl -s -H "X-API-Key: ${CURRENT_API_TOKEN}" http://localhost:8002/health`);
