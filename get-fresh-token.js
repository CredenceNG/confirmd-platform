#!/usr/bin/env node

/**
 * Get a fresh JWT token for testing invitation acceptance
 * This script will authenticate directly with Keycloak using the platform-admin client
 */

const axios = require('axios');

async function getFreshToken() {
  console.log('🔐 Getting fresh JWT token for platform-admin client...');

  // From the original token, we know:
  // - iss: "https://manager.credence.ng/realms/confirmd-bench"
  // - aud: "platform-admin"
  // - azp: "platform-admin"
  // - email: "funcode50@gmail.com"

  const KEYCLOAK_BASE_URL = 'https://manager.credence.ng';
  const REALM = 'confirmd-bench';
  const CLIENT_ID = 'platform-admin';
  const USERNAME = 'funcode50@gmail.com';

  // You'll need to provide the password for this user
  const PASSWORD = process.env.USER_PASSWORD || 'your-password-here';

  try {
    const tokenUrl = `${KEYCLOAK_BASE_URL}/realms/${REALM}/protocol/openid-connect/token`;
    console.log(`🌐 Token URL: ${tokenUrl}`);

    // Using password grant type to get a user token
    const payload = new URLSearchParams({
      grant_type: 'password',
      client_id: CLIENT_ID,
      username: USERNAME,
      password: PASSWORD,
      scope: 'openid profile email'
    });

    console.log(`📦 Request:`, {
      grant_type: 'password',
      client_id: CLIENT_ID,
      username: USERNAME,
      password: '[REDACTED]',
      scope: 'openid profile email'
    });

    const response = await axios.post(tokenUrl, payload, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    console.log(`✅ Token obtained successfully!`);
    console.log(`Token type: ${response.data.token_type}`);
    console.log(`Expires in: ${response.data.expires_in} seconds`);

    const accessToken = response.data.access_token;

    // Decode the token to verify it has the right structure
    const jwt = require('jsonwebtoken');
    const decoded = jwt.decode(accessToken);

    console.log('\\n🔍 Token payload:');
    console.log(`- iss: ${decoded.iss}`);
    console.log(`- aud: ${decoded.aud}`);
    console.log(`- azp: ${decoded.azp}`);
    console.log(`- email: ${decoded.email}`);
    console.log(`- exp: ${decoded.exp} (${new Date(decoded.exp * 1000)})`);

    console.log('\\n🎫 Fresh access token:');
    console.log(accessToken);

    return accessToken;
  } catch (error) {
    console.error(`❌ Error getting token:`, {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });

    if (error.response?.status === 401) {
      console.log('\\n💡 This might be due to:');
      console.log('- Incorrect username/password');
      console.log('- Client not configured for password grant');
      console.log('- User not found in Keycloak');
    }

    throw error;
  }
}

// Allow running with password as argument
if (require.main === module) {
  const password = process.argv[2];
  if (password) {
    process.env.USER_PASSWORD = password;
  }

  if (!process.env.USER_PASSWORD) {
    console.log('Usage: node get-fresh-token.js <password>');
    console.log('Or set USER_PASSWORD environment variable');
    process.exit(1);
  }

  getFreshToken().catch(console.error);
}

module.exports = { getFreshToken };
