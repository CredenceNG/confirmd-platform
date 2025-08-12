#!/usr/bin/env node

/**
 * Direct SQL Token Update Script
 *
 * This script directly updates the database using PostgreSQL connection
 * to bypass Prisma client connection issues.
 */

const { Client } = require('pg');
const CryptoJS = require('crypto-js');
const { execSync } = require('child_process');
require('dotenv').config();

class DirectSQLTokenUpdater {
  constructor() {
    this.cryptoKey = process.env.CRYPTO_PRIVATE_KEY;
    if (!this.cryptoKey) {
      throw new Error('CRYPTO_PRIVATE_KEY environment variable is required');
    }

    // Use localhost connection for the host machine
    this.dbConfig = {
      host: 'localhost',
      port: 5432,
      database: 'credebl',
      user: 'postgres',
      password: 'postgres'
    };
  }

  /**
   * Extract current JWT token from platform-admin-agent logs
   */
  extractCurrentToken() {
    try {
      console.log('🔍 Extracting current JWT token from platform-admin-agent logs...');

      const logOutput = execSync(
        'docker logs platform-admin-agent 2>&1 | grep -E "Generated JWT token|JWT token:|eyJ" | tail -1',
        { encoding: 'utf-8' }
      );

      console.log('📝 Raw log output:', logOutput.trim());

      const jwtMatch = logOutput.match(/eyJ[A-Za-z0-9\-_.]+/);
      if (!jwtMatch) {
        throw new Error('No JWT token found in platform-admin-agent logs');
      }

      const token = jwtMatch[0];
      console.log('✅ Extracted JWT token:', token.substring(0, 50) + '...');

      return token;
    } catch (error) {
      console.error('❌ Error extracting token from logs:', error.message);
      throw error;
    }
  }

  /**
   * Encrypt token using the same method as agent-service
   */
  encryptToken(token) {
    try {
      console.log('🔐 Encrypting token using CryptoJS AES...');
      const encryptedToken = CryptoJS.AES.encrypt(token, this.cryptoKey).toString();
      console.log('✅ Token encrypted successfully');
      console.log('🔑 Encrypted token:', encryptedToken.substring(0, 50) + '...');
      return encryptedToken;
    } catch (error) {
      console.error('❌ Error encrypting token:', error.message);
      throw error;
    }
  }

  /**
   * Update database directly using SQL
   */
  async updateDatabaseToken(encryptedToken) {
    const client = new Client(this.dbConfig);

    try {
      console.log('🔌 Connecting to PostgreSQL database...');
      await client.connect();
      console.log('✅ Database connected');

      // First, find the Platform-admin organization
      console.log('🔍 Finding Platform-admin organization...');
      const orgQuery = `
        SELECT id, name 
        FROM organisation 
        WHERE name = 'Platform-admin'
      `;

      const orgResult = await client.query(orgQuery);

      if (orgResult.rows.length === 0) {
        throw new Error('Platform-admin organization not found in database');
      }

      const orgId = orgResult.rows[0].id;
      console.log(`📋 Found Platform-admin organization (ID: ${orgId})`);

      // Find the organization's agents
      console.log('🔍 Finding org_agents for Platform-admin...');
      const agentQuery = `
        SELECT id, "agentEndPoint", "apiKey", "agentSpinUpStatus"
        FROM org_agents 
        WHERE "orgId" = $1
      `;

      const agentResult = await client.query(agentQuery, [orgId]);

      if (agentResult.rows.length === 0) {
        throw new Error('No agents found for Platform-admin organization');
      }

      const agent = agentResult.rows[0];
      console.log(`📋 Found agent (ID: ${agent.id})`);
      console.log(`📋 Current endpoint: ${agent.agentEndPoint}`);
      console.log(`📋 Current status: ${agent.agentSpinUpStatus}`);

      // Update the agent's apiKey
      console.log('🔄 Updating agent apiKey...');
      const updateQuery = `
        UPDATE org_agents 
        SET "apiKey" = $1
        WHERE id = $2
        RETURNING id, "agentEndPoint"
      `;

      const updateResult = await client.query(updateQuery, [encryptedToken, agent.id]);

      if (updateResult.rows.length === 0) {
        throw new Error('Failed to update agent apiKey');
      }

      console.log('✅ Database updated successfully');
      console.log(`📊 Updated agent ID: ${updateResult.rows[0].id}`);
      console.log(`📊 Agent endpoint: ${updateResult.rows[0].agentEndPoint}`);

      return updateResult.rows[0];
    } catch (error) {
      console.error('❌ Database error:', error.message);
      throw error;
    } finally {
      await client.end();
      console.log('🔌 Database connection closed');
    }
  }

  /**
   * Verify the token can be decrypted
   */
  verifyTokenDecryption(encryptedToken) {
    try {
      console.log('🔓 Verifying token decryption...');
      const bytes = CryptoJS.AES.decrypt(encryptedToken, this.cryptoKey);
      const decryptedToken = bytes.toString(CryptoJS.enc.Utf8);

      if (!decryptedToken) {
        throw new Error('Decryption resulted in empty string');
      }

      console.log('✅ Token decryption verification successful');
      console.log('🔍 Decrypted token:', decryptedToken.substring(0, 50) + '...');

      // Check JWT format
      const jwtParts = decryptedToken.split('.');
      if (jwtParts.length === 3) {
        console.log('✅ Token is valid JWT format');

        try {
          const payload = JSON.parse(Buffer.from(jwtParts[1], 'base64').toString());
          console.log('🔍 JWT payload:', JSON.stringify(payload, null, 2));
        } catch (parseError) {
          console.log('⚠️ Could not parse JWT payload');
        }
      }

      return decryptedToken;
    } catch (error) {
      console.error('❌ Token decryption verification failed:', error.message);
      throw error;
    }
  }

  /**
   * Main update process
   */
  async updateToken() {
    try {
      console.log('🚀 Starting Direct SQL Token Update...\n');

      // Step 1: Extract current token
      const currentToken = this.extractCurrentToken();

      // Step 2: Encrypt the token
      const encryptedToken = this.encryptToken(currentToken);

      // Step 3: Verify encryption/decryption works
      const verifiedToken = this.verifyTokenDecryption(encryptedToken);
      if (verifiedToken !== currentToken) {
        throw new Error('Token encryption/decryption verification failed');
      }
      console.log('✅ Encryption/decryption verification passed\n');

      // Step 4: Update database
      const updatedAgent = await this.updateDatabaseToken(encryptedToken);

      console.log('\n🎉 Token update completed successfully!');
      console.log('📋 Summary:');
      console.log(`   - Agent ID: ${updatedAgent.id}`);
      console.log(`   - Agent Endpoint: ${updatedAgent.agentEndPoint}`);
      console.log(`   - Token Length: ${currentToken.length} characters`);
      console.log(`   - Encrypted Length: ${encryptedToken.length} characters`);
      console.log('\n💡 The agent-service should now authenticate successfully with platform-admin-agent');

      return {
        success: true,
        agentId: updatedAgent.id,
        agentEndPoint: updatedAgent.agentEndPoint,
        tokenLength: currentToken.length
      };
    } catch (error) {
      console.error('\n💥 Token update failed:', error.message);
      throw error;
    }
  }
}

// Run the update if this script is executed directly
if (require.main === module) {
  const updater = new DirectSQLTokenUpdater();

  updater
    .updateToken()
    .then(() => {
      console.log('\n✨ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💀 Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = DirectSQLTokenUpdater;
