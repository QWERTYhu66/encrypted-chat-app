// Simple WebSocket server for local development
// This server only transports encrypted messages - it cannot decrypt them

const WebSocket = require('ws');
const http = require('http');
const url = require('url');

// Store connected clients
const clients = new Map();
// Store user public keys for key exchange
const userPublicKeys = new Map();

// Create HTTP server (for health checks, etc.)
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);

  if (parsedUrl.pathname === '/health') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({status: 'ok', timestamp: new Date().toISOString()}));
  } else {
    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.end('Not Found');
  }
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  // Generate a unique ID for this client
  const clientId = Math.random().toString(36).substring(2, 15);
  const ip = req.socket.remoteAddress;

  console.log(`New client connected: ${clientId} from ${ip}`);

  // Store client info
  clients.set(ws, {
    id: clientId,
    ip: ip,
    userId: null, // Will be set after public key exchange
    connectedAt: new Date()
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    clientId: clientId,
    timestamp: new Date().toISOString()
  }));

  // Handle incoming messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // Handle different message types
      switch (data.type) {
        case 'public-key-exchange':
          // Store user's public key and broadcast to other clients
          userPublicKeys.set(data.userId, data.publicKey);
          clients.get(ws).userId = data.userId;

          console.log(`Public key exchanged for user: ${data.userId}`);

          // Broadcast to all other clients (key distribution)
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'public-key-exchange',
                userId: data.userId,
                publicKey: data.publicKey,
                timestamp: new Date().toISOString()
              }));
            }
          });
          break;

        case 'encrypted-message':
          // Broadcast encrypted message to all other clients
          // Server does NOT decrypt or inspect the payload
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              // In a room-based system, we would check if client is in the same room
              // For simplicity, we broadcast to all connected clients
              client.send(JSON.stringify({
                type: 'encrypted-message',
                roomId: data.roomId || 'default',
                senderId: data.senderId,
                encryptedAesKey: data.encryptedAesKey,
                iv: data.iv,
                ciphertext: data.ciphertext,
                timestamp: data.timestamp
              }));
            }
          });

          // Log that we forwarded a message (without revealing content)
          console.log(`Forwarded encrypted message from ${data.senderId} in room ${data.roomId || 'default'}`);
          break;

        case 'ping':
          // Respond to ping with pong
          ws.send(JSON.stringify({type: 'pong', timestamp: new Date().toISOString()}));
          break;

        default:
          console.log(`Received unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format',
        timestamp: new Date().toISOString()
      }));
    }
  });

  // Handle client disconnection
  ws.on('close', (code, reason) => {
    console.log(`Client disconnected: ${clients.get(ws)?.id || 'unknown'} (code: ${code})`);

    // Clean up
    const clientInfo = clients.get(ws);
    if (clientInfo && clientInfo.userId) {
      // Optionally notify other clients about user disconnecting
      // For privacy, we might not want to reveal when specific users disconnect
    }

    clients.delete(ws);
    // Note: We don't remove the public key as it might be needed for future connections
  });

  // Handle WebSocket errors
  ws.on('error', (error) => {
    console.error(`WebSocket error for client ${clients.get(ws)?.id}:`, error);
  });
});

// Handle server errors
server.on('error', (error) => {
  console.error('Server error:', error);
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down WebSocket server...');
  wss.close(() => {
    console.log('WebSocket server closed');
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });
});