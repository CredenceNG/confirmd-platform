#!/bin/bash

# Script to encrypt platform admin client credentials

echo "=== Encrypting Platform Admin Client Credentials ==="

# Load environment variables
source .env

# Get the crypto key
CRYPTO_KEY="${CRYPTO_PRIVATE_KEY:-dzIvVU5uMa0R3sYwdjEEuT4id17mPpjr}"

echo "Crypto key: $CRYPTO_KEY"

# Create a Node.js script to encrypt the credentials
cat > encrypt_credentials.js << 'EOF'
const CryptoJS = require('crypto-js');

const cryptoKey = process.env.CRYPTO_PRIVATE_KEY || 'dzIvVU5uMa0R3sYwdjEEuT4id17mPpjr';
const clientId = 'platform-admin';
const clientSecret = '';  // Empty for public client

// Encrypt client ID
const encryptedClientId = CryptoJS.AES.encrypt(JSON.stringify(clientId), cryptoKey).toString();

// Encrypt client secret (empty string)
const encryptedClientSecret = CryptoJS.AES.encrypt(JSON.stringify(clientSecret), cryptoKey).toString();

console.log('Encrypted Client ID:', encryptedClientId);
console.log('Encrypted Client Secret:', encryptedClientSecret);

// Test decryption
try {
  const decryptedId = CryptoJS.AES.decrypt(encryptedClientId, cryptoKey);
  const decryptedSecret = CryptoJS.AES.decrypt(encryptedClientSecret, cryptoKey);
  
  console.log('Decrypted Client ID:', JSON.parse(decryptedId.toString(CryptoJS.enc.Utf8)));
  console.log('Decrypted Client Secret:', JSON.parse(decryptedSecret.toString(CryptoJS.enc.Utf8)));
} catch (error) {
  console.error('Decryption test failed:', error.message);
}
EOF

# Check if crypto-js is available
if command -v node &> /dev/null; then
    echo "Running encryption script..."
    CRYPTO_PRIVATE_KEY="$CRYPTO_KEY" node encrypt_credentials.js
    
    # Get the encrypted values
    ENCRYPTED_VALUES=$(CRYPTO_PRIVATE_KEY="$CRYPTO_KEY" node encrypt_credentials.js)
    
    echo "$ENCRYPTED_VALUES"
    
    # Extract encrypted values (this is a simplified approach)
    echo "Please copy the encrypted values from above and update the database manually:"
    echo "UPDATE \"user\" SET \"clientId\" = 'ENCRYPTED_CLIENT_ID', \"clientSecret\" = 'ENCRYPTED_CLIENT_SECRET' WHERE email = 'admin@getconfirmd.com';"
else
    echo "Node.js not found. Please install Node.js to run this script."
fi

# Clean up
rm -f encrypt_credentials.js

echo "=== Encryption Complete ==="
