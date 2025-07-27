#!/usr/bin/env node

/**
 * Decode the JWT token from the frontend to see what's being sent
 */

const jwt = require('jsonwebtoken');

// Token from frontend logs
const token =
  'eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ6VG5wVGc0c3A4alZXZ3hKS1dQNWhqR1E4cU1lV204T1ktakI1N183ckVVIn0.eyJleHAiOjE3NTI4NTUzMTcsImlhdCI6MTc1Mjg1NTAxNywianRpIjoib25ydHJvOjE2ZjMxYjk0LTBiYzYtNDgxMC04NjA1LTI1NjUyYjFiOTcwOSIsImlzcyI6Imh0dHBzOi8vbWFuYWdlci5jcmVkZW5jZS5uZy9yZWFsbXMvY29uZmlybWQtYmVuY2giLCJhdWQiOiJhY2NvdW50Iiwic3ViIjoiN2NkYzM0ZWItNGE1Mi00MDlkLWJkM2UtZmZlZThjODY4OTVkIiwidHlwIjoiQmVhcmVyIiwiYXpwIjoiY29uZmlybWQtYmVuY2gtbWFuYWdlbWVudCIsInNlc3Npb25fc3RhdGUiOiI4YjI4MzNlMy1kODk1LTQ1ZjQtOWM4ZS03Y2VlZmE3MzZkMjYiLCJhY3IiOiIxIiwiYWxsb3dlZC1vcmlnaW5zIjpbIioiXSwicmVhbG1fYWNjZXNzIjp7InJvbGVzIjpbIm9mZmxpbmVfYWNjZXNzIiwidW1hX2F1dGhvcml6YXRpb24iLCJkZWZhdWx0LXJvbGVzLWNvbmZpcm1kLWJlbmNoIl19LCJyZXNvdXJjZV9hY2Nlc3MiOnsiY29uZmlybWQtYmVuY2gtbWFuYWdlbWVudCI6eyJyb2xlcyI6WyJjbGllbnQtYWRtaW4iXX0sImFjY291bnQiOnsicm9sZXMiOlsibWFuYWdlLWFjY291bnQiLCJtYW5hZ2UtYWNjb3VudC1saW5rcyIsInZpZXctcHJvZmlsZSJdfX0sInNjb3BlIjoib3BlbmlkIGVtYWlsIHByb2ZpbGUiLCJzaWQiOiI4YjI4MzNlMy1kODk1LTQ1ZjQtOWM4ZS03Y2VlZmE3MzZkMjYiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiY2xpZW50SG9zdCI6IjEwLjAuMC4xMTciLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJzZXJ2aWNlLWFjY291bnQtY29uZmlybWQtYmVuY2gtbWFuYWdlbWVudCIsImNsaWVudEFkZHJlc3MiOiIxMC4wLjAuMTE3IiwiY2xpZW50X2lkIjoiY29uZmlybWQtYmVuY2gtbWFuYWdlbWVudCJ9.oOfLTh98uEGmJGKsw3d7QRvdZpBsxME6--nqNRm9nJ8STdFEH2z0-F-LD_SJmSNDLKnlgVoKfVJjuIELwfyUVP-zywJ15rOAQ-cePLJl7L3dHXhU2MqOMT2Z6dCY_LsOTKTSFEhGlmNTdXZN9i4oME3JqvZiAoRTNB1n2w2sh5SxMCdycQ6EVoiyxlB5xeKU_6pgUrOg';

console.log('🔍 Decoding frontend JWT token...');

try {
  const decoded = jwt.decode(token, { complete: true });

  console.log('📋 JWT Header:');
  console.log(JSON.stringify(decoded.header, null, 2));

  console.log('\\n📋 JWT Payload:');
  console.log(JSON.stringify(decoded.payload, null, 2));

  const payload = decoded.payload;

  console.log('\\n🔍 Key fields:');
  console.log(`- iss: ${payload.iss}`);
  console.log(`- aud: ${payload.aud}`);
  console.log(`- azp: ${payload.azp}`);
  console.log(`- client_id: ${payload.client_id}`);
  console.log(`- email: ${payload.email}`);
  console.log(`- email_verified: ${payload.email_verified}`);
  console.log(`- preferred_username: ${payload.preferred_username}`);
  console.log(`- sub: ${payload.sub}`);
  console.log(`- exp: ${payload.exp} (${new Date(payload.exp * 1000)})`);

  const now = Math.floor(Date.now() / 1000);
  console.log(`- current time: ${now} (${new Date(now * 1000)})`);
  console.log(`- expires in: ${payload.exp - now} seconds`);
  console.log(`- token expired: ${now > payload.exp}`);
} catch (error) {
  console.error('❌ Error decoding token:', error.message);
}
