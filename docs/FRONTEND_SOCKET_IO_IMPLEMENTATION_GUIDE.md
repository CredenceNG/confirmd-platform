# Frontend Socket.IO Integration Guide for Wallet Creation

## 🎯 **Overview**

This guide provides the complete technical implementation for receiving real-time wallet creation updates using Socket.IO in the Confirmd Platform.

## 📋 **Prerequisites**

- Socket.IO client library installed (`socket.io-client`)
- API Gateway accessible at `http://localhost:5000`
- Valid authentication token for wallet creation endpoint

## 🔧 **1. Socket.IO Client Setup**

### **Install Dependencies**

```bash
npm install socket.io-client
# or
yarn add socket.io-client
```

### **Initialize Socket Connection**

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
  // Connection options
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  maxReconnectionAttempts: 5,
  timeout: 20000,
  forceNew: false,

  // Optional: Add authentication if required
  auth: {
    token: 'your-auth-token' // If backend requires socket authentication
  }
});

// Connection event handlers
socket.on('connect', () => {
  console.log('✅ Socket.IO connected:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Socket.IO disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('🔥 Socket.IO connection error:', error);
});
```

## 🎬 **2. Wallet Creation Event Listeners**

### **Complete Event Handler Implementation**

```javascript
class WalletCreationHandler {
  constructor(socket, onProgressUpdate, onError, onComplete) {
    this.socket = socket;
    this.onProgressUpdate = onProgressUpdate;
    this.onError = onError;
    this.onComplete = onComplete;

    // Bind event listeners
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Step 1: Wallet creation initiated
    this.socket.on('agent-spinup-process-initiated', (data) => {
      console.log('🚀 Step 1: Wallet creation started', data);
      this.onProgressUpdate({
        step: 1,
        message: 'Initializing wallet setup...',
        progress: 16, // 1/6 steps = ~16%
        data
      });
    });

    // Step 2: Agent setup completed
    this.socket.on('agent-spinup-process-completed', (data) => {
      console.log('✅ Step 2: Agent setup completed', data);
      this.onProgressUpdate({
        step: 2,
        message: 'Agent container created and running',
        progress: 33, // 2/6 steps = ~33%
        data
      });
    });

    // Step 3: DID publication initiated
    this.socket.on('did-publish-process-initiated', (data) => {
      console.log('📝 Step 3: Publishing DID to ledger', data);
      this.onProgressUpdate({
        step: 3,
        message: 'Publishing DID to blockchain ledger...',
        progress: 50, // 3/6 steps = 50%
        data
      });
    });

    // Step 4: DID publication completed
    this.socket.on('did-publish-process-completed', (data) => {
      console.log('✅ Step 4: DID published successfully', data);
      this.onProgressUpdate({
        step: 4,
        message: 'DID published successfully to ledger',
        progress: 66, // 4/6 steps = ~66%
        data
      });
    });

    // Step 5: Invitation URL creation started
    this.socket.on('invitation-url-creation-started', (data) => {
      console.log('🔗 Step 5: Creating invitation URL', data);
      this.onProgressUpdate({
        step: 5,
        message: 'Generating connection invitation URL...',
        progress: 83, // 5/6 steps = ~83%
        data
      });
    });

    // Step 6: Wallet creation completed successfully
    this.socket.on('invitation-url-creation-success', (data) => {
      console.log('🎉 Step 6: Wallet creation completed!', data);
      this.onProgressUpdate({
        step: 6,
        message: 'Wallet created successfully!',
        progress: 100,
        data
      });
      this.onComplete(data);
    });

    // Error handling
    this.socket.on('error-in-wallet-creation-process', (data) => {
      console.error('❌ Wallet creation error:', data);
      this.onError({
        message: 'Wallet creation failed',
        error: data.error,
        step: data.step || 'unknown',
        data
      });
    });
  }

  // Clean up event listeners
  destroy() {
    this.socket.off('agent-spinup-process-initiated');
    this.socket.off('agent-spinup-process-completed');
    this.socket.off('did-publish-process-initiated');
    this.socket.off('did-publish-process-completed');
    this.socket.off('invitation-url-creation-started');
    this.socket.off('invitation-url-creation-success');
    this.socket.off('error-in-wallet-creation-process');
  }
}
```

## 🚀 **3. Wallet Creation API Implementation**

### **Complete Wallet Creation Function**

```javascript
async function createWallet(orgId, walletConfig, authToken) {
  return new Promise((resolve, reject) => {
    // Ensure socket is connected
    if (!socket.connected) {
      reject(new Error('Socket.IO not connected. Please refresh the page.'));
      return;
    }

    // Setup progress tracking
    const walletHandler = new WalletCreationHandler(
      socket,
      // Progress callback
      (progressData) => {
        updateWalletCreationUI(progressData);
      },
      // Error callback
      (errorData) => {
        console.error('Wallet creation failed:', errorData);
        reject(new Error(errorData.message));
      },
      // Complete callback
      (completeData) => {
        console.log('Wallet creation completed:', completeData);
        walletHandler.destroy(); // Clean up listeners
        resolve(completeData);
      }
    );

    // Prepare API payload
    const payload = {
      label: walletConfig.label || `${orgId}_Wallet`,
      agentType: walletConfig.agentType || 'AFJ',
      orgAgentType: walletConfig.orgAgentType || 'DEDICATED',
      ledgerName: walletConfig.ledgerName || ['indicio:testnet'],
      clientSocketId: socket.id, // CRITICAL: Use connected socket ID
      seed: walletConfig.seed || undefined // Optional 32-character hex seed
    };

    // Validate payload
    if (!payload.clientSocketId) {
      reject(new Error('Socket ID not available. Please refresh and try again.'));
      return;
    }

    console.log('🚀 Creating wallet with payload:', payload);

    // Make API request
    fetch(`http://localhost:5000/orgs/${orgId}/agents/wallet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        return response.json();
      })
      .then((result) => {
        console.log('✅ Wallet creation API response:', result);
        // Success response received - now wait for Socket.IO events
      })
      .catch((error) => {
        console.error('❌ API request failed:', error);
        walletHandler.destroy(); // Clean up on API error
        reject(error);
      });

    // Set timeout for wallet creation process
    setTimeout(
      () => {
        walletHandler.destroy();
        reject(new Error('Wallet creation timeout after 5 minutes'));
      },
      5 * 60 * 1000
    ); // 5 minute timeout
  });
}
```

## 🎨 **4. UI Update Implementation**

### **React Example**

```jsx
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const WalletCreationComponent = ({ orgId, authToken }) => {
  const [socket, setSocket] = useState(null);
  const [progress, setProgress] = useState({ step: 0, message: '', progress: 0 });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Initialize socket connection
    const socketInstance = io('http://localhost:5000', {
      autoConnect: true,
      reconnection: true
    });

    socketInstance.on('connect', () => {
      console.log('Socket connected:', socketInstance.id);
      setSocket(socketInstance);
    });

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const updateWalletCreationUI = (progressData) => {
    setProgress(progressData);
  };

  const handleCreateWallet = async () => {
    if (!socket) {
      setError('Socket not connected. Please refresh the page.');
      return;
    }

    setIsCreating(true);
    setError(null);
    setProgress({ step: 0, message: 'Starting wallet creation...', progress: 0 });

    try {
      const walletConfig = {
        label: 'My Organization Wallet',
        agentType: 'AFJ',
        orgAgentType: 'DEDICATED',
        ledgerName: ['indicio:testnet']
      };

      const result = await createWallet(orgId, walletConfig, authToken);
      console.log('Wallet created successfully:', result);

      // Handle success
      setProgress({
        step: 6,
        message: 'Wallet created successfully!',
        progress: 100
      });
    } catch (error) {
      console.error('Wallet creation failed:', error);
      setError(error.message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="wallet-creation">
      <h3>Wallet Creation</h3>

      {/* Progress Display */}
      {isCreating && (
        <div className="progress-container">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress.progress}%` }} />
          </div>
          <p>{progress.message}</p>
          <small>Step {progress.step} of 6</small>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Create Button */}
      <button onClick={handleCreateWallet} disabled={isCreating || !socket} className="create-wallet-btn">
        {isCreating ? 'Creating Wallet...' : 'Create Wallet'}
      </button>

      {/* Socket Status */}
      <div className="socket-status">Socket: {socket ? `✅ Connected (${socket.id})` : '❌ Disconnected'}</div>
    </div>
  );
};
```

### **Vanilla JavaScript Example**

```javascript
// DOM elements
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const createButton = document.getElementById('create-wallet-btn');
const errorDiv = document.getElementById('error-message');

// Update UI function
function updateWalletCreationUI(progressData) {
  progressBar.style.width = `${progressData.progress}%`;
  progressText.textContent = progressData.message;

  // Update step indicator
  const stepIndicator = document.getElementById('step-indicator');
  stepIndicator.textContent = `Step ${progressData.step} of 6`;
}

// Create wallet handler
async function handleCreateWallet() {
  createButton.disabled = true;
  errorDiv.style.display = 'none';

  try {
    const result = await createWallet(orgId, walletConfig, authToken);
    console.log('Success!', result);
  } catch (error) {
    errorDiv.textContent = error.message;
    errorDiv.style.display = 'block';
  } finally {
    createButton.disabled = false;
  }
}

createButton.addEventListener('click', handleCreateWallet);
```

## 🔧 **5. Configuration & Constants**

### **Configuration Object**

```javascript
const WALLET_CONFIG = {
  // API Configuration
  API_BASE_URL: 'http://localhost:5000',
  SOCKET_URL: 'http://localhost:5000',

  // Wallet Creation Timeout
  CREATION_TIMEOUT: 5 * 60 * 1000, // 5 minutes

  // Available Agent Types
  AGENT_TYPES: ['AFJ', 'ACAPY'],

  // Available Organization Agent Types
  ORG_AGENT_TYPES: ['DEDICATED', 'SHARED'],

  // Available Ledgers
  LEDGERS: ['indicio:testnet', 'indicio:demonet', 'indicio:mainnet', 'bcovrin:testnet'],

  // Socket.IO Configuration
  SOCKET_OPTIONS: {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000
  }
};
```

## 🚨 **6. Error Handling & Edge Cases**

### **Complete Error Handling**

```javascript
class WalletCreationError extends Error {
  constructor(message, step, originalError) {
    super(message);
    this.name = 'WalletCreationError';
    this.step = step;
    this.originalError = originalError;
  }
}

function handleWalletCreationErrors(error) {
  // Network errors
  if (error.code === 'NETWORK_ERROR') {
    return 'Network connection failed. Please check your internet connection.';
  }

  // Authentication errors
  if (error.status === 401) {
    return 'Authentication failed. Please log in again.';
  }

  // Validation errors
  if (error.status === 400) {
    return 'Invalid wallet configuration. Please check your inputs.';
  }

  // Agent provisioning errors
  if (error.message.includes('ENOTFOUND')) {
    return 'Agent provisioning failed. Please try again or contact support.';
  }

  // Socket disconnection
  if (error.message.includes('Socket')) {
    return 'Real-time connection lost. Please refresh the page and try again.';
  }

  // Generic error
  return error.message || 'An unexpected error occurred during wallet creation.';
}
```

## 📊 **7. Testing & Debugging**

### **Debug Helper Functions**

```javascript
// Enable Socket.IO debugging
localStorage.debug = 'socket.io-client:socket';

// Test socket connection
function testSocketConnection() {
  if (socket.connected) {
    console.log('✅ Socket connected:', socket.id);
    socket.emit('test', { message: 'Hello from client' });
  } else {
    console.log('❌ Socket not connected');
  }
}

// Monitor all socket events
function debugAllSocketEvents() {
  const originalEmit = socket.emit;
  const originalOn = socket.on;

  socket.emit = function (...args) {
    console.log('📤 Socket emit:', args);
    return originalEmit.apply(this, args);
  };

  socket.on = function (event, callback) {
    console.log('📥 Socket on:', event);
    return originalOn.call(this, event, (...args) => {
      console.log('📨 Socket event received:', event, args);
      callback(...args);
    });
  };
}
```

## ✅ **8. Implementation Checklist**

### **Pre-Implementation**

- [ ] Socket.IO client library installed
- [ ] API Gateway accessible at `http://localhost:5000`
- [ ] Valid organization ID and auth token available

### **Core Implementation**

- [ ] Socket.IO connection established with proper options
- [ ] All 6 wallet creation event listeners implemented
- [ ] API request with correct payload structure
- [ ] `clientSocketId` matches connected socket ID
- [ ] Progress UI updates working
- [ ] Error handling implemented

### **Testing**

- [ ] Socket connection/disconnection scenarios
- [ ] Network error handling
- [ ] Authentication error handling
- [ ] Wallet creation success flow
- [ ] Wallet creation failure scenarios
- [ ] UI responsiveness during creation process

### **Production Ready**

- [ ] Proper error messages for users
- [ ] Loading states and progress indicators
- [ ] Timeout handling (5-minute limit)
- [ ] Cleanup of event listeners
- [ ] Browser compatibility testing

## 🎯 **Quick Start Example**

```javascript
// Minimal working example
const socket = io('http://localhost:5000');

socket.on('connect', () => {
  console.log('Connected:', socket.id);
});

// Listen for wallet creation events
socket.on('agent-spinup-process-initiated', (data) => {
  console.log('Step 1: Started');
});

socket.on('invitation-url-creation-success', (data) => {
  console.log('Step 6: Completed!');
});

socket.on('error-in-wallet-creation-process', (data) => {
  console.error('Error:', data.error);
});

// Create wallet
function createWallet() {
  const payload = {
    label: 'Test Wallet',
    agentType: 'AFJ',
    orgAgentType: 'DEDICATED',
    ledgerName: ['indicio:testnet'],
    clientSocketId: socket.id // CRITICAL!
  };

  fetch('/orgs/{orgId}/agents/wallet', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + authToken
    },
    body: JSON.stringify(payload)
  });
}
```

This guide provides everything needed to implement real-time wallet creation updates in your frontend application. The key is maintaining the Socket.IO connection and using the correct `clientSocketId` in your API requests.
