const axios = require('axios');

async function investigateKeycloakClient() {
  const keycloakUrl = 'https://manager.credence.ng/realms/confirmd-bench';
  const clientId = 'confirmd-bench-management';
  const clientSecret = 'APwJSRD9xjvfjTTZO0RoUz3y7sWej2eO';

  console.log('🔍 Investigating Keycloak client capabilities...');
  console.log('');

  try {
    // Get access token
    console.log('1️⃣ Getting access token...');
    const tokenResponse = await axios.post(
      `${keycloakUrl}/protocol/openid-connect/token`,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const accessToken = tokenResponse.data.access_token;
    console.log('✅ Got access token');

    // Decode the token to see what's in it
    const tokenPayload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
    console.log('');
    console.log('2️⃣ Token payload analysis:');
    console.log('🆔 Client ID (azp):', tokenPayload.azp);
    console.log('🎯 Audience:', tokenPayload.aud);
    console.log('🏷️ Issuer:', tokenPayload.iss);
    console.log('🔑 Subject:', tokenPayload.sub);
    console.log('📋 Scope:', tokenPayload.scope);
    console.log('🎭 Resource Access:', JSON.stringify(tokenPayload.resource_access, null, 2));
    console.log('🎪 Realm Access:', JSON.stringify(tokenPayload.realm_access, null, 2));

    // Try different admin endpoints to see what works
    console.log('');
    console.log('3️⃣ Testing different API endpoints...');

    const endpoints = [
      { name: 'Realm Info', url: `${keycloakUrl}/../admin/realms/confirmd-bench` },
      { name: 'Current Realm Clients', url: `${keycloakUrl}/../admin/realms/confirmd-bench/clients` },
      { name: 'Users', url: `${keycloakUrl}/../admin/realms/confirmd-bench/users` },
      { name: 'Client Roles', url: `${keycloakUrl}/../admin/realms/confirmd-bench/clients/${clientId}/roles` },
      { name: 'UserInfo Endpoint', url: `${keycloakUrl}/protocol/openid-connect/userinfo` }
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`   Testing ${endpoint.name}...`);
        const response = await axios.get(endpoint.url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        console.log(`   ✅ ${endpoint.name}: SUCCESS (${response.status})`);
        if (endpoint.name === 'UserInfo Endpoint') {
          console.log(`      📋 UserInfo:`, JSON.stringify(response.data, null, 6));
        }
      } catch (error) {
        console.log(
          `   ❌ ${endpoint.name}: FAILED (${error.response?.status}) - ${error.response?.data?.error || error.response?.statusText}`
        );
      }
    }
  } catch (error) {
    console.log('❌ Initial token request failed:', error.response?.status, error.response?.statusText);
    console.log(
      '💬 Error Details:',
      error.response?.data?.error_description || error.response?.data?.error || error.message
    );
  }
}

investigateKeycloakClient().catch(console.error);
