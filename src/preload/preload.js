// Preload script for secure IPC communication
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Public key management
  getPublicKey: () => ipcRenderer.invoke('get-public-key'),
  setPublicKey: (publicKey) => ipcRenderer.send('set-public-key', publicKey),

  // Contact key management
  addContactKey: (userId, publicKey) => ipcRenderer.send('add-contact-key', userId, publicKey),
  getContactKey: (userId) => ipcRenderer.invoke('get-contact-key', userId),

  // User ID management
  getUserID: () => ipcRenderer.invoke('get-userID'),
  setUserID: (userID) => ipcRenderer.invoke('set-userID', userID),

  // Messaging
  sendMessage: (messageData) => ipcRenderer.send('send-message', messageData),

  // Event listeners (for renderer to listen to main process events)
  onPublicKeyResponse: (callback) => ipcRenderer.on('public-key-response', (event, key) => callback(key)),
  onContactKeyResponse: (callback) => ipcRenderer.on('contact-key-response', (event, key) => callback(key)),
  onContactKeyReceived: (callback) => ipcRenderer.on('contact-key-received', (event, data) => callback(data)),
  onReceivedEncryptedMessage: (callback) => ipcRenderer.on('received-encrypted-message', (event, message) => callback(message)),
  onConnectionStatus: (callback) => ipcRenderer.on('connection-status', (event, status) => callback(status)),
  onUserIDResult: (callback) => ipcRenderer.on('userID-result', (event, userID) => callback(userID)),
  onUserIDSet: (callback) => ipcRenderer.on('userID-set', (event) => callback()),

  // Remove listeners (to prevent memory leaks)
  removePublicKeyListener: (callback) => ipcRenderer.removeListener('public-key-response', callback),
  removeContactKeyListener: (callback) => ipcRenderer.removeListener('contact-key-response', callback),
  removeContactKeyReceivedListener: (callback) => ipcRenderer.removeListener('contact-key-received', callback),
  removeReceivedEncryptedMessageListener: (callback) => ipcRenderer.removeListener('received-encrypted-message', callback),
  removeConnectionStatusListener: (callback) => ipcRenderer.removeListener('connection-status', callback),
  removeUserIDResultListener: (callback) => ipcRenderer.removeListener('userID-result', callback),
  removeUserIDSetListener: (callback) => ipcRenderer.removeListener('userID-set', callback)
});

// Utility functions for base64 encoding/decoding (needed for crypto operations)
contextBridge.exposeInMainWorld('cryptoUtils', {
  arrayBufferToBase64: (arrayBuffer) => {
    return btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
  },

  base64ToArrayBuffer: (base64) => {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
});