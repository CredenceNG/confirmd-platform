#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable prefer-destructuring */
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * Platform Admin API Token Updater
 *
 * Automatically extracts the JWT token from platform-admin-agent logs,
 * encrypts it using CryptoJS AES (matching the platform's encryption),
 * and updates the database.
 *
 * Usage:
 *   ./4-update-platform-token.js [token]           # Auto-extract or use provided token
 *   node 4-update-platform-token.js [token]        # Same as above
 *
 * Environment Variables:
 *   CRYPTO_PRIVATE_KEY - AES encryption key (required)
 *   DB_HOST            - Database host (default: localhost)
 *   DB_PORT            - Database port (default: 5432)
 *   DB_NAME            - Database name (default: credebl)
 *   DB_USER            - Database user (default: postgres)
 *   DB_PASSWORD        - Database password (default: postgres)
 */

const { Client } = require('pg');
const CryptoJS = require('crypto-js');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load .env from project root
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

class PlatformAdminTokenUpdater {
  constructor(options = {}) {
    this.cryptoKey = options.cryptoKey || process.env.CRYPTO_PRIVATE_KEY;
    if (!this.cryptoKey) {
      throw new Error('CRYPTO_PRIVATE_KEY environment variable is required');
    }

    // Database configuration with environment variable support
    this.dbConfig = {
      host: options.dbHost || process.env.DB_HOST || 'localhost',
      port: parseInt(options.dbPort || process.env.DB_PORT || '5432'),
      database: options.dbName || process.env.DB_NAME || 'credebl',
      user: options.dbUser || process.env.DB_USER || 'postgres',
      password: options.dbPassword || process.env.DB_PASSWORD || 'postgres'
    };

    // Container name patterns to try
    this.containerPatterns = [
      'platform-admin-agent', // Manual docker run
      'confirmd-platform-platform-admin-agent-1', // Docker Compose v2
      'confirmd-platform_platform-admin-agent_1' // Docker Compose v1
    ];

    // Organization name to search for
    this.orgName = options.orgName || 'Platform Admin';
  }

  /**
   * Find the platform-admin-agent container
   */
  findAgentContainer() {
    console.log('🔍 Searching for platform-admin-agent container...');

    for (const pattern of this.containerPatterns) {
      try {
        const result = execSync(`docker ps --filter "name=${pattern}" --format "{{.Names}}"`, {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe']
        }).trim();

        if (result) {
          console.log(`✅ Found container: ${result}`);
          return result;
        }
      } catch (error) {
        // Continue to next pattern
      }
    }

    // If no exact match, try partial match
    try {
      const allContainers = execSync('docker ps --format "{{.Names}}"', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const match = allContainers.split('\n').find((name) => name.toLowerCase().includes('platform-admin-agent'));

      if (match) {
        console.log(`✅ Found container (partial match): ${match}`);
        return match;
      }
    } catch (error) {
      // Ignore
    }

    throw new Error('platform-admin-agent container not found. Is it running?');
  }

  /**
   * Extract current JWT token from platform-admin-agent logs
   */
  extractCurrentToken() {
    try {
      console.log('🔍 Extracting JWT token from platform-admin-agent logs...');

      const containerName = this.findAgentContainer();

      // Try multiple log extraction patterns
      const patterns = [
        `docker logs ${containerName} 2>&1 | grep -E "Generated JWT token|JWT token:|API Key:" | tail -1`,
        `docker logs ${containerName} 2>&1 | grep -oE "eyJ[A-Za-z0-9\\-_.]{100,}" | tail -1`
      ];

      let logOutput = '';
      for (const pattern of patterns) {
        try {
          logOutput = execSync(pattern, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
          if (logOutput) {
            break;
          }
        } catch (error) {
          // Try next pattern
        }
      }

      if (!logOutput) {
        throw new Error('No log output found');
      }

      console.log('📝 Raw log output:', `${logOutput.substring(0, 100)}...`);

      // Extract JWT token using regex
      const jwtMatch = logOutput.match(/eyJ[A-Za-z0-9\-_.]+/);
      if (!jwtMatch) {
        throw new Error('No JWT token found in platform-admin-agent logs');
      }

      const token = jwtMatch[0];
      console.log('✅ Extracted JWT token:', `${token.substring(0, 50)}...`);

      return token;
    } catch (error) {
      console.error('❌ Error extracting token from logs:', error.message);
      console.log('\n💡 Tip: You can provide the token manually as an argument:');
      console.log('   ./4-update-platform-token.js "your-jwt-token-here"');
      throw error;
    }
  }

  /**
   * Encrypt token using CryptoJS AES (matches platform encryption)
   */
  encryptToken(token) {
    try {
      console.log('🔐 Encrypting token using CryptoJS AES...');

      // Important: Encrypt the raw token, NOT JSON.stringify(token)
      // This matches how the agent-service encrypts tokens
      const encryptedToken = CryptoJS.AES.encrypt(token, this.cryptoKey).toString();

      console.log('✅ Token encrypted successfully');
      console.log('🔑 Encrypted token preview:', `${encryptedToken.substring(0, 50)}...`);

      return encryptedToken;
    } catch (error) {
      console.error('❌ Error encrypting token:', error.message);
      throw error;
    }
  }

  /**
   * Verify the token can be decrypted correctly
   */
  verifyTokenDecryption(encryptedToken, originalToken) {
    try {
      console.log('🔓 Verifying token decryption...');

      const bytes = CryptoJS.AES.decrypt(encryptedToken, this.cryptoKey);
      const decryptedToken = bytes.toString(CryptoJS.enc.Utf8);

      if (!decryptedToken) {
        throw new Error('Decryption resulted in empty string');
      }

      if (decryptedToken !== originalToken) {
        console.error('⚠️  Decrypted token does not match original!');
        console.error('   Original:', `${originalToken.substring(0, 50)}...`);
        console.error('   Decrypted:', `${decryptedToken.substring(0, 50)}...`);
        throw new Error('Token encryption/decryption verification failed');
      }

      console.log('✅ Token decryption verification successful');

      // Parse and display JWT payload for debugging
      const jwtParts = decryptedToken.split('.');
      if (3 === jwtParts.length) {
        console.log('✅ Token is valid JWT format');

        try {
          const payload = JSON.parse(Buffer.from(jwtParts[1], 'base64').toString());
          console.log('🔍 JWT payload:', JSON.stringify(payload, null, 2));
        } catch (parseError) {
          console.log('⚠️  Could not parse JWT payload');
        }
      }

      return decryptedToken;
    } catch (error) {
      console.error('❌ Token decryption verification failed:', error.message);
      throw error;
    }
  }

  /**
   * Update database with encrypted token
   */
  async updateDatabaseToken(encryptedToken) {
    const client = new Client(this.dbConfig);

    try {
      console.log('🔌 Connecting to PostgreSQL database...');
      console.log(`   Host: ${this.dbConfig.host}:${this.dbConfig.port}`);
      console.log(`   Database: ${this.dbConfig.database}`);

      await client.connect();
      console.log('✅ Database connected');

      // Find the Platform Admin organization
      console.log(`🔍 Finding "${this.orgName}" organization...`);
      const orgQuery = `
        SELECT id, name
        FROM organisation
        WHERE name = $1
      `;

      const orgResult = await client.query(orgQuery, [this.orgName]);

      if (0 === orgResult.rows.length) {
        throw new Error(`"${this.orgName}" organization not found in database. Run script 3 first.`);
      }

      const orgId = orgResult.rows[0].id;
      console.log(`📋 Found "${this.orgName}" organization (ID: ${orgId})`);

      // Find the organization's agent
      console.log('🔍 Finding org_agents record...');
      const agentQuery = `
        SELECT id, "agentEndPoint", "apiKey", "agentSpinUpStatus", "walletName"
        FROM org_agents
        WHERE "orgId" = $1
      `;

      const agentResult = await client.query(agentQuery, [orgId]);

      if (0 === agentResult.rows.length) {
        throw new Error(`No agents found for "${this.orgName}" organization. Run script 3 first.`);
      }

      const agent = agentResult.rows[0];
      console.log(`📋 Found agent (ID: ${agent.id})`);
      console.log(`📋 Wallet name: ${agent.walletName}`);
      console.log(`📋 Agent endpoint: ${agent.agentEndPoint}`);
      console.log(`📋 Spin-up status: ${agent.agentSpinUpStatus}`);

      // Update the agent's apiKey
      console.log('🔄 Updating agent apiKey...');
      const updateQuery = `
        UPDATE org_agents
        SET
          "apiKey" = $1,
          "lastChangedDateTime" = NOW()
        WHERE id = $2
        RETURNING id, "agentEndPoint", "walletName"
      `;

      const updateResult = await client.query(updateQuery, [encryptedToken, agent.id]);

      if (0 === updateResult.rows.length) {
        throw new Error('Failed to update agent apiKey');
      }

      console.log('✅ Database updated successfully');
      console.log(`📊 Updated agent ID: ${updateResult.rows[0].id}`);
      console.log(`📊 Wallet name: ${updateResult.rows[0].walletName}`);
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
   * Main update process
   */
  async updateToken(providedToken = null) {
    try {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('  Confirmd Platform - Update Platform Admin API Token');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('');

      // Step 1: Get token (provided or auto-extract)
      let currentToken;
      if (providedToken) {
        console.log('📋 Using provided token');
        currentToken = providedToken;
        console.log('✅ Token provided:', `${currentToken.substring(0, 50)}...`);
      } else {
        console.log('📋 Attempting to auto-extract token from logs...');
        currentToken = this.extractCurrentToken();
      }
      console.log('');

      // Step 2: Encrypt the token
      const encryptedToken = this.encryptToken(currentToken);
      console.log('');

      // Step 3: Verify encryption/decryption works
      this.verifyTokenDecryption(encryptedToken, currentToken);
      console.log('');

      // Step 4: Update database
      const updatedAgent = await this.updateDatabaseToken(encryptedToken);

      console.log('');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('✅ Platform admin API token updated successfully!');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('');
      console.log('📋 Summary:');
      console.log(`   - Agent ID: ${updatedAgent.id}`);
      console.log(`   - Wallet Name: ${updatedAgent.walletName}`);
      console.log(`   - Agent Endpoint: ${updatedAgent.agentEndPoint}`);
      console.log(`   - Token Length: ${currentToken.length} characters`);
      console.log(`   - Encrypted Length: ${encryptedToken.length} characters`);
      console.log('');
      console.log('💡 The agent-service should now authenticate successfully with platform-admin-agent');

      return {
        success: true,
        agentId: updatedAgent.id,
        agentEndPoint: updatedAgent.agentEndPoint,
        walletName: updatedAgent.walletName,
        tokenLength: currentToken.length
      };
    } catch (error) {
      console.error('');
      console.error('═══════════════════════════════════════════════════════════');
      console.error('❌ Token update failed');
      console.error('═══════════════════════════════════════════════════════════');
      console.error('');
      console.error('Error:', error.message);
      console.error('');
      console.error('💡 Troubleshooting:');
      console.error('   1. Ensure platform-admin-agent container is running');
      console.error('   2. Verify CRYPTO_PRIVATE_KEY is set in .env');
      console.error('   3. Check database connection settings');
      console.error('   4. Run scripts 1-3 first if not already done');
      console.error('');

      throw error;
    }
  }
}

// Run the update if this script is executed directly
if (require.main === module) {
  // Get token from command line argument if provided
  const providedToken = process.argv[2];

  const updater = new PlatformAdminTokenUpdater();

  updater
    .updateToken(providedToken)
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      process.exit(1);
    });
}

module.exports = PlatformAdminTokenUpdater;
