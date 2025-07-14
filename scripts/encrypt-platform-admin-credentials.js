#!/usr/bin/env node

// Encrypt Platform Admin Client Credentials
// This script properly encrypts the management client credentials for the platform admin

const crypto = require('crypto');

// Get environment variables
const managementClientId = process.env.KEYCLOAK_MANAGEMENT_CLIENT_ID;
const managementClientSecret = process.env.KEYCLOAK_MANAGEMENT_CLIENT_SECRET;
const cryptoSecretKey = process.env.CRYPTO_PRIVATE_KEY;

if (!managementClientId || !managementClientSecret || !cryptoSecretKey) {
  console.error('❌ Required environment variables not found');
  console.error('Missing: KEYCLOAK_MANAGEMENT_CLIENT_ID, KEYCLOAK_MANAGEMENT_CLIENT_SECRET, or CRYPTO_PRIVATE_KEY');
  process.exit(1);
}

console.log('🔐 Encrypting management client credentials...');

// Encryption function (matching the platform's encryption logic)
function encrypt(text) {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(cryptoSecretKey, 'salt', 32);
  const iv = Buffer.alloc(16, 0); // Use a static IV for deterministic encryption

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  return encrypted;
}

const encryptedClientId = encrypt(managementClientId);
const encryptedClientSecret = encrypt(managementClientSecret);

console.log('✅ Encryption completed');
console.log('Original Client ID:', managementClientId);
console.log('Encrypted Client ID:', encryptedClientId);
console.log('Original Client Secret:', managementClientSecret);
console.log('Encrypted Client Secret:', encryptedClientSecret);

// Output SQL to update the database
console.log('\n📝 SQL to update platform admin client credentials:');
console.log(
  `UPDATE "user" SET "clientId" = '${encryptedClientId}', "clientSecret" = '${encryptedClientSecret}' WHERE email = 'admin@getconfirmd.com';`
);
