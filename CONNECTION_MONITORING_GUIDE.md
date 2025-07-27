# Connection URL Monitoring Setup

## Overview

This document provides comprehensive monitoring tools to track the `connectionInvitation` URL returned by the `POST /orgs/{orgId}/connections` endpoint when a wallet is refreshed at the frontend.

## 🔍 Monitoring Tools Created

### 1. Bash Monitoring Script (`monitor-connection-test.sh`)

**Purpose**: Command-line tool for testing and monitoring connection URL creation
**Location**: `/Users/itopa/projects/confirmd-platform/monitor-connection-test.sh`

#### Usage:

```bash
# Single test
./monitor-connection-test.sh [ORG_ID] test

# Continuous monitoring (default 30s interval)
./monitor-connection-test.sh [ORG_ID] monitor [SECONDS]

# Monitor Docker logs only
./monitor-connection-test.sh [ORG_ID] logs

# Tail log file
./monitor-connection-test.sh [ORG_ID] tail
```

#### Examples:

```bash
./monitor-connection-test.sh abc123 test
./monitor-connection-test.sh abc123 monitor 15
./monitor-connection-test.sh abc123 logs
```

#### Environment Variables:

- `AUTH_TOKEN`: Bearer token for API authentication

### 2. Node.js Connection Monitor (`monitor-connection-url.js`)

**Purpose**: Advanced monitoring with Docker logs integration and periodic testing
**Location**: `/Users/itopa/projects/confirmd-platform/monitor-connection-url.js`

#### Usage:

```bash
# Start monitoring
node monitor-connection-url.js start <orgId> [interval]

# Single test
node monitor-connection-url.js test <orgId>

# Tail logs
node monitor-connection-url.js tail
```

#### Examples:

```bash
node monitor-connection-url.js start abc123 30000
node monitor-connection-url.js test abc123
```

### 3. API Proxy Monitor (`api-connection-monitor.js`)

**Purpose**: Real-time HTTP proxy to intercept and log API requests/responses
**Location**: `/Users/itopa/projects/confirmd-platform/api-connection-monitor.js`

#### Setup:

```bash
# Install dependencies
npm install http-proxy-middleware

# Start monitoring proxy
node api-connection-monitor.js start
```

#### Configuration:

- Proxy runs on port `5001`
- Forwards requests to `http://localhost:5000`
- Intercepts all POST `/orgs/*/connections` requests
- Logs full request/response details

#### Frontend Integration:

Change your frontend API base URL from `http://localhost:5000` to `http://localhost:5001` to route through the monitor.

## 🔧 Application Monitoring Enhancements

### Enhanced Logging in Connection Service

Added comprehensive logging in `apps/connection/src/connection.service.ts`:

```typescript
// 🔍 MONITOR LOG: Connection invitation URLs
this.logger.log(`🎯 [CONNECTION MONITOR] Creating connection invitation for orgId: ${orgId}`);
this.logger.log(`🔗 [CONNECTION MONITOR] Original invitation URL: ${connectionInvitationUrl}`);
this.logger.log(`📱 [CONNECTION MONITOR] Resolved invitation URL: ${resolvedInvitationUrl}`);
this.logger.log(`🔗 [CONNECTION MONITOR] Shortened URL: ${shortenedUrl}`);
this.logger.log(`📋 [CONNECTION MONITOR] Invitation DID: ${invitationsDid}`);

// Final response logging
this.logger.log(`🚀 [CONNECTION MONITOR] Final response payload:`);
this.logger.log(`🎯 [CONNECTION MONITOR] connectionInvitation field: ${connectionStorePayload.connectionInvitation}`);
this.logger.log(`🔗 [CONNECTION MONITOR] shortenedUrl field: ${connectionStorePayload.shortenedUrl}`);
this.logger.log(`📊 [CONNECTION MONITOR] Response payload: ${JSON.stringify(connectionStorePayload, null, 2)}`);
```

### Enhanced Logging in API Gateway

Added comprehensive logging in `apps/api-gateway/src/connection/connection.controller.ts`:

```typescript
// 🔍 MONITOR LOG: API Gateway request
this.logger.log(`🎯 [API MONITOR] POST /orgs/${orgId}/connections - Starting request`);
this.logger.log(`📦 [API MONITOR] Request payload: ${JSON.stringify(createOutOfBandConnectionInvitation, null, 2)}`);
this.logger.log(`👤 [API MONITOR] User: ${reqUser.email}`);

// Service response logging
this.logger.log(`🚀 [API MONITOR] Service response received`);
this.logger.log(`📊 [API MONITOR] Full response: ${JSON.stringify(connectionData, null, 2)}`);

// Final API response logging
this.logger.log(`📤 [API MONITOR] Final response being sent: ${JSON.stringify(finalResponse, null, 2)}`);
```

## 📊 Monitoring Dashboard

### Docker Logs Monitoring

Monitor specific services in real-time:

```bash
# Connection service logs
docker-compose logs -f connection | grep -E "(CONNECTION MONITOR|API MONITOR)"

# API Gateway logs
docker-compose logs -f api-gateway | grep -E "(CONNECTION MONITOR|API MONITOR)"

# All relevant logs
docker-compose logs -f connection api-gateway | grep -E "(CONNECTION MONITOR|API MONITOR|connectionInvitation)"
```

### Log File Locations

Each monitoring tool creates its own log files:

- Bash script: `connection-test-YYYYMMDD_HHMMSS.log`
- Node.js monitor: `connection-url-monitor.log`
- API proxy: `api-connection-monitor.log`

## 🎯 What the Monitoring Tracks

### URL Analysis

The monitoring tools analyze each `connectionInvitation` URL for:

1. **Domain Validation**: Checks for `platform-admin.confamd.com`
2. **OOB Format**: Validates presence of `?oob=` parameter
3. **URL Length**: Reports character count
4. **URL Format**: Validates HTTP/HTTPS format
5. **Parameter Extraction**: Shows preview of OOB parameter

### Response Structure

Monitors the complete response structure:

```json
{
  "statusCode": 201,
  "message": "Connection invitation created successfully",
  "data": {
    "id": "uuid",
    "orgId": "org-uuid",
    "agentId": "agent-uuid",
    "connectionInvitation": "https://platform-admin.confamd.com?oob=...", // Actual DIDComm URL
    "shortenedUrl": "http://localhost:5000/invitation/reference-id", // Shortened URL
    "multiUse": true,
    "createDateTime": "timestamp",
    "recordId": "record-uuid"
  }
}
```

## 🚀 Quick Start Guide

### Option 1: Simple Bash Testing

```bash
# Make executable
chmod +x monitor-connection-test.sh

# Set auth token
export AUTH_TOKEN="your-bearer-token"

# Run single test
./monitor-connection-test.sh your-org-id test
```

### Option 2: Continuous Node.js Monitoring

```bash
# Start monitoring
node monitor-connection-url.js start your-org-id 30000

# In another terminal, tail logs
node monitor-connection-url.js tail
```

### Option 3: Real-time API Proxy

```bash
# Start proxy
node api-connection-monitor.js start

# Configure frontend to use http://localhost:5001
# Perform wallet refresh in frontend
# Watch logs for captured requests
```

## 🔍 Expected Results

When monitoring is active and a wallet refresh triggers a connection invitation:

1. **API Gateway logs** show the incoming request and outgoing response
2. **Connection Service logs** show URL transformation details
3. **Monitor tools** capture and analyze the URLs
4. **Response should contain**:
   - `connectionInvitation`: Actual DIDComm URL with `platform-admin.confamd.com`
   - `shortenedUrl`: Minio shortening URL for backwards compatibility

## 🛠️ Troubleshooting

### If URLs are still shortened:

1. Check Docker logs for "[CONNECTION MONITOR]" entries
2. Verify database has `resolvedInvitationUrl` column
3. Confirm services restarted after code changes

### If monitoring tools fail:

1. Verify API endpoint is accessible: `curl http://localhost:5000/health`
2. Check auth token is valid
3. Ensure orgId exists in the system

### If logs are missing:

1. Confirm services restarted: `docker-compose restart connection api-gateway`
2. Check log levels in service configuration
3. Verify write permissions for log files

## 📋 Next Steps

1. **Start monitoring** using your preferred tool
2. **Trigger wallet refresh** in the frontend
3. **Observe the logs** for connection invitation URLs
4. **Verify URLs** contain the actual DIDComm invitation with proper domain
5. **Report findings** based on the captured data

The monitoring setup is now comprehensive and will provide detailed insights into the connection invitation URL resolution process.
