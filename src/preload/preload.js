const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getPublicKey: () => ipcRenderer.invoke('get-public-key'),
  setPublicKey: (publicKey) => ipcRenderer.send('set-public-key', publicKey),

  addContactKey: (userId, publicKey) => ipcRenderer.send('add-contact-key', userId, publicKey),
  getContactKey: (userId) => ipcRenderer.invoke('get-contact-key', userId),

  getUserID: () => ipcRenderer.invoke('get-userID'),
  setUserID: (userID) => ipcRenderer.invoke('set-userID', userID),

  sendMessage: (messageData) => ipcRenderer.send('send-message', messageData),

  onPublicKeyResponse: (callback) => {
    const listener = (event, key) => callback(key);
    ipcRenderer.on('public-key-response', listener);
    return () => ipcRenderer.removeListener('public-key-response', listener);
  },
  onReceivedEncryptedMessage: (callback) => {
    const listener = (event, message) => callback(message);
    ipcRenderer.on('received-encrypted-message', listener);
    return () => ipcRenderer.removeListener('received-encrypted-message', listener);
  },
  onConnectionStatus: (callback) => {
    const listener = (event, status) => callback(status);
    ipcRenderer.on('connection-status', listener);
    return () => ipcRenderer.removeListener('connection-status', listener);
  },
  onUserIDResult: (callback) => {
    const listener = (event, userID) => callback(userID);
    ipcRenderer.on('userID-result', listener);
    return () => ipcRenderer.removeListener('userID-result', listener);
  },
  onUserIDSet: (callback) => {
    const listener = (event) => callback();
    ipcRenderer.on('userID-set', listener);
    return () => ipcRenderer.removeListener('userID-set', listener);
  }
});

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
