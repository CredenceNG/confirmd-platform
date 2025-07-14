const axios = require('axios');
const CryptoJS = require('crypto-js');

// Test complete login flow and profile access for itopamsule+15@gmail.com
async function testCompleteFlow() {
  console.log('🔐 Testing complete login flow and profile access for itopamsule+15@gmail.com...');

  // Encrypt password using AES (same as frontend)
  function encryptPassword(password) {
    const key = 'dzIvVU5uMa0R3sYwdjEEuT4id17mPpjr'; // CRYPTO_PRIVATE_KEY from .env
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(password), key).toString();
    return encrypted;
  }

  const plainPassword = 'Apoti123!';
  const encryptedPassword = encryptPassword(plainPassword);

  console.log('📧 Email: itopamsule+15@gmail.com');
  console.log('🔑 Plain password: ' + plainPassword);

  const loginData = {
    email: 'itopamsule+15@gmail.com',
    password: encryptedPassword,
    isPasskey: false
  };

  try {
    // Step 1: Login
    console.log('\n1️⃣ Attempting login...');
    const loginResponse = await axios.post('http://localhost:5000/auth/signin', loginData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Login successful!');
    console.log('📋 Response status:', loginResponse.status);
    console.log('🎫 Access token received:', loginResponse.data.data?.access_token ? 'YES' : 'NO');

    const accessToken = loginResponse.data.data?.access_token;
    const userInfo = loginResponse.data.data?.user;

    if (userInfo) {
      console.log('👤 User ID:', userInfo.id);
      console.log('📧 User email:', userInfo.email);
      console.log('👤 User name:', userInfo.firstName + ' ' + userInfo.lastName);
    }

    // Step 2: Test profile access
    if (accessToken) {
      console.log('\n2️⃣ Testing profile access...');
      try {
        const profileResponse = await axios.get('http://localhost:5000/users/profile', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        console.log('✅ Profile access successful!');
        console.log('📋 Profile response status:', profileResponse.status);
        console.log('👤 Profile user ID:', profileResponse.data.data?.id);
        console.log('📧 Profile email:', profileResponse.data.data?.email);
        console.log('🎭 Roles:', profileResponse.data.data?.userOrgRoles?.map((role) => role.orgRole?.name).join(', '));
      } catch (profileError) {
        console.log('❌ Profile access failed!');
        console.log('📋 Status:', profileError.response?.status);
        console.log('💬 Message:', profileError.response?.data?.message);
      }
    }
  } catch (loginError) {
    console.log('❌ Login failed!');
    console.log('📋 Status:', loginError.response?.status);
    console.log('💬 Message:', loginError.response?.data?.message);
  }
}

testCompleteFlow();
