#!/usr/bin/env node

// Script to decrypt the platform admin password
const crypto = require('crypto-js');

// Get the environment key (same as used in the platform)
const environment_key = process.env.CRYPTO_PRIVATE_KEY || 'dzIvVU5uMa0R3sYwdjEEuT4id17mPpjr';

// Platform admin password from database (encrypted)
const encryptedPassword = 'U2FsdGVkX191FVVV/xyKLdoncX0kSeW6vPVtlL0EDY7UaZ+cTWpXqV2ipQ7Ock7T';

console.log('🔐 Decrypting platform admin password...');
console.log('🔑 Using crypto key:', environment_key);
console.log('📦 Encrypted password:', encryptedPassword);

try {
  // Try to decrypt the password using the same method as the platform
  const decryptedPassword = crypto.AES.decrypt(encryptedPassword, environment_key).toString(crypto.enc.Utf8);

  if (decryptedPassword && decryptedPassword.length > 0) {
    console.log('✅ Password decryption successful!');
    console.log('🔓 Decrypted password:', decryptedPassword);
  } else {
    console.log('❌ Password decryption failed - empty result');
  }
} catch (error) {
  console.error('❌ Password decryption failed:', error.message);
}
