const WebSocket = require('ws');
const http = require('http');

const clients = new Map();
const userPublicKeys = new Map();

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

  if (parsedUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  const clientId = Math.random().toString(36).substring(2, 15);
  const ip = req.socket.remoteAddress;

  console.log(`New client connected: ${clientId} from ${ip}`);

  clients.set(ws, {
    id: clientId,
    ip: ip,
    userId: null,
    connectedAt: new Date()
  });

  ws.send(JSON.stringify({
    type: 'welcome',
    clientId: clientId,
    timestamp: new Date().toISOString()
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'public-key-exchange':
          userPublicKeys.set(data.userId, data.publicKey);
          clients.get(ws).userId = data.userId;

          console.log(`Public key exchanged for user: ${data.userId}`);

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
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
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
          console.log(`Forwarded encrypted message from ${data.senderId} in room ${data.roomId || 'default'}`);
          break;

        case 'demo-message':
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'demo-message',
                content: data.content,
                userID: data.userID,
                timestamp: data.timestamp
              }));
            }
          });
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
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

  ws.on('close', (code) => {
    console.log(`Client disconnected: ${clients.get(ws)?.id || 'unknown'} (code: ${code})`);
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for client ${clients.get(ws)?.id}:`, error);
  });
});

server.on('error', (error) => {
  console.error('Server error:', error);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
});

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
