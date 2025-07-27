#!/usr/bin/env node

/**
 * Get a fresh JWT token for testing i    const accessToken = response.data.access_token;
    const refres  } catch (error) {
    console.error(`❌ Error getting token:`, {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });

    // Add more detailed diagnostic information
    console.error('\n🔍 Diagnostic information:');
    console.error(`- Keycloak URL: ${KEYCLOAK_BASE_URL}`);
    console.error(`- Realm: ${REALM}`);
    console.error(`- Client ID: ${CLIENT_ID}`);
    console.error(`- Username: ${USERNAME}`);
    console.error(`- Password provided: ${process.env.USER_PASSWORD ? 'Yes' : 'No'}`);
    console.error(`- Network status: ${error.code || 'Unknown error code'}`);

    if (error.response?.status === 401) {
      console.log('\n💡 This might be due to:');
      console.log('- Incorrect username/password');
      console.log('- Client not configured for password grant');
      console.log('- User not found in Keycloak');
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.log('\n💡 This might be due to:');
      console.log('- Keycloak server is not reachable');
      console.log('- Network connectivity issues');
      console.log('- Incorrect Keycloak URL');
    }

    throw error;
  }.data.refresh_token;
    
    // Decode the token to verify it has the right structure
    const jwt = require('jsonwebtoken');
    const decoded = jwt.decode(accessToken);

    console.log('\n🔍 Token payload:');
    console.log(`- iss: ${decoded.iss}`);
    console.log(`- aud: ${Array.isArray(decoded.aud) ? decoded.aud.join(', ') : decoded.aud}`);
    console.log(`- azp: ${decoded.azp}`);
    console.log(`- email: ${decoded.email}`);
    console.log(`- exp: ${decoded.exp} (${new Date(decoded.exp * 1000)})`);
    console.log(`- Roles: ${JSON.stringify(decoded.realm_access?.roles || [])}`);
    
    if (options.frontendTesting) {
      // Format for frontend testing - create a configuration object
      const frontendConfig = {
        keycloak: {
          url: KEYCLOAK_BASE_URL,
          realm: REALM,
          clientId: CLIENT_ID,
        },
        auth: {
          accessToken,
          refreshToken,
          expiresAt: new Date(decoded.exp * 1000).toISOString(),
          tokenType: response.data.token_type
        },
        user: {
          email: decoded.email,
          name: decoded.name || decoded.preferred_username,
          roles: decoded.realm_access?.roles || []
        }
      };
      
      console.log('\n🖥️ Frontend Configuration:');
      console.log(JSON.stringify(frontendConfig, null, 2));
      
      // Save to a file for easy import in frontend tests
      if (options.saveToFile) {
        const fs = require('fs');
        const configPath = './frontend-test-auth.json';
        fs.writeFileSync(configPath, JSON.stringify(frontendConfig, null, 2));
        console.log(`\n💾 Config saved to ${configPath}`);
      }
    } else {
      console.log('\n🎫 Fresh access token:');
      console.log(accessToken);
    }

    return { accessToken, refreshToken, decoded };nce and frontend integration
 * This script will authenticate directly with Keycloak using the platform-admin client
 * 
 * Usage: 
 * - For backend testing: node get-fresh-token.js <password>
 * - For frontend testing: node get-fresh-token.js <password> --frontend
 */

const axios = require('axios');
const fs = require('fs');

async function getFreshToken(options = {}) {
  console.log('🔐 Getting fresh JWT token for platform-admin client...');
  console.log(`🧪 Mode: ${options.frontendTesting ? 'Frontend Testing' : 'Backend API Testing'}`);

  // From the original token, we know:
  // - iss: "https://manager.credence.ng/realms/confirmd-bench"
  // - aud: "platform-admin"
  // - azp: "platform-admin"
  // - email: "funcode50@gmail.com"

  const KEYCLOAK_BASE_URL = 'https://manager.credence.ng';
  const REALM = 'confirmd-bench';
  const CLIENT_ID = 'platform-admin'; // Using the platform-admin client that should match the token audience
  const USERNAME = 'admin@getconfirmd.com';

  // You'll need to provide the password for this user
  const PASSWORD = process.env.USER_PASSWORD || 'Pass@123';

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

// Allow running with password and options as arguments
if (require.main === module) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {
    frontendTesting: args.includes('--frontend'),
    saveToFile: args.includes('--save')
  };

  // Remove option flags from args to get the password
  const password = args.find((arg) => !arg.startsWith('--'));
  if (password) {
    process.env.USER_PASSWORD = password;
  }

  if (!process.env.USER_PASSWORD) {
    console.log('Usage: node get-fresh-token.js <password> [options]');
    console.log('Options:');
    console.log('  --frontend    Format output for frontend testing');
    console.log('  --save        Save frontend config to file (implies --frontend)');
    console.log('');
    console.log('Or set USER_PASSWORD environment variable');
    process.exit(1);
  }

  // If saving to file, automatically enable frontend mode
  if (options.saveToFile) {
    options.frontendTesting = true;
  }

  getFreshToken(options).catch((error) => {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response details:', {
        status: error.response.status,
        data: error.response.data
      });
    }
    process.exit(1);
  });
}

module.exports = { getFreshToken };
