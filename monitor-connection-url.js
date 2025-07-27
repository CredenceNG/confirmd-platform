#!/usr/bin/env node

/**
 * Connection URL Monitor
 *
 * This script monitors the POST /orgs/{orgId}/connections endpoint
 * to track the connectionInvitation URL returned when a wallet is refreshed
 */

const fs = require('fs');
const path = require('path');

class ConnectionURLMonitor {
  constructor() {
    this.logFile = path.join(__dirname, 'connection-url-monitor.log');
    this.isMonitoring = false;
    this.intervalId = null;

    // Initialize log file
    this.log('🔍 Connection URL Monitor initialized');
    this.log(`📁 Log file: ${this.logFile}`);
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;

    // Write to console
    console.log(logMessage);

    // Write to log file
    fs.appendFileSync(this.logFile, logMessage + '\n');
  }

  async makeConnectionRequest(orgId, payload = {}) {
    const endpoint = `http://localhost:5000/orgs/${orgId}/connections`;

    // Default payload for connection invitation
    const defaultPayload = {
      label: 'Monitor Test Connection',
      alias: 'monitor-test',
      multiUseInvitation: true,
      autoAcceptConnection: true,
      ...payload
    };

    try {
      const fetch = (await import('node-fetch')).default;

      this.log(`🚀 Making POST request to ${endpoint}`);
      this.log(`📦 Payload: ${JSON.stringify(defaultPayload, null, 2)}`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.AUTH_TOKEN || 'your-auth-token'}`
        },
        body: JSON.stringify(defaultPayload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      this.log('✅ Response received:');
      this.log(`📊 Status: ${response.status}`);
      this.log(`🔗 Connection Data: ${JSON.stringify(data, null, 2)}`);

      // Extract and highlight the connectionInvitation URL
      if (data.data && data.data.connectionInvitation) {
        this.log('🎯 CONNECTION INVITATION URL DETECTED:');
        this.log(`📱 URL: ${data.data.connectionInvitation}`);
        this.log(`🔗 Shortened URL: ${data.data.shortenedUrl || 'N/A'}`);

        // Check if it's a proper DIDComm URL
        if (data.data.connectionInvitation.includes('platform-admin.confamd.com')) {
          this.log('✅ URL contains expected domain: platform-admin.confamd.com');
        } else {
          this.log('⚠️  URL does not contain expected domain');
        }

        // Check URL format
        if (data.data.connectionInvitation.includes('?oob=')) {
          this.log('✅ URL has proper OOB (Out-of-Band) format');
        } else {
          this.log('⚠️  URL does not have OOB format');
        }
      } else {
        this.log('❌ No connectionInvitation URL found in response');
      }

      return data;
    } catch (error) {
      this.log(`❌ Error making request: ${error.message}`);
      throw error;
    }
  }

  async monitorDockerLogs() {
    this.log('📋 Starting Docker logs monitoring...');

    try {
      const { spawn } = require('child_process');

      // Monitor connection service logs
      const connectionLogs = spawn('docker-compose', ['logs', '-f', 'connection'], {
        cwd: process.cwd()
      });

      connectionLogs.stdout.on('data', (data) => {
        const logLine = data.toString();
        if (
          logLine.includes('connectionInvitation') ||
          logLine.includes('createConnectionInvitation') ||
          logLine.includes('resolvedInvitationUrl')
        ) {
          this.log(`🐳 CONNECTION SERVICE: ${logLine.trim()}`);
        }
      });

      // Monitor api-gateway logs
      const gatewayLogs = spawn('docker-compose', ['logs', '-f', 'api-gateway'], {
        cwd: process.cwd()
      });

      gatewayLogs.stdout.on('data', (data) => {
        const logLine = data.toString();
        if (logLine.includes('/connections') || logLine.includes('createConnectionInvitation')) {
          this.log(`🌐 API-GATEWAY: ${logLine.trim()}`);
        }
      });

      this.log('📋 Docker logs monitoring started');
    } catch (error) {
      this.log(`❌ Error starting Docker logs monitoring: ${error.message}`);
    }
  }

  async startMonitoring(orgId, interval = 30000) {
    if (this.isMonitoring) {
      this.log('⚠️  Monitor is already running');
      return;
    }

    this.isMonitoring = true;
    this.log(`🟢 Starting connection URL monitoring for orgId: ${orgId}`);
    this.log(`⏱️  Interval: ${interval}ms`);

    // Start Docker logs monitoring
    await this.monitorDockerLogs();

    // Start periodic connection testing
    this.intervalId = setInterval(async () => {
      try {
        this.log('🔄 Performing periodic connection test...');
        await this.makeConnectionRequest(orgId);
      } catch (error) {
        this.log(`❌ Periodic test failed: ${error.message}`);
      }
    }, interval);

    this.log('✅ Monitoring started successfully');
  }

  stopMonitoring() {
    if (!this.isMonitoring) {
      this.log('⚠️  Monitor is not running');
      return;
    }

    this.isMonitoring = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.log('🔴 Monitoring stopped');
  }

  async testSingleRequest(orgId, payload = {}) {
    this.log('🧪 Running single connection test...');
    try {
      const result = await this.makeConnectionRequest(orgId, payload);
      this.log('✅ Single test completed successfully');
      return result;
    } catch (error) {
      this.log(`❌ Single test failed: ${error.message}`);
      throw error;
    }
  }

  getLogFilePath() {
    return this.logFile;
  }

  tailLogs() {
    this.log('📖 Tailing monitor logs...');
    const { spawn } = require('child_process');
    const tail = spawn('tail', ['-f', this.logFile]);

    tail.stdout.on('data', (data) => {
      process.stdout.write(data);
    });

    return tail;
  }
}

// CLI Interface
if (require.main === module) {
  const monitor = new ConnectionURLMonitor();
  const args = process.argv.slice(2);
  const command = args[0];
  const orgId = args[1] || 'test-org-id';

  switch (command) {
    case 'start':
      const interval = parseInt(args[2]) || 30000;
      monitor.startMonitoring(orgId, interval);

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log('\n🛑 Received SIGINT, stopping monitor...');
        monitor.stopMonitoring();
        process.exit(0);
      });
      break;

    case 'test':
      monitor
        .testSingleRequest(orgId)
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
      break;

    case 'tail':
      monitor.tailLogs();
      break;

    default:
      console.log(`
🔍 Connection URL Monitor Usage:

Commands:
  start <orgId> [interval]  - Start monitoring (default interval: 30s)
  test <orgId>             - Run single test
  tail                     - Tail monitor logs

Examples:
  node monitor-connection-url.js start abc123 15000
  node monitor-connection-url.js test abc123
  node monitor-connection-url.js tail

Environment Variables:
  AUTH_TOKEN - Bearer token for API authentication
      `);
      break;
  }
}

module.exports = ConnectionURLMonitor;
