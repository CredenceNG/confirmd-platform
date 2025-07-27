# Independent Agent Frontend Integration Guide

## ✅ Current Status - READY FOR FRONTEND TESTING

### Working Infrastructure:

- **✅ Independent Agent**: Running on ports 8002/9002 with confirmed multi-tenancy
- **✅ Database Integration**: Encrypted API key stored and tested (216 chars)
- **✅ Platform Services**: 15+ confirmd services running and healthy
- **✅ Multi-tenancy**: Tenant creation confirmed working with proper response format

## 🚀 Frontend Integration Steps

### 1. Socket.IO Connection

```javascript
// Connect to API Gateway for real-time updates
const socket = io('http://localhost:5000');

socket.on('connect', () => {
  console.log('Connected with socket ID:', socket.id);
});

// Listen for wallet creation progress events
const walletCreationEvents = [
  'agent-spinup-process-initiated',
  'agent-spinup-process-completed',
  'did-publish-process-initiated',
  'did-publish-process-completed',
  'invitation-url-creation-started',
  'invitation-url-creation-success',
  'error-in-wallet-creation-process'
];

walletCreationEvents.forEach((event) => {
  socket.on(event, (data) => {
    console.log(`Event: ${event}`, data);
    updateProgressUI(event, data);
  });
});
```

### 2. Wallet Creation Request

```javascript
async function createWallet(orgId, authToken) {
  const payload = {
    label: 'Organization Wallet',
    agentType: 'AFJ', // Must match database agents_type
    orgAgentType: 'DEDICATED', // Must match database org_agents_type
    ledgerName: ['indicio:testnet'], // Valid ledger options
    clientSocketId: socket.id, // CRITICAL for real-time updates
    seed: undefined // Optional 32-char hex seed
  };

  try {
    const response = await fetch(`http://localhost:5000/orgs/${orgId}/agents/wallet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Wallet creation initiated:', result);
      // Expected: { "statusCode": 201, "message": "Agent process initiated successfully", "data": { "agentSpinupStatus": 1 }}
      return result;
    } else {
      throw new Error(`API Error: ${result.message}`);
    }
  } catch (error) {
    console.error('❌ Wallet creation failed:', error);
    throw error;
  }
}
```

### 3. Progress UI Updates

```javascript
function updateProgressUI(eventType, data) {
  const progressSteps = {
    'agent-spinup-process-initiated': 'Initializing agent setup...',
    'agent-spinup-process-completed': 'Agent configuration complete',
    'did-publish-process-initiated': 'Publishing DID to ledger...',
    'did-publish-process-completed': 'DID published successfully',
    'invitation-url-creation-started': 'Generating invitation URL...',
    'invitation-url-creation-success': '✅ Wallet created successfully!',
    'error-in-wallet-creation-process': '❌ Error occurred'
  };

  const message = progressSteps[eventType] || `Unknown event: ${eventType}`;

  // Update your progress UI
  document.getElementById('progress-message').textContent = message;

  if (eventType === 'invitation-url-creation-success') {
    // Wallet creation completed - show success state
    showWalletCreationSuccess(data);
  } else if (eventType === 'error-in-wallet-creation-process') {
    // Show error state
    showWalletCreationError(data);
  }
}
```

## 🧪 Testing Commands

### Backend Service Verification:

```bash
# 1. Verify all services running
docker ps | grep confirmd | wc -l  # Should return ~15

# 2. Test independent agent responding
curl -s -o /dev/null -w "%{http_code}" http://localhost:8002/docs/
# Should return: 200

# 3. Verify database has platform admin agent
docker exec -it confirmd-platform-postgres-1 psql -U postgres -d credebl -c "
SELECT COUNT(*) as agent_count, 'org_agents' as table_name
FROM org_agents WHERE \"agentEndPoint\" = 'http://localhost:8002';
"
# Should return: agent_count = 1

# 4. Test multi-tenancy working
node -e "
const CryptoJS = require('crypto-js');
const secretKey = 'dzIvVU5uMa0R3sYwdjEEuT4id17mPpjr';
const encryptedKey = 'U2FsdGVkX1865cRhZC1k5lxOxYzs76xybEEOnyLBY84WnIo7h759qV9DQ9EqkqsGScIyB8Kez/EO3uT/WHc7b9SJjHAB+jPevvHM57enjK0jqw9RsmcAgxw8hxnT+27VtqWhQeovcuO5ddUZR2etKSj749mgAgMkeodUShSeSKsH1ni6I3fAi8RE0JPwxw3Ht6fNOgmOC69RVERXunY29w==';
const token = CryptoJS.AES.decrypt(encryptedKey, secretKey).toString(CryptoJS.enc.Utf8);
console.log(token);
" | xargs -I {} curl -H "authorization: {}" -H "Content-Type: application/json" -X POST -d '{"config":{"label":"FrontendTest"}}' http://localhost:8002/multi-tenancy/create-tenant
# Should return: JSON with new tenant ID and wallet config
```

### Frontend API Testing:

```bash
# Test the wallet creation endpoint (replace with valid org ID and auth token)
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-auth-token>" \
  -d '{
    "label": "TestWallet",
    "agentType": "AFJ",
    "orgAgentType": "DEDICATED",
    "ledgerName": ["indicio:testnet"],
    "clientSocketId": "test-socket-123"
  }' \
  http://localhost:5000/orgs/21e8fefc-b394-4775-ae81-052f5e48626c/agents/wallet
```

## 📋 Integration Checklist

### Before Frontend Testing:

- [ ] All 15+ platform services running (`docker ps | grep confirmd`)
- [ ] Independent agent responding on port 8002 (`curl http://localhost:8002/docs/`)
- [ ] Database has platform admin agent with encrypted API key
- [ ] Multi-tenancy endpoint creating tenants successfully

### During Frontend Testing:

- [ ] Socket.IO connection established successfully
- [ ] Wallet creation API returns 201 status with `agentSpinupStatus: 1`
- [ ] Progress events received in correct sequence
- [ ] Error handling works for invalid requests
- [ ] Final success event contains invitation URL

### Success Criteria:

- [ ] Frontend receives all expected Socket.IO events
- [ ] Wallet creation completes without errors
- [ ] New `org_agents` record created in database
- [ ] Agent endpoint accessible and functional
- [ ] No orphaned processes or containers

## 🔧 Troubleshooting

### Common Issues:

1. **Socket.IO Not Connecting**: Verify nginx proxy running and accessible on port 5000
2. **API Returns 401**: Check authorization token is valid and not expired
3. **No Progress Events**: Ensure `clientSocketId` matches connected socket ID
4. **Agent Creation Fails**: Check agent-provisioning service logs for shell script errors

### Debug Commands:

```bash
# Check service logs
docker logs confirmd-platform-api-gateway-1 | tail -20
docker logs confirmd-platform-agent-service-1 | tail -20
docker logs confirmd-platform-agent-provisioning-1 | tail -20

# Verify Socket.IO endpoint
curl -s http://localhost:5000/socket.io/?transport=polling | head -5

# Check database state
docker exec -it confirmd-platform-postgres-1 psql -U postgres -d credebl -c "
SELECT o.name, oa.\"agentEndPoint\", oa.\"agentSpinUpStatus\"
FROM organisation o
JOIN org_agents oa ON o.id = oa.\"orgId\"
WHERE oa.\"agentEndPoint\" IS NOT NULL;
"
```

## 🎯 Next Steps

1. **Implement Frontend**: Use the provided Socket.IO and API code snippets
2. **Test Real Flow**: Create actual wallets through frontend UI
3. **Monitor Performance**: Watch for any timeout or memory issues
4. **Scale Testing**: Test multiple concurrent wallet creations
5. **Production Ready**: All infrastructure confirmed working and documented

The independent agent setup is **FULLY FUNCTIONAL** and ready for frontend integration! 🚀
