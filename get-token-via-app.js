#!/usr/bin/env node

/**
 * Get a fresh JWT token through the application's auth endpoint
 * This should give us a token with the right azp value
 */

const axios = require('axios');
const CryptoJS = require('crypto-js');

async function getFreshTokenViaApp() {
  console.log('🔐 Getting fresh JWT token via application auth endpoint...');

  function encryptPassword(password) {
    const key = 'dzIvVU5uMa0R3sYwdjEEuT4id17mPpjr'; // CRYPTO_PRIVATE_KEY from .env
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(password), key).toString();
    return encrypted;
  }

  // Let's try with the user that was sending invitations
  const plainPassword = process.env.USER_PASSWORD || 'Apoti123!';
  const encryptedPassword = encryptPassword(plainPassword);

  console.log('📧 Email: funcode50@gmail.com');

  const loginData = {
    email: 'funcode50@gmail.com',
    password: encryptedPassword,
    isPasskey: false
  };

  try {
    console.log('\\n1️⃣ Attempting login via app...');
    const loginResponse = await axios.post('http://localhost:5000/auth/signin', loginData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Login successful!');
    const accessToken = loginResponse.data.data?.access_token;

    if (accessToken) {
      console.log('\\n🔍 Decoding JWT token...');

      // Decode JWT token without verification (for inspection only)
      const jwt = require('jsonwebtoken');
      const decodedToken = jwt.decode(accessToken, { complete: true });

      const payload = decodedToken.payload;
      console.log('📋 Token payload:');
      console.log(`- iss: ${payload.iss}`);
      console.log(`- aud: ${payload.aud}`);
      console.log(`- azp: ${payload.azp}`);
      console.log(`- email: ${payload.email}`);
      console.log(`- exp: ${payload.exp} (${new Date(payload.exp * 1000)})`);
      console.log(`- sub: ${payload.sub}`);

      const now = Math.floor(Date.now() / 1000);
      console.log(`- current time: ${now} (${new Date(now * 1000)})`);
      console.log(`- expires in: ${payload.exp - now} seconds`);

      console.log('\\n🎫 Fresh access token:');
      console.log(accessToken);

      return accessToken;
    } else {
      console.log('❌ No access token in response');
      console.log('Response data:', loginResponse.data);
    }
  } catch (error) {
    console.error(`❌ Error getting token:`, {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });

    console.log('\\n💡 Try different passwords:');
    console.log('- Apoti123!');
    console.log('- PlatformAdmin123!');
    console.log('- Or check the user database for the correct password');

    throw error;
  }
}

// Allow running with password as argument
if (require.main === module) {
  const password = process.argv[2];
  if (password) {
    process.env.USER_PASSWORD = password;
  }

  getFreshTokenViaApp().catch(console.error);
}

module.exports = { getFreshTokenViaApp };
