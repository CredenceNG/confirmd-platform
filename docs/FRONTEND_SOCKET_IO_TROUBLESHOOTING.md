# Frontend Socket.IO Troubleshooting Guide

## 🚨 **Common Issues & Solutions**

### **1. Frontend Not Receiving Updates**

#### **Symptoms:**

- API request succeeds (returns 201)
- No Socket.IO events received
- Progress UI remains static

#### **Root Causes & Solutions:**

**❌ Socket.IO not connected before API call**

```javascript
// WRONG: Making API call immediately
const socket = io('http://localhost:5000');
createWalletAPI(); // Socket might not be connected yet

// ✅ CORRECT: Wait for connection
const socket = io('http://localhost:5000');
socket.on('connect', () => {
  console.log('Connected:', socket.id);
  // Now safe to make API calls
});
```

**❌ Wrong clientSocketId in payload**

```javascript
// WRONG: Using undefined or wrong socket ID
const payload = {
  clientSocketId: undefined // or wrong ID
};

// ✅ CORRECT: Use connected socket ID
const payload = {
  clientSocketId: socket.id // Must match connected socket
};
```

**❌ Event listeners not set up before API call**

```javascript
// WRONG: Setting up listeners after API call
fetch('/orgs/123/agents/wallet', {...});
socket.on('agent-spinup-process-initiated', callback); // Too late!

// ✅ CORRECT: Set up listeners first
socket.on('agent-spinup-process-initiated', callback);
socket.on('invitation-url-creation-success', callback);
fetch('/orgs/123/agents/wallet', {...});
```

### **2. Socket.IO Connection Issues**

#### **Check Connection Status:**

```javascript
// Verify socket is connected
console.log('Socket connected:', socket.connected);
console.log('Socket ID:', socket.id);

// Test connection
socket.emit('ping', (response) => {
  console.log('Server responded:', response);
});
```

#### **Enable Debug Mode:**

```javascript
// Add to browser localStorage for detailed logs
localStorage.debug = 'socket.io-client:socket';
```

#### **Connection Error Handling:**

```javascript
socket.on('connect_error', (error) => {
  console.error('Connection failed:', error);
  // Show user-friendly error message
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  if (reason === 'io server disconnect') {
    // Server initiated disconnect, reconnect manually
    socket.connect();
  }
});
```

### **3. API Request Failures**

#### **Authentication Issues:**

```javascript
// Verify auth token is valid
fetch('/orgs/123/agents/wallet', {
  headers: {
    Authorization: `Bearer ${authToken}` // Ensure token is valid
  }
}).catch((error) => {
  if (error.status === 401) {
    // Redirect to login or refresh token
  }
});
```

#### **Payload Validation:**

```javascript
// Required payload structure
const payload = {
  label: 'Required string',
  agentType: 'AFJ', // Must be 'AFJ' or 'ACAPY'
  orgAgentType: 'DEDICATED', // Must be 'DEDICATED' or 'SHARED'
  ledgerName: ['indicio:testnet'], // Must be valid ledger array
  clientSocketId: socket.id // Must be connected socket ID
};

// Validate before sending
if (!socket.id) {
  throw new Error('Socket not connected');
}
if (!payload.label || !payload.agentType) {
  throw new Error('Missing required fields');
}
```

### **4. Backend Processing Errors**

#### **Monitor Backend Logs:**

```bash
# Monitor agent service logs
docker logs -f confirmd-platform-agent-service-1

# Check for specific errors
docker logs confirmd-platform-agent-service-1 | grep ERROR
```

#### **Common Backend Errors:**

**Platform Admin Agent Not Running:**

```bash
# Symptoms: "ENOTFOUND" errors in logs
# Solution: Restart platform admin agent
docker start f856e3a4-b09c-4356-82de-b105594eec43_Platform-admin
```

**Database Connection Issues:**

```bash
# Check if PostgreSQL is healthy
docker ps | grep postgres
```

**Invalid Credentials:**

```bash
# Check if API keys are properly encrypted
docker exec -it confirmd-platform-postgres-1 psql -U postgres -d credebl -c "SELECT \"orgId\", length(\"apiKey\") FROM org_agents WHERE \"apiKey\" IS NOT NULL;"
```

### **5. Network & CORS Issues**

#### **Check API Gateway Accessibility:**

```javascript
// Test API gateway health
fetch('http://localhost:5000/health')
  .then((response) => console.log('API Gateway:', response.status))
  .catch((error) => console.error('API Gateway unreachable:', error));
```

#### **CORS Configuration:**

```javascript
// If running frontend on different port/domain
const socket = io('http://localhost:5000', {
  withCredentials: true, // Include credentials for CORS
  extraHeaders: {
    'Access-Control-Allow-Origin': '*'
  }
});
```

### **6. Browser Compatibility**

#### **WebSocket Support:**

```javascript
// Check WebSocket support
if (!window.WebSocket) {
  console.error('WebSocket not supported');
  // Fallback to polling
  const socket = io('http://localhost:5000', {
    transports: ['polling'] // Use HTTP polling instead
  });
}
```

#### **localStorage Debug:**

```javascript
// Clear debug settings if causing issues
delete localStorage.debug;
```

## 🔧 **Debug Checklist**

### **Step 1: Verify Socket Connection**

```javascript
// In browser console
console.log('Socket connected:', socket.connected);
console.log('Socket ID:', socket.id);
console.log('Socket transport:', socket.io.engine.transport.name);
```

### **Step 2: Test Event Listeners**

```javascript
// Add test listener
socket.on('test-event', (data) => {
  console.log('Test event received:', data);
});

// Manual emit (for testing)
socket.emit('test-event', { message: 'hello' });
```

### **Step 3: Verify API Request**

```javascript
// Check request in Network tab
// Verify:
// - 201 response status
// - Correct payload structure
// - Valid auth headers
// - Socket ID matches connected socket
```

### **Step 4: Monitor Real-time Events**

```javascript
// Log all wallet creation events
const events = [
  'agent-spinup-process-initiated',
  'agent-spinup-process-completed',
  'did-publish-process-initiated',
  'did-publish-process-completed',
  'invitation-url-creation-started',
  'invitation-url-creation-success',
  'error-in-wallet-creation-process'
];

events.forEach((event) => {
  socket.on(event, (data) => {
    console.log(`📨 ${event}:`, data);
  });
});
```

## 🎯 **Quick Fixes**

### **If No Events Received:**

1. Check socket.connected === true
2. Verify socket.id === payload.clientSocketId
3. Set up listeners BEFORE API call
4. Check browser console for errors

### **If API Call Fails:**

1. Verify auth token is valid
2. Check payload structure matches requirements
3. Ensure API Gateway is accessible
4. Check for CORS issues

### **If Socket Keeps Disconnecting:**

1. Check network stability
2. Verify server is not restarting
3. Add reconnection logic
4. Monitor for memory leaks

### **If Events Received But UI Not Updating:**

1. Check event listener callbacks
2. Verify UI update functions work
3. Test with console.log first
4. Check for JavaScript errors

## 📞 **Emergency Debug Commands**

```javascript
// Complete debug reset
socket.disconnect();
socket.connect();

// Log everything
socket.onAny((event, data) => {
  console.log('Any event:', event, data);
});

// Force reconnection
socket.io.reconnection(true);
socket.io.reconnect();
```

This troubleshooting guide should help identify and resolve the most common issues with Socket.IO integration for wallet creation updates.
