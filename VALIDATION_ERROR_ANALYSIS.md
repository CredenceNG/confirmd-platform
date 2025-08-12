# Multi-Tenancy Create Invitation Validation Error Analysis

## Error Details

```
Caught Validation Error for /multi-tenancy/create-invitation/ed8113d3-e16d-4dad-92f1-a7c660de8133:
{
  config: {
    message: 'Could not match intersection against any of the possible combinations: [["alias","label","imageUrl","multiUseInvitation","autoAcceptConnection","goalCode","goal","handshake","handshakeProtocols","messages","appendedAttachments","invitationDid","recipientKey"]]'
  }
}
```

## Root Cause Analysis

### API Flow

1. **API Gateway** → Connection Service
2. **Connection Service** → Agent Service (via NATS)
3. **Agent Service** → Credo Controller (HTTP POST)

### Issue Location

- **Endpoint**: `/multi-tenancy/create-invitation/{tenantId}`
- **Service**: Credo Controller (prebuilt image)
- **Problem**: Schema validation mismatch

### Current Behavior

1. Connection Service sends payload with properties: `alias`, `label`, `imageUrl`, `multiUseInvitation`, `autoAcceptConnection`, `goalCode`, `goal`, `handshake`, `handshakeProtocols`, `messages`, `appendedAttachments`, `routing`, `recipientKey`, `invitationDid`

2. Credo Controller endpoint expects schema: `Omit<CreateOutOfBandInvitationConfig, 'routing'> & RecipientKeyOption`
   - Should include: `messages`, `appendedAttachments`
   - Should exclude: `routing`

3. But validation is failing because it can't match the intersection

### Schema Definitions in Credo Controller

- **createInvitation**: `Omit<CreateOutOfBandInvitationConfig, 'routing'>` ✓ (Correct)
- **createLegacyInvitation**: `Omit<CreateOutOfBandInvitationConfig, 'routing' | 'appendedAttachments' | 'messages'>` ✓ (Correct)

### The Problem

The validation error suggests that the endpoint is receiving a request that doesn't match the expected schema intersection. The payload likely contains unexpected properties or is missing required ones.

## Possible Solutions

### Option 1: Fix Connection Service Payload (Recommended)

Filter the payload in Connection Service to match the expected schema:

**File**: `apps/connection/src/connection.service.ts`
**Location**: Line ~690-705 (connectionPayload object)

```typescript
// Current payload includes all properties
const connectionPayload = {
  multiUseInvitation: multiUseInvitation ?? true,
  autoAcceptConnection: autoAcceptConnection ?? true,
  alias: alias || undefined,
  imageUrl: organisation.logoUrl || imageUrl || undefined,
  label: organisation.name,
  goal: goal || undefined,
  goalCode: goalCode || undefined,
  handshake: handshake || undefined,
  handshakeProtocols: handshakeProtocols || undefined,
  appendedAttachments: appendedAttachments || undefined,
  routing: routing || undefined, // ❌ This should be excluded for create-invitation
  messages: messages || undefined,
  recipientKey: recipientKey || undefined,
  invitationDid: connectionInvitationDid || undefined
};

// Fixed payload (exclude routing for create-invitation endpoint)
const connectionPayload = {
  multiUseInvitation: multiUseInvitation ?? true,
  autoAcceptConnection: autoAcceptConnection ?? true,
  alias: alias || undefined,
  imageUrl: organisation.logoUrl || imageUrl || undefined,
  label: organisation.name,
  goal: goal || undefined,
  goalCode: goalCode || undefined,
  handshake: handshake || undefined,
  handshakeProtocols: handshakeProtocols || undefined,
  appendedAttachments: appendedAttachments || undefined,
  messages: messages || undefined,
  recipientKey: recipientKey || undefined,
  invitationDid: connectionInvitationDid || undefined
  // routing: removed for create-invitation endpoint
};
```

### Option 2: Use Different Endpoint

Use the legacy endpoint that supports the current payload structure:

**File**: `libs/common/src/common.constant.ts`
**Change**: Use `URL_SHAGENT_CREATE_INVITATION` instead of `URL_SHAGENT_CREATE_CONNECTION_INVITATION`

### Option 3: Payload Filtering in Agent Service

Add payload filtering in Agent Service before sending to Credo Controller:

**File**: `apps/agent-service/src/agent-service.service.ts`
**Method**: `createConnectionInvitation`

```typescript
async createConnectionInvitation(
  url: string,
  orgId: string,
  connectionPayload: ICreateConnectionInvitation
): Promise<object> {
  try {
    const getApiKey = await this.getOrgAgentApiKey(orgId);

    // Filter payload based on endpoint
    let filteredPayload = { ...connectionPayload };
    if (url.includes('/multi-tenancy/create-invitation/')) {
      // Remove routing for create-invitation endpoint
      delete filteredPayload.routing;
    }

    const createConnectionInvitation = await this.commonService
      .httpPost(url, filteredPayload, { headers: { authorization: getApiKey } })
      .then(async (response) => response);
    return createConnectionInvitation;
  } catch (error) {
    this.logger.error(`Error in create connection invitation in agent service : ${JSON.stringify(error)}`);
    throw error;
  }
}
```

## Recommended Fix

**Option 1** is recommended as it fixes the issue at the source and ensures the payload matches the expected schema for each endpoint type.

## Files to Modify

1. `apps/connection/src/connection.service.ts` - Line ~690-705
2. Potentially `apps/connection/src/connection.service.ts` - `getAgentUrl` method to ensure correct endpoint selection

## Testing

After implementing the fix:

1. Test connection invitation creation for shared agents
2. Verify that the payload sent matches the expected schema
3. Check that both regular and legacy invitation endpoints work correctly
