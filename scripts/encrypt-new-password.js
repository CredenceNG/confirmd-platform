const crypto = require('crypto');

// Platform encryption settings
const algorithm = 'aes-256-cbc';
const key = 'dzIvVU5uMa0R3sYwdjEEuT4id17mPpjr'; // CRYPTO_PRIVATE_KEY from .env
const iv = crypto.randomBytes(16);

function encrypt(text) {
  const cipher = crypto.createCipher(algorithm, key);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
}

// Encrypt the new password
const newPassword = 'PlatformAdmin123!';
const encryptedPassword = encrypt(newPassword);

console.log('Original password:', newPassword);
console.log('Encrypted password:', encryptedPassword);

// Test decryption
function decrypt(encryptedText) {
  const decipher = crypto.createDecipher(algorithm, key);
  let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

const decryptedPassword = decrypt(encryptedPassword);
console.log('Decrypted password:', decryptedPassword);
console.log('Encryption/Decryption test:', newPassword === decryptedPassword ? 'PASSED' : 'FAILED');
