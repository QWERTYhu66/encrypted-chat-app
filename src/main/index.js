const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');

let mainWindow;
let wss = null;
let server = null;
let userPublicKey = null;
const contactPublicKeys = new Map();

let userStore;
try {
  const StoreModule = require('electron-store');
  const StoreClass = StoreModule.default || StoreModule;
  userStore = new StoreClass();
} catch (error) {
  console.error('Failed to initialize electron-store:', error);
  userStore = {
    data: new Map(),
    get(key) { return this.data.get(key); },
    set(key, value) { this.data.set(key, value); },
    has(key) { return this.data.has(key); },
    delete(key) { this.data.delete(key); }
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../src/preload/preload.js')
    }
  });

  const indexPath = path.join(__dirname, '../src/renderer/index.html');
  const altPath = path.join(process.cwd(), 'src/renderer/index.html');

  if (fs.existsSync(indexPath)) {
    mainWindow.loadFile(indexPath);
  } else if (fs.existsSync(altPath)) {
    mainWindow.loadFile(altPath);
  } else {
    console.error('Could not find index.html');
  }

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startWebSocketServer() {
  server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

    if (parsedUrl.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    } else if (parsedUrl.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Encrypted Chat WebSocket Server is running');
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });

  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    const clientId = Math.random().toString(36).substring(2, 15);
    const ip = req.socket.remoteAddress;

    console.log(`New WebSocket client connected: ${clientId} from ${ip}`);

    ws.clientId = clientId;
    ws.ip = ip;
    ws.userId = null;
    ws.connectedAt = new Date();

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
            contactPublicKeys.set(data.userId, data.publicKey);
            ws.userId = data.userId;

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
      console.log(`WebSocket client disconnected: ${ws.clientId || 'unknown'} (code: ${code})`);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${ws.clientId}:`, error);
    });
  });

  server.on('error', (error) => {
    console.error('WebSocket server error:', error);
  });

  const PORT = process.env.PORT || 3002;
  server.listen(PORT, () => {
    console.log(`WebSocket server running on port ${PORT}`);
  });

  return { server, wss };
}

// IPC handlers using invoke/handle for async operations
ipcMain.handle('get-public-key', () => {
  return userPublicKey || '';
});

ipcMain.on('set-public-key', (event, publicKey) => {
  userPublicKey = publicKey;
});

ipcMain.on('add-contact-key', (event, userId, publicKey) => {
  contactPublicKeys.set(userId, publicKey);
});

ipcMain.handle('get-contact-key', (event, userId) => {
  return contactPublicKeys.get(userId) || '';
});

ipcMain.on('send-message', (event, messageData) => {
  if (wss) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(messageData));
      }
    });
  }
});

ipcMain.handle('ping', () => {
  return 'pong';
});

ipcMain.handle('get-userID', async () => {
  try {
    return userStore ? userStore.get('userID') || '' : '';
  } catch (error) {
    console.error('Error in get-userID handler:', error);
    return '';
  }
});

ipcMain.handle('set-userID', async (event, userID) => {
  try {
    if (userStore) {
      userStore.set('userID', userID);
      return true;
    } else {
      throw new Error('Storage not available');
    }
  } catch (error) {
    console.error('Error in set-userID handler:', error);
    throw error;
  }
});

app.whenReady().then(() => {
  createWindow();
  startWebSocketServer();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
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
