# Proof Webhook Troubleshooting Guide

## Overview
This document explains the changes made to improve proof webhook detection and delivery, and provides troubleshooting guidance.

## Problem Statement
An app was sending proof requests but not receiving webhook events, while issuance and connection webhooks worked correctly.

## Root Cause Analysis

### 1. **Weak Proof Webhook Detection Logic**
The original detection logic only checked for:
```typescript
webhookData.proofId || webhookData.proof_id || webhookData.presentation
```

This was insufficient because:
- Proof request webhooks may not have `proofId` in early states
- Different proof protocols use different field names
- State-based detection was missing for proof-specific states

### 2. **Missing TenantId/ContextCorrelationId**
The webhook delivery to org apps required `tenantId` or `contextCorrelationId` in the payload:
```typescript
const tenantId = webhookData.contextCorrelationId || webhookData.tenantId;
```

If neither field was present, delivery was silently skipped with minimal logging.

### 3. **Insufficient Logging**
Limited visibility into:
- Why webhooks were not being classified as proof webhooks
- Whether tenantId extraction was successful
- What fields were present in the webhook payload

## Changes Made

### 1. Enhanced Proof Webhook Detection
**File**: `apps/api-gateway/src/webhook/webhook-receiver.service.ts`

**Location**: Lines 217-243

**Improvements**:
- Check for multiple proof-related field names:
  - `proofId`, `proof_id`
  - `proofExchangeId`, `proof_exchange_id`
  - `presentationExchangeId`, `presentation_exchange_id`
  - `presentation`
- State-based detection for proof-specific states:
  - `request-sent`, `request-received`
  - `presentation-*` states
  - `proposal-*` states
  - `done` with threadId
- Metadata checks for `_anoncreds/presentation` and `presentationExchange`
- **Moved proof detection to run FIRST** before credential/connection checks to avoid misclassification

### 2. Enhanced Logging in Proof Webhook Processing
**File**: `apps/api-gateway/src/webhook/webhook-receiver.service.ts`

**Location**: Lines 141-175

**Added Logs**:
```typescript
- Proof ID (with multiple field fallbacks)
- Connection ID
- Thread ID
- Full payload keys
- TenantId extraction details showing all attempted fields
- Full webhook payload when tenantId is missing
```

### 3. Enhanced Logging in Webhook Delivery Service
**File**: `apps/api-gateway/src/webhook/webhook-delivery.service.ts`

**Location**: Lines 40-118

**Added Logs**:
```typescript
- Webhook data keys
- Webhook state
- OrgId lookup process
- Active apps lookup with details
- List of apps found
- Delivery results summary (successful/failed count)
```

### 4. Improved TenantId Extraction
**File**: `apps/api-gateway/src/webhook/webhook-receiver.service.ts`

**Location**: Line 156

**Changes**:
```typescript
// Added tenant_id as additional fallback
const tenantId = webhookData.contextCorrelationId || webhookData.tenantId || webhookData.tenant_id;
```

## How to Verify the Fix

### Step 1: Check Webhook Reception Logs
When a proof request is sent, check logs for:

```
🎯 === GENERAL WEBHOOK EVENT PROCESSING ===
📋 Webhook Type Detection - Available fields: [list of fields]
📋 Webhook State: [state value]
✅ Detected as PROOF webhook
```

If you see "Detected as PROOF webhook", the detection is working.

### Step 2: Check TenantId Extraction
Look for these log entries:

```
🔍 TenantId extraction: contextCorrelationId=[value], tenantId=[value], tenant_id=[value]
✅ TenantId found: [tenant-id], proceeding with org app delivery
```

If you see the warning:
```
⚠️ No tenantId found in webhook data, skipping org app delivery
```

This means the webhook payload doesn't contain any of the expected tenant identifier fields.

### Step 3: Check Webhook Delivery
Look for:

```
📤 === OUTBOUND WEBHOOK DELIVERY START ===
📋 Type: Proof, TenantId: [tenant-id]
🏢 Found orgId: [org-id]
📱 Found [N] active app(s) for orgId: [org-id]
📱 Apps: [app names and IDs]
✅ Webhook delivery completed: X successful, Y failed
```

### Step 4: Check App Delivery
For each app, look for:

```
📤 Sending webhook to app: [app-name] ([app-id])
🌐 URL: [webhook-url]
✅ Webhook delivered successfully to [app-name]
```

## Common Issues and Solutions

### Issue 1: "No tenantId found in webhook data"

**Cause**: The proof request webhook doesn't contain `contextCorrelationId`, `tenantId`, or `tenant_id`.

**Solution**:
1. Check the full webhook payload in logs (it's now printed when this occurs)
2. Verify how the proof request was initiated - ensure proper tenant context
3. Check if you're using a shared or dedicated agent
4. For shared agents, verify the tenant configuration

**Example log to look for**:
```
⚠️ Full webhook payload for debugging: {
  "id": "...",
  "state": "request-sent",
  "connectionId": "...",
  // Look for any field that could identify the tenant
}
```

### Issue 2: Webhook not detected as proof type

**Cause**: The webhook structure doesn't match any of the detection patterns.

**Solution**:
1. Look at the "Available fields" log to see what's in the payload
2. Check if the state field contains proof-related values
3. If using a custom proof protocol, you may need to add additional detection logic

### Issue 3: "No active apps found for orgId"

**Cause**: The organization doesn't have any registered active apps.

**Solution**:
1. Verify that org apps are registered in the `org_apps` table
2. Check that `isActive = true` for the apps
3. Verify the `orgId` matches between `org_agents` and `org_apps`

### Issue 4: Webhook detected but not delivered

**Cause**: Error during delivery to the app webhook URL.

**Solution**:
1. Check the delivery logs for specific error messages
2. Verify the app's webhook URL is accessible
3. Check the app's webhook secret is valid
4. Verify network connectivity

## Testing Steps

### Test 1: Send a Proof Request
```bash
# Send a proof request through your API
# Then check the webhook logs for the new enhanced logging
grep "PROOF WEBHOOK" logs/webhook/app-*.log
```

### Test 2: Verify TenantId Extraction
```bash
# Check if tenantId is being extracted correctly
grep "TenantId extraction" logs/webhook/app-*.log
```

### Test 3: Verify Delivery to Org Apps
```bash
# Check if delivery is happening
grep "OUTBOUND WEBHOOK DELIVERY" logs/webhook/app-*.log
```

### Test 4: Check App Receipt
```bash
# Verify the app received the webhook
# Check your app's logs for incoming POST requests
```

## Configuration Checklist

- [ ] Organization has an agent configured in `org_agents` table
- [ ] Agent has a valid `tenantId` (for shared agents)
- [ ] Organization has apps registered in `org_apps` table
- [ ] Apps have `isActive = true`
- [ ] Apps have valid `webhookUrl` configured
- [ ] Apps have valid `webhookSecret` (encrypted)
- [ ] Network allows outbound HTTPS from platform to app webhook URL

## Webhook Payload Structure Reference

### Expected Proof Request Webhook Fields

The system now checks for these fields to identify proof webhooks:

**Primary identifiers**:
- `proofId` or `proof_id`
- `proofExchangeId` or `proof_exchange_id`
- `presentationExchangeId` or `presentation_exchange_id`
- `presentation`

**State-based identification**:
- `state` containing: `request-sent`, `request-received`, `presentation-*`, `proposal-*`
- `state = "done"` with `threadId` or `thread_id`

**Metadata-based**:
- `metadata._anoncreds/presentation`
- `metadata.presentationExchange`

**Tenant identification** (in order of precedence):
1. `contextCorrelationId`
2. `tenantId`
3. `tenant_id`

### Sample Proof Request Webhook
```json
{
  "id": "proof-record-id",
  "state": "request-sent",
  "threadId": "thread-123",
  "connectionId": "connection-456",
  "contextCorrelationId": "tenant-789",
  "protocolVersion": "v2",
  "createdAt": "2025-11-05T...",
  "updatedAt": "2025-11-05T..."
}
```

## Next Steps

1. **Monitor Logs**: After deploying these changes, monitor the webhook logs for proof requests
2. **Verify Detection**: Ensure proof webhooks are now being detected correctly
3. **Check Delivery**: Confirm webhooks are being delivered to org apps
4. **App Verification**: Check that apps are receiving and processing the webhooks

## Related Files

- `apps/api-gateway/src/webhook/webhook-receiver.service.ts` - Webhook detection and processing
- `apps/api-gateway/src/webhook/webhook-delivery.service.ts` - Delivery to org apps
- `apps/verification/src/verification.controller.ts` - Verification service webhook handler
- `apps/verification/src/verification.service.ts` - Proof presentation storage

## Support

If issues persist after these changes:

1. Collect the full webhook payload from logs
2. Check the state flow in your test case
3. Verify the proof request was created with proper tenant context
4. Review agent configuration (shared vs dedicated)
5. Verify org apps are properly registered and active
