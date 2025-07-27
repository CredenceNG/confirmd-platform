const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const WebSocket = require('ws');

const app = express();
const server = createServer(app);

// Configure Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: '*', // Configure this to your frontend domain in production
    methods: ['GET', 'POST']
  }
});

console.log('🚀 Starting WebSocket Bridge Server...');
console.log('📡 Socket.IO server will listen on port 8003');
console.log('🔗 Will bridge to credo-controller at localhost:8002');

// Bridge configuration
const CREDO_WS_URL = 'ws://localhost:8002';
let credoWebSocket = null;

// Function to connect to credo-controller WebSocket
function connectToCredoWebSocket() {
  console.log('🔗 Attempting to connect to credo-controller WebSocket...');

  credoWebSocket = new WebSocket(CREDO_WS_URL);

  credoWebSocket.on('open', () => {
    console.log('✅ Connected to credo-controller WebSocket');
  });

  credoWebSocket.on('message', (data) => {
    console.log('📨 Received from credo-controller:', data.toString());
    // Broadcast to all Socket.IO clients
    io.emit('credo-event', JSON.parse(data.toString()));
  });

  credoWebSocket.on('error', (err) => {
    console.log('❌ Credo WebSocket error:', err.message);
    credoWebSocket = null;
  });

  credoWebSocket.on('close', () => {
    console.log('🔌 Credo WebSocket connection closed');
    credoWebSocket = null;
    // Retry connection after 5 seconds
    setTimeout(connectToCredoWebSocket, 5000);
  });
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('🔗 Socket.IO client connected:', socket.id);

  // Send connection status
  socket.emit('bridge-status', {
    credoConnected: credoWebSocket && credoWebSocket.readyState === WebSocket.OPEN,
    timestamp: new Date().toISOString()
  });

  socket.on('disconnect', () => {
    console.log('🔌 Socket.IO client disconnected:', socket.id);
  });

  // Handle messages from Socket.IO clients to credo-controller
  socket.on('credo-command', (data) => {
    console.log('📤 Sending to credo-controller:', data);
    if (credoWebSocket && credoWebSocket.readyState === WebSocket.OPEN) {
      credoWebSocket.send(JSON.stringify(data));
    } else {
      socket.emit('error', { message: 'Credo WebSocket not connected' });
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    socketIOConnections: io.sockets.sockets.size,
    credoWebSocketStatus: credoWebSocket ? credoWebSocket.readyState : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = 8003;
server.listen(PORT, () => {
  console.log(`✅ WebSocket Bridge Server running on port ${PORT}`);
  console.log(`🌐 Socket.IO endpoint: http://localhost:${PORT}/socket.io/`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);

  // Try to connect to credo-controller WebSocket
  connectToCredoWebSocket();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down WebSocket Bridge Server...');
  if (credoWebSocket) {
    credoWebSocket.close();
  }
  server.close();
});
