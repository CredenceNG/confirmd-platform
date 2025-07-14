const CryptoJS = require('crypto-js');

// This should match your CRYPTO_PRIVATE_KEY from .env
const CRYPTO_PRIVATE_KEY = 'dzIvVU5uMa0R3sYwdjEEuT4id17mPpjr';

function encryptPassword(password) {
  return CryptoJS.AES.encrypt(password, CRYPTO_PRIVATE_KEY).toString();
}

function decryptPassword(encryptedPassword) {
  const bytes = CryptoJS.AES.decrypt(encryptedPassword, CRYPTO_PRIVATE_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

console.log('🔐 Encrypting Platform Admin Credentials...');

// Encrypt the clientId and clientSecret
const encryptedClientId = encryptPassword('platform-admin');
const encryptedClientSecret = encryptPassword('public-client-no-secret');

console.log('');
console.log('✅ Encrypted Credentials:');
console.log(`clientId (platform-admin): ${encryptedClientId}`);
console.log(`clientSecret (public-client-no-secret): ${encryptedClientSecret}`);

console.log('');
console.log('🔍 Verification - Decrypting back:');
console.log(`clientId decrypts to: ${decryptPassword(encryptedClientId)}`);
console.log(`clientSecret decrypts to: ${decryptPassword(encryptedClientSecret)}`);

console.log('');
console.log('📋 SQL Command to update database:');
console.log(
  `UPDATE "user" SET "clientId" = '${encryptedClientId}', "clientSecret" = '${encryptedClientSecret}' WHERE email = 'admin@getconfirmd.com';`
);
