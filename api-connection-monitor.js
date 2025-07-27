#!/usr/bin/env node

/**
 * Real-time API Monitor for Connection Invitations
 * 
 * This script creates a proxy to monitor POST /orgs/*/connections requests
 * and log the connectionInvitation URLs returned
 */

const http = require('http');
const httpProxy = require('http-proxy-middleware');
const fs = require('fs');
const path = require('path');

class APIConnectionMonitor {
  constructor() {
    this.logFile = path.join(__dirname, 'api-connection-monitor.log');
    this.server = null;
    this.port = 5001; // Proxy port
    
    this.log('🔍 API Connection Monitor initialized');
    this.log(`📁 Log file: ${this.logFile}`);
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    
    console.log(logMessage);
    fs.appendFileSync(this.logFile, logMessage + '\n');
  }

  createProxy() {
    const self = this;
    
    return httpProxy.createProxyMiddleware({
      target: 'http://localhost:5000', // Target the actual API Gateway
      changeOrigin: true,
      logLevel: 'silent',
      
      // Intercept requests
      onProxyReq: (proxyReq, req, res) => {
        const url = req.url;
        const method = req.method;
        
        // Monitor connection creation requests
        if (method === 'POST' && url.includes('/connections')) {
          self.log(`📥 INTERCEPTED REQUEST: ${method} ${url}`);
          self.log(`🔗 Headers: ${JSON.stringify(req.headers, null, 2)}`);
          
          // Capture request body if available
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          
          req.on('end', () => {
            if (body) {
              self.log(`📦 Request Body: ${body}`);
            }
          });
        }
      },
      
      // Intercept responses
      onProxyRes: (proxyRes, req, res) => {
        const url = req.url;
        const method = req.method;
        
        // Monitor connection creation responses
        if (method === 'POST' && url.includes('/connections')) {
          self.log(`📤 INTERCEPTED RESPONSE: ${method} ${url}`);
          self.log(`📊 Status: ${proxyRes.statusCode}`);
          self.log(`🔗 Response Headers: ${JSON.stringify(proxyRes.headers, null, 2)}`);
          
          // Capture response body
          let body = '';
          const originalWrite = res.write;
          const originalEnd = res.end;
          
          res.write = function(chunk) {
            if (chunk) {
              body += chunk.toString();
            }
            return originalWrite.apply(res, arguments);
          };
          
          res.end = function(chunk) {
            if (chunk) {
              body += chunk.toString();
            }
            
            // Parse and log connection invitation details
            try {
              const responseData = JSON.parse(body);
              self.log('🎯 RESPONSE DATA CAPTURED:');
              self.log(`📱 Full Response: ${JSON.stringify(responseData, null, 2)}`);
              
              if (responseData.data && responseData.data.connectionInvitation) {
                self.log('🚀 CONNECTION INVITATION URL DETECTED:');
                self.log(`📱 connectionInvitation: ${responseData.data.connectionInvitation}`);
                self.log(`🔗 shortenedUrl: ${responseData.data.shortenedUrl || 'N/A'}`);
                
                // Analyze URL
                const url = responseData.data.connectionInvitation;
                if (url.includes('platform-admin.confamd.com')) {
                  self.log('✅ URL contains expected domain');
                } else {
                  self.log('⚠️  URL domain unexpected');
                }
                
                if (url.includes('?oob=')) {
                  self.log('✅ URL has proper OOB format');
                } else {
                  self.log('⚠️  URL missing OOB parameter');
                }
                
                // Extract OOB parameter for analysis
                const oobMatch = url.match(/\?oob=([^&]+)/);
                if (oobMatch) {
                  self.log(`🔐 OOB Parameter: ${oobMatch[1].substring(0, 50)}...`);
                }
                
                self.log('═'.repeat(80));
              }
            } catch (error) {
              self.log(`❌ Error parsing response: ${error.message}`);
            }
            
            return originalEnd.apply(res, arguments);
          };
        }
      },
      
      onError: (err, req, res) => {
        self.log(`❌ Proxy Error: ${err.message}`);
      }
    });
  }

  async startMonitoring() {
    try {
      const proxy = this.createProxy();
      
      this.server = http.createServer((req, res) => {
        // Add CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
        }
        
        proxy(req, res);
      });
      
      this.server.listen(this.port, () => {
        this.log(`🟢 API Monitor Proxy started on port ${this.port}`);
        this.log(`🔄 Proxying requests to http://localhost:5000`);
        this.log(`📋 To monitor, direct your frontend to: http://localhost:${this.port}`);
        this.log('🎯 Watching for POST /orgs/*/connections requests...');
      });
      
    } catch (error) {
      this.log(`❌ Error starting monitor: ${error.message}`);
      throw error;
    }
  }

  stopMonitoring() {
    if (this.server) {
      this.server.close(() => {
        this.log('🔴 API Monitor stopped');
      });
    }
  }

  tailLogs() {
    this.log('📖 Tailing API monitor logs...');
    const { spawn } = require('child_process');
    const tail = spawn('tail', ['-f', this.logFile]);
    
    tail.stdout.on('data', (data) => {
      process.stdout.write(data);
    });

    return tail;
  }
}

// Install required dependencies if not available
async function ensureDependencies() {
  try {
    require('http-proxy-middleware');
  } catch (error) {
    console.log('📦 Installing http-proxy-middleware...');
    const { spawn } = require('child_process');
    const npm = spawn('npm', ['install', 'http-proxy-middleware'], { stdio: 'inherit' });
    
    return new Promise((resolve, reject) => {
      npm.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Dependencies installed');
          resolve();
        } else {
          reject(new Error('Failed to install dependencies'));
        }
      });
    });
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'start';

  switch (command) {
    case 'start':
      ensureDependencies().then(() => {
        const monitor = new APIConnectionMonitor();
        monitor.startMonitoring();
        
        // Handle graceful shutdown
        process.on('SIGINT', () => {
          console.log('\n🛑 Received SIGINT, stopping monitor...');
          monitor.stopMonitoring();
          process.exit(0);
        });
      }).catch((error) => {
        console.error('❌ Failed to start monitor:', error.message);
        process.exit(1);
      });
      break;

    case 'tail':
      const monitor = new APIConnectionMonitor();
      monitor.tailLogs();
      break;

    default:
      console.log(`
🔍 API Connection Monitor Usage:

Commands:
  start    - Start the API monitoring proxy
  tail     - Tail the monitor logs

Examples:
  node api-connection-monitor.js start
  node api-connection-monitor.js tail

Instructions:
  1. Start the monitor: node api-connection-monitor.js start
  2. Configure your frontend to use: http://localhost:5001 instead of http://localhost:5000
  3. Refresh your wallet in the frontend
  4. Watch the logs for connection invitation URLs
      `);
      break;
  }
}

module.exports = APIConnectionMonitor;
