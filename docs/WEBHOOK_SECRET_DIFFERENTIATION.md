# Webhook Secret Differentiation Guide

## Overview
Each org app now has unique identification in webhook deliveries, allowing apps to differentiate between multiple webhook sources and contexts.

## Problem Statement
When an app receives webhooks from multiple organizations or contexts, it needs a way to:
1. Verify the webhook is authentic (using the secret)
2. Identify which organization/app the webhook is for
3. Route the webhook to the correct handler
4. Associate the webhook with the correct database context

## Solution: Multi-Level Identification

Every webhook now includes **three levels of identification**:

### 1. HTTP Headers
```http
POST /webhook HTTP/1.1
Content-Type: application/json
x-api-key: decrypted-webhook-secret-for-this-app
x-app-id: 123e4567-e89b-12d3-a456-426614174000
x-org-id: 789e0123-e89b-12d3-a456-426614174999
```

### 2. Payload Metadata
```json
{
  "type": "Proof",
  "timestamp": "2025-11-05T12:34:56.789Z",
  "orgId": "789e0123-e89b-12d3-a456-426614174999",
  "tenantId": "tenant-abc-123",
  "appId": "123e4567-e89b-12d3-a456-426614174000",
  "appName": "Mobile Wallet App",
  "data": {
    "id": "proof-record-id",
    "state": "presentation-received",
    ...
  },
  "clientContext": {
    "customField": "customValue"
  }
}
```

### 3. Unique Webhook Secret per App
Each app has its own encrypted webhook secret stored in the database:
```sql
SELECT id, name, webhook_secret FROM org_apps;
```

## Use Cases

### Use Case 1: Multi-Tenant SaaS App

**Scenario**: A SaaS provider hosts multiple organizations on the same app instance.

**Setup**:
```
Organization A → App Instance (app.saas.com/webhook)
  - webhookSecret: "secret-org-a-xyz"
  - appId: "app-a-uuid"

Organization B → App Instance (app.saas.com/webhook)
  - webhookSecret: "secret-org-b-abc"
  - appId: "app-b-uuid"
```

**App Implementation**:
```javascript
app.post('/webhook', (req, res) => {
  const apiKey = req.headers['x-api-key'];
  const orgId = req.headers['x-org-id'];
  const appId = req.headers['x-app-id'];

  // Validate secret matches the expected secret for this org
  const expectedSecret = getSecretForOrg(orgId);
  if (apiKey !== expectedSecret) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  // Route to correct tenant database
  const db = getDatabaseForOrg(orgId);

  // Process webhook in correct context
  await db.webhooks.create({
    appId: appId,
    orgId: orgId,
    type: req.body.type,
    data: req.body.data
  });

  res.status(200).json({ success: true });
});
```

### Use Case 2: Single App, Multiple Integrations

**Scenario**: One organization has multiple apps for different purposes.

**Setup**:
```
Organization: ACME Corp
  App 1: Mobile Wallet
    - webhookSecret: "secret-mobile-abc"
    - appId: "mobile-app-uuid"
    - webhookUrl: https://acme.com/webhook/mobile

  App 2: Admin Dashboard
    - webhookSecret: "secret-admin-xyz"
    - appId: "admin-app-uuid"
    - webhookUrl: https://acme.com/webhook/admin

  App 3: Analytics Service
    - webhookSecret: "secret-analytics-123"
    - appId: "analytics-app-uuid"
    - webhookUrl: https://analytics.acme.com/webhook
```

**Benefit**: Each app can validate its specific secret and process webhooks differently.

### Use Case 3: Webhook Forwarding Service

**Scenario**: An intermediary service receives webhooks and forwards to multiple downstream services.

**App Implementation**:
```javascript
app.post('/webhook', async (req, res) => {
  const appId = req.body.appId;
  const orgId = req.body.orgId;

  // Acknowledge receipt immediately
  res.status(200).json({ received: true });

  // Route based on app configuration
  const routingConfig = await getRoutingConfig(appId, orgId);

  // Forward to appropriate downstream services
  for (const target of routingConfig.targets) {
    await forwardWebhook(target.url, req.body, target.secret);
  }
});
```

## Implementation Details

### Webhook Payload Structure

```typescript
interface WebhookPayload {
  // Event type
  type: 'Connection' | 'Proof' | 'Credential';

  // Timestamp of webhook creation
  timestamp: string; // ISO 8601 format

  // Organization identifier
  orgId: string; // UUID

  // Tenant identifier (for multi-tenant agents)
  tenantId: string;

  // App identifier (NEW)
  appId: string; // UUID - unique per org_apps record

  // App name for human readability (NEW)
  appName: string;

  // The actual event data
  data: {
    id: string;
    state: string;
    connectionId?: string;
    threadId?: string;
    // ... other event-specific fields
  };

  // Custom context from app configuration
  clientContext: {
    // Any custom fields you configured
  };
}
```

### HTTP Headers

```http
Content-Type: application/json
x-api-key: <decrypted-webhook-secret>
x-app-id: <app-uuid>
x-org-id: <org-uuid>
```

**Header Descriptions**:
- `x-api-key`: The decrypted webhook secret for authentication
- `x-app-id`: The unique identifier for the app registration
- `x-org-id`: The organization identifier

## Security Best Practices

### 1. Validate the Webhook Secret
```javascript
function validateWebhook(req) {
  const receivedSecret = req.headers['x-api-key'];
  const appId = req.headers['x-app-id'];

  // Lookup expected secret for this app
  const expectedSecret = process.env[`WEBHOOK_SECRET_${appId}`];

  if (receivedSecret !== expectedSecret) {
    throw new Error('Invalid webhook secret');
  }
}
```

### 2. Store Secrets Securely
```javascript
// ❌ DON'T: Store in code
const secret = "my-webhook-secret-123";

// ✅ DO: Store in environment variables or secret manager
const secret = process.env.WEBHOOK_SECRET;

// ✅ BETTER: Store in AWS Secrets Manager / HashiCorp Vault
const secret = await secretsManager.getSecret('webhook-secret-app-123');
```

### 3. Use HTTPS Only
```javascript
// ❌ DON'T: Accept webhooks over HTTP
// webhookUrl: "http://app.com/webhook"

// ✅ DO: Require HTTPS
// webhookUrl: "https://app.com/webhook"

// Validate in your app
if (req.protocol !== 'https') {
  return res.status(403).json({ error: 'HTTPS required' });
}
```

### 4. Implement Rate Limiting
```javascript
const rateLimit = require('express-rate-limit');

const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: 'Too many webhook requests'
});

app.post('/webhook', webhookLimiter, handleWebhook);
```

### 5. Validate Payload Structure
```javascript
function validatePayload(body) {
  const schema = Joi.object({
    type: Joi.string().valid('Connection', 'Proof', 'Credential').required(),
    timestamp: Joi.string().isoDate().required(),
    orgId: Joi.string().uuid().required(),
    tenantId: Joi.string().required(),
    appId: Joi.string().uuid().required(),
    appName: Joi.string().required(),
    data: Joi.object().required(),
    clientContext: Joi.object()
  });

  return schema.validate(body);
}
```

## Example Implementations

### Express.js (Node.js)
```javascript
const express = require('express');
const app = express();

app.use(express.json());

// Webhook endpoint
app.post('/webhook', async (req, res) => {
  try {
    // 1. Validate webhook secret
    const apiKey = req.headers['x-api-key'];
    const appId = req.headers['x-app-id'];
    const orgId = req.headers['x-org-id'];

    if (!validateSecret(apiKey, appId)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 2. Acknowledge receipt immediately
    res.status(200).json({ received: true, appId, orgId });

    // 3. Process webhook asynchronously
    setImmediate(async () => {
      try {
        await processWebhook({
          appId,
          orgId,
          type: req.body.type,
          data: req.body.data,
          clientContext: req.body.clientContext
        });
      } catch (error) {
        console.error('Webhook processing error:', error);
      }
    });

  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function validateSecret(receivedSecret, appId) {
  const expectedSecret = process.env[`WEBHOOK_SECRET_${appId}`];
  return receivedSecret === expectedSecret;
}

async function processWebhook({ appId, orgId, type, data, clientContext }) {
  console.log(`Processing ${type} webhook for org ${orgId}, app ${appId}`);

  // Get database connection for this org
  const db = await getOrgDatabase(orgId);

  // Process based on webhook type
  switch (type) {
    case 'Proof':
      await handleProofWebhook(db, data);
      break;
    case 'Credential':
      await handleCredentialWebhook(db, data);
      break;
    case 'Connection':
      await handleConnectionWebhook(db, data);
      break;
  }
}

app.listen(3000, () => {
  console.log('Webhook server running on port 3000');
});
```

### Python (Flask)
```python
from flask import Flask, request, jsonify
import os
import threading

app = Flask(__name__)

@app.route('/webhook', methods=['POST'])
def webhook():
    try:
        # 1. Extract headers
        api_key = request.headers.get('x-api-key')
        app_id = request.headers.get('x-app-id')
        org_id = request.headers.get('x-org-id')

        # 2. Validate secret
        if not validate_secret(api_key, app_id):
            return jsonify({'error': 'Unauthorized'}), 401

        # 3. Acknowledge immediately
        response = jsonify({'received': True, 'appId': app_id, 'orgId': org_id})

        # 4. Process webhook asynchronously
        data = request.json
        threading.Thread(
            target=process_webhook,
            args=(app_id, org_id, data)
        ).start()

        return response, 200

    except Exception as e:
        print(f"Webhook error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

def validate_secret(received_secret, app_id):
    expected_secret = os.getenv(f'WEBHOOK_SECRET_{app_id}')
    return received_secret == expected_secret

def process_webhook(app_id, org_id, data):
    print(f"Processing {data['type']} webhook for org {org_id}, app {app_id}")

    # Get database connection for this org
    db = get_org_database(org_id)

    # Process based on type
    if data['type'] == 'Proof':
        handle_proof_webhook(db, data['data'])
    elif data['type'] == 'Credential':
        handle_credential_webhook(db, data['data'])
    elif data['type'] == 'Connection':
        handle_connection_webhook(db, data['data'])

if __name__ == '__main__':
    app.run(port=3000)
```

### Go
```go
package main

import (
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "os"
)

type WebhookPayload struct {
    Type          string                 `json:"type"`
    Timestamp     string                 `json:"timestamp"`
    OrgID         string                 `json:"orgId"`
    TenantID      string                 `json:"tenantId"`
    AppID         string                 `json:"appId"`
    AppName       string                 `json:"appName"`
    Data          map[string]interface{} `json:"data"`
    ClientContext map[string]interface{} `json:"clientContext"`
}

func webhookHandler(w http.ResponseWriter, r *http.Request) {
    // 1. Extract headers
    apiKey := r.Header.Get("x-api-key")
    appID := r.Header.Get("x-app-id")
    orgID := r.Header.Get("x-org-id")

    // 2. Validate secret
    if !validateSecret(apiKey, appID) {
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
    }

    // 3. Parse payload
    var payload WebhookPayload
    if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
        http.Error(w, "Invalid JSON", http.StatusBadRequest)
        return
    }

    // 4. Acknowledge immediately
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]interface{}{
        "received": true,
        "appId":    appID,
        "orgId":    orgID,
    })

    // 5. Process asynchronously
    go processWebhook(appID, orgID, payload)
}

func validateSecret(receivedSecret, appID string) bool {
    expectedSecret := os.Getenv(fmt.Sprintf("WEBHOOK_SECRET_%s", appID))
    return receivedSecret == expectedSecret
}

func processWebhook(appID, orgID string, payload WebhookPayload) {
    log.Printf("Processing %s webhook for org %s, app %s", payload.Type, orgID, appID)

    // Process based on type
    switch payload.Type {
    case "Proof":
        handleProofWebhook(orgID, payload.Data)
    case "Credential":
        handleCredentialWebhook(orgID, payload.Data)
    case "Connection":
        handleConnectionWebhook(orgID, payload.Data)
    }
}

func main() {
    http.HandleFunc("/webhook", webhookHandler)
    log.Println("Webhook server running on port 3000")
    log.Fatal(http.ListenAndServe(":3000", nil))
}
```

## Database Schema

The `org_apps` table stores each app's configuration:

```sql
CREATE TABLE org_apps (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL,
  name VARCHAR(500) NOT NULL,
  webhook_url VARCHAR NOT NULL,
  webhook_secret VARCHAR NOT NULL, -- Encrypted
  is_active BOOLEAN DEFAULT true,
  client_context JSONB,
  -- ... other fields
);
```

**Each record gets a unique `webhook_secret`** which is encrypted before storage.

## Testing Your Webhook Implementation

### Manual Test with curl
```bash
# Test with your actual app ID and secret
curl -X POST https://your-app.com/webhook \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-webhook-secret" \
  -H "x-app-id: 123e4567-e89b-12d3-a456-426614174000" \
  -H "x-org-id: 789e0123-e89b-12d3-a456-426614174999" \
  -d '{
    "type": "Proof",
    "timestamp": "2025-11-05T12:34:56.789Z",
    "orgId": "789e0123-e89b-12d3-a456-426614174999",
    "tenantId": "tenant-123",
    "appId": "123e4567-e89b-12d3-a456-426614174000",
    "appName": "Test App",
    "data": {
      "id": "proof-123",
      "state": "presentation-received"
    },
    "clientContext": {}
  }'
```

### Expected Response
```json
{
  "received": true,
  "appId": "123e4567-e89b-12d3-a456-426614174000",
  "orgId": "789e0123-e89b-12d3-a456-426614174999"
}
```

## Migration Guide

### For Existing Apps

If you have existing apps that are already receiving webhooks:

**Before** (old format):
```json
{
  "type": "Proof",
  "timestamp": "...",
  "orgId": "...",
  "tenantId": "...",
  "data": { ... }
}
```

**After** (new format - backward compatible):
```json
{
  "type": "Proof",
  "timestamp": "...",
  "orgId": "...",
  "tenantId": "...",
  "appId": "123e4567-...",    // NEW
  "appName": "My App",        // NEW
  "data": { ... },
  "clientContext": { ... }
}
```

**Your app should**:
1. Start accepting the new `appId` and `appName` fields
2. Use `x-app-id` and `x-org-id` headers if available
3. Continue working if these fields are missing (graceful degradation)

## Summary

### What Changed
✅ Added `appId` to webhook payload
✅ Added `appName` to webhook payload
✅ Added `x-app-id` to HTTP headers
✅ Added `x-org-id` to HTTP headers
✅ Each app still has unique `webhook_secret`

### Benefits
✅ Apps can identify the source of webhooks
✅ Multi-tenant apps can route to correct database
✅ Better security through app-specific secrets
✅ Easier debugging and troubleshooting
✅ Support for complex routing scenarios

### Backward Compatible
✅ Existing apps continue to work
✅ New fields are additive
✅ Apps can adopt new fields gradually

## Related Documentation
- [WEBHOOK_FAILURE_HANDLING.md](./WEBHOOK_FAILURE_HANDLING.md)
- [WEBHOOK_SELECTIVE_ROUTING_PROPOSAL.md](./WEBHOOK_SELECTIVE_ROUTING_PROPOSAL.md)
- [PROOF_WEBHOOK_TROUBLESHOOTING.md](./PROOF_WEBHOOK_TROUBLESHOOTING.md)
