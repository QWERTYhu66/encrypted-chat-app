// Main process entry point
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const WebSocket = require('ws');
const Store = require('electron-store');

// WebSocket server
const http = require('http');
const url = require('url');

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

// WebSocket server (for local development)
let wss = null;
let server = null;

// Store for user's own public key (will be loaded from secure storage later)
let userPublicKey = null;

// Store for contacts' public keys
const contactPublicKeys = new Map();

// Store for user ID and other persistent data
let userStore;
try {
  console.log('Loading electron-store...');
  const StoreModule = require('electron-store');
  // Handle different possible export formats (CommonJS vs ESModule)
  const StoreClass = StoreModule.default || StoreModule;
  console.log('electron-store loaded, creating store...');
  userStore = new StoreClass();
  console.log('User store created:', typeof userStore);
  console.log('Registering IPC handlers...');
} catch (error) {
  console.error('Failed to initialize electron-store:', error);
  // Fallback to a simple in-memory store
  console.log('Using fallback in-memory store');
  userStore = {
    data: new Map(),
    get(key) { return this.data.get(key); },
    set(key, value) { this.data.set(key, value); }
  };
  console.log('Registering IPC handlers...');
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../../src/preload/preload.js')
    }
  });

  // Load the renderer process
  // DEBUG: Log __dirname and cwd to help debug path issues
  console.log('__dirname:', __dirname);
  console.log('process.cwd():', process.cwd());
  console.log('Looking for index.html at:', path.join(__dirname, '../src/renderer/index.html'));

  const indexPath = path.join(__dirname, '../src/renderer/index.html');
  console.log('Resolved indexPath:', indexPath);

  // Check if file exists
  const fs = require('fs');
  if (fs.existsSync(indexPath)) {
    console.log('File exists at indexPath');
  } else {
    console.log('File DOES NOT exist at indexPath');
    // Try alternative paths
    const altPath1 = path.join(__dirname, '../../src/renderer/index.html');
    console.log('Trying altPath1:', altPath1);
    if (fs.existsSync(altPath1)) {
      console.log('File exists at altPath1');
      mainWindow.loadFile(altPath1);
      return;
    }

    const altPath2 = path.join(process.cwd(), 'src/renderer/index.html');
    console.log('Trying altPath2:', altPath2);
    if (fs.existsSync(altPath2)) {
      console.log('File exists at altPath2');
      mainWindow.loadFile(altPath2);
      return;
    }

    const altPath3 = '/Users/aaronhsueh/Documents/GitHub/encrypted-chat-app/src/renderer/index.html';
    console.log('Trying altPath3:', altPath3);
    if (fs.existsSync(altPath3)) {
      console.log('File exists at altPath3');
      mainWindow.loadFile(altPath3);
      return;
    }
  }

  mainWindow.loadFile(indexPath);

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Start WebSocket server for local development
function startWebSocketServer() {
  // Create HTTP server (for health checks, etc.)
  server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);

    if (parsedUrl.pathname === '/health') {
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({status: 'ok', timestamp: new Date().toISOString()}));
    } else if (parsedUrl.pathname === '/') {
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end('Encrypted Chat WebSocket Server is running');
    } else {
      res.writeHead(404, {'Content-Type': 'text/plain'});
      res.end('Not Found');
    }
  });

  // Create WebSocket server
  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    // Generate a unique ID for this client
    const clientId = Math.random().toString(36).substring(2, 15);
    const ip = req.socket.remoteAddress;

    console.log(`New WebSocket client connected: ${clientId} from ${ip}`);

    // Store client info
    ws.clientId = clientId;
    ws.ip = ip;
    ws.userId = null; // Will be set after public key exchange
    ws.connectedAt = new Date();

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
            contactPublicKeys.set(data.userId, data.publicKey);
            ws.userId = data.userId;
            // Also store user ID if provided
            if (data.userID) {
              // We could store this in a separate map for user IDs
              // For now, we'll just log it or use it if needed
              console.log(`User ID for ${data.userId}: ${data.userID}`);
            }

            console.log(`Public key exchanged for user: ${data.userId}`);

            // Broadcast to all other clients (key distribution)
            wss.clients.forEach((client) => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'public-key-exchange',
                  userId: data.userId,
                  publicKey: data.publicKey,
                  userID: data.userID || '', // Include user ID if provided
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
                  userID: data.userID || '', // Include user ID if provided
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
      console.log(`WebSocket client disconnected: ${ws.clientId || 'unknown'} (code: ${code})`);

      // Optionally notify other clients about user disconnecting
      // For privacy, we might not want to reveal when specific users disconnect
    });

    // Handle WebSocket errors
    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${ws.clientId}:`, error);
    });
  });

  // Handle server errors
  server.on('error', (error) => {
    console.error('WebSocket server error:', error);
  });

  // Start server
  const PORT = process.env.PORT || 3002; // Changed to 3002 to avoid conflicts
  server.listen(PORT, () => {
    console.log(`WebSocket server running on port ${PORT}`);
    console.log(`Health check available at http://localhost:${PORT}/health`);
  });

  // Return server instance for graceful shutdown
  return { server, wss };
}

// IPC handlers for secure communication with renderer
ipcMain.on('get-public-key', (event) => {
  // In a real implementation, this would retrieve from secure storage
  // For now, we'll generate a placeholder or use a generated key
  event.reply('public-key-response', userPublicKey || '');
});

ipcMain.on('set-public-key', (event, publicKey) => {
  userPublicKey = publicKey;
});

ipcMain.on('add-contact-key', (event, userId, publicKey) => {
  contactPublicKeys.set(userId, publicKey);
});

ipcMain.on('get-contact-key', (event, userId) => {
  const key = contactPublicKeys.get(userId) || '';
  event.reply('contact-key-response', key);
});

ipcMain.on('send-message', (event, messageData) => {
  // Forward encrypted message to WebSocket server
  if (wss) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(messageData));
      }
    });
  }
});

// Test IPC handler
ipcMain.handle('ping', () => {
  console.log('ping handler called');
  return 'pong';
});

// User ID storage IPC handlers
ipcMain.handle('get-userID', async () => {
  console.log('get-userID handler called');
  try {
    const userID = userStore ? userStore.get('userID') || '' : '';
    console.log('get-userID returning:', userID);
    return userID;
  } catch (error) {
    console.error('Error in get-userID handler:', error);
    return '';
  }
});

ipcMain.handle('set-userID', async (event, userID) => {
  console.log('set-userID handler called with:', userID);
  try {
    if (userStore) {
      userStore.set('userID', userID);
      console.log('set-userID succeeded');
      return true; // or just return nothing, the resolve() in renderer will work
    } else {
      console.error('userStore is not available');
      throw new Error('Storage not available');
    }
  } catch (error) {
    console.error('Error in set-userID handler:', error);
    throw error;
  }
});

// App lifecycle events
app.whenReady().then(() => {
  createWindow();

  // Start WebSocket server for local development
  startWebSocketServer();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS, it's common for applications to stay open until quit explicitly
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Clean up WebSocket server
  if (wss) {
    wss.clients.forEach((client) => {
      client.close();
    });
    wss.close();
  }
  if (server) {
    server.close(() => {
      console.log('WebSocket server closed');
    });
  }
});