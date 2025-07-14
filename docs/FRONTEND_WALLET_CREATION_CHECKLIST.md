# Frontend Wallet Creation - Cleanup & Optimization Checklist

## 🚀 **Critical Infrastructure Requirements**

### ✅ **1. Platform Admin Agent (COMPLETED)**

- [x] Platform admin agent container running on correct ports (8002, 9002)
- [x] Valid JSON configuration with proper ledger definitions
- [x] JWT API token generated and encrypted in database
- [x] Internal Docker network connectivity established
- [x] Wallet initialized and ready for tenant creation

### ✅ **2. Database Consistency (COMPLETED)**

- [x] `agents_type` table seeded with AFJ and ACAPY
- [x] `org_agents_type` table seeded with DEDICATED and SHARED
- [x] Platform admin organization record exists
- [x] Platform admin agent record with encrypted API key
- [x] Orphaned records cleaned up

### ✅ **3. Service Health (COMPLETED)**

- [x] Agent Service: Running and detecting existing platform admin
- [x] Agent Provisioning Service: Running without Docker mount errors
- [x] API Gateway: Running with Socket.IO enabled
- [x] PostgreSQL: Healthy and accessible

---

## 🎯 **Frontend Integration Optimizations**

### 📡 **Real-time Updates (Socket.IO Events)**

The following events are emitted during wallet creation:

1. **`agent-spinup-process-initiated`** - Wallet creation started
2. **`agent-spinup-process-completed`** - Agent setup completed
3. **`did-publish-process-initiated`** - DID publication started
4. **`did-publish-process-completed`** - DID published successfully
5. **`invitation-url-creation-started`** - Invitation URL generation started
6. **`invitation-url-creation-success`** - Invitation URL created
7. **`error-in-wallet-creation-process`** - Error occurred at any step

### 🔧 **Required Frontend Actions**

#### **A. Socket.IO Connection Management**

```javascript
// Ensure frontend connects to Socket.IO on API Gateway
const socket = io('http://localhost:5000');

// Listen for wallet creation progress
socket.on('agent-spinup-process-initiated', (data) => {
  updateProgressUI('Initializing wallet setup...');
});

socket.on('agent-spinup-process-completed', (data) => {
  updateProgressUI('Agent setup completed');
});

socket.on('did-publish-process-initiated', (data) => {
  updateProgressUI('Publishing DID to ledger...');
});

socket.on('did-publish-process-completed', (data) => {
  updateProgressUI('DID published successfully');
});

socket.on('invitation-url-creation-started', (data) => {
  updateProgressUI('Generating invitation URL...');
});

socket.on('invitation-url-creation-success', (data) => {
  updateProgressUI('Wallet creation completed successfully!');
});

socket.on('error-in-wallet-creation-process', (data) => {
  displayError(data.error);
});
```

#### **B. Form Submission Requirements**

```javascript
// Required payload for wallet creation
const walletCreationPayload = {
  label: 'Organization Wallet',
  seed: '32-character-hex-seed-string', // Optional
  agentType: 'AFJ', // Must match agents_type.agent
  orgAgentType: 'DEDICATED', // Must match org_agents_type.agent
  ledgerName: ['indicio:testnet'], // Must match valid ledger names
  clientSocketId: socket.id // CRITICAL for real-time updates
};

// Submit to correct endpoint
fetch(`/orgs/${orgId}/agents/wallet`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + authToken
  },
  body: JSON.stringify(walletCreationPayload)
});
```

### 🛡️ **Error Handling & Validation**

#### **C. Frontend Validation Checks**

1. **Organization exists** - Verify orgId is valid before submission
2. **User permissions** - Ensure user has wallet creation rights
3. **Network connectivity** - Check Socket.IO connection before starting
4. **Required fields** - Validate all mandatory fields are present

#### **D. Error Recovery**

1. **Connection lost** - Reconnect Socket.IO and resume progress tracking
2. **Timeout handling** - Set reasonable timeouts for each step
3. **Retry logic** - Allow retry on recoverable errors
4. **Graceful degradation** - Fallback to polling if Socket.IO fails

---

## 🔧 **Immediate Cleanup Actions**

### **1. Remove Development Artifacts**

- [x] Temporary encryption script removed
- [x] Orphaned database records cleaned up
- [x] Test containers properly configured

### **2. Verify Endpoint Accessibility**

- API Gateway: `http://localhost:5000` (external)
- Platform Admin Agent: `http://f856e3a4-b09c-4356-82de-b105594eec43_Platform-admin:8002` (internal)
- Socket.IO: `ws://localhost:5000/socket.io/` (WebSocket)

### **3. Environment Configuration**

- All services using consistent Docker network
- Proper environment variables loaded
- Database connections stable

---

## 🧪 **Testing Checklist**

### **Before Frontend Testing:**

1. Run cleanup script: `./scripts/frontend-wallet-cleanup.sh`
2. Verify all services are healthy
3. Check Socket.IO connectivity from browser dev tools
4. Confirm database has proper seed data

### **During Frontend Testing:**

1. Monitor Socket.IO events in browser dev tools
2. Check API Gateway logs for request flow
3. Watch Agent Service logs for processing status
4. Verify database records are created correctly

### **Success Criteria:**

- [ ] Frontend receives all Socket.IO progress events
- [ ] Wallet creation completes without errors
- [ ] New org_agents record created with proper encryption
- [ ] DID published to specified ledger
- [ ] Invitation URL generated successfully
- [ ] No orphaned records or containers left behind

---

## 🚨 **Common Issues & Solutions**

| Issue                      | Symptoms                    | Solution                                              |
| -------------------------- | --------------------------- | ----------------------------------------------------- |
| Socket.IO not connecting   | No progress updates         | Check API Gateway logs, verify port 5000              |
| API key decryption fails   | "Invalid Credentials" error | Verify CRYPTO_PRIVATE_KEY environment variable        |
| Agent container fails      | Docker mount errors         | Use proper volume mounts or manual container creation |
| DID publication fails      | Ledger connection timeout   | Verify ledger URLs and network connectivity           |
| Database constraint errors | Foreign key violations      | Ensure all reference data is seeded properly          |

---

## 📋 **Final Verification Commands**

```bash
# Check all services are running
docker ps | grep confirmd

# Verify platform admin agent
curl -s -o /dev/null -w "%{http_code}" http://localhost:8002/agent

# Check database seeding
docker exec -it confirmd-platform-postgres-1 psql -U postgres -d credebl -c "
SELECT 'agents_type' as table_name, COUNT(*) as count FROM agents_type
UNION ALL
SELECT 'org_agents_type', COUNT(*) FROM org_agents_type
UNION ALL
SELECT 'org_agents', COUNT(*) FROM org_agents WHERE \"orgId\" IS NOT NULL;
"

# Test Socket.IO from command line
curl -s http://localhost:5000/socket.io/?transport=polling
```

## ✅ **Ready for Production**

Once all items in this checklist are verified, the platform is ready for smooth frontend wallet creation with full real-time progress updates.
