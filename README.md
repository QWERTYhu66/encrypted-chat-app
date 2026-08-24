# Encrypted Chat App

End-to-end encrypted chat application built with Electron, using RSA/AES encryption and WebSockets for real-time communication.

## Encryption Overview

This application implements a hybrid cryptosystem to ensure that only the sender and receiver can read messages:

### Key Exchange (RSA)
- Each user generates an RSA key pair (2048-bit by default) on first launch
- Public keys are exchanged through the WebSocket server (server only sees encrypted keys)
- Private keys are stored securely using OS-native storage (via `electron-secure-store`)
- Uses RSA-OAEP padding for secure key encryption

### Message Encryption (AES)
- AES-256-GCM for authenticated encryption (provides both confidentiality and integrity)
- Unique 96-bit IV/nonce generated for each message
- Random AES session key generated per conversation
- Session key encrypted with recipient's RSA public key for secure transmission

### Encryption Flow

1. **Initial Setup**:
   - User generates RSA key pair on first application launch
   - Private key stored securely using OS keychain (Windows Credential Locker, macOS Keychain, Linux Secret Service)
   - Public key made available for exchange

2. **Key Exchange**:
   - When connecting, users exchange public keys via WebSocket
   - Server acts as a blind transporter - it cannot decrypt the keys
   - Each user stores peers' public keys with verification status

3. **Message Transmission**:
   - For each message, generate a random AES-256 session key (if not already established)
   - Encrypt the AES key with recipient's RSA public key
   - Generate random IV (96 bits) for AES-GCM
   - Encrypt message content with AES-GCM using the session key and IV
   - Transmit: `{ encryptedAesKey, iv, ciphertext, timestamp, senderId, roomId }`

4. **Message Reception**:
   - Receiver decrypts AES key using their RSA private key
   - Receiver decrypts message content using AES-GCM with the session key and IV
   - Authentication tag in AES-GCM verifies message integrity
   - Decrypted message displayed in UI

### Security Features

- **End-to-End Encryption**: Only sender and receiver can decrypt messages
- **Server Cannot Read Messages**: WebSocket server transports only encrypted payloads
- **Key Verification**: Users can verify key fingerprints to prevent man-in-the-middle attacks
- **Forward Secrecy**: Session keys are rotated periodically
- **Replay Attack Protection**: Unique IV/nonce for each message
- **Tamper Detection**: AES-GCM provides authentication to detect message modification
- **Secure Key Storage**: Private keys never leave the device in plaintext

### Electron-Specific Implementation

- **Main Process**: Handles WebSocket connection and secure key storage
- **Renderer Process**: Handles UI and performs encryption/decryption using Web Crypto API
- **Secure IPC**: Context-isolated communication between processes with validation
- **No Node Integration**: `nodeIntegration: false` and `contextIsolation: true` for security

### Libraries & Standards

- **RSA**: Web Crypto API (RSA-OAEP with SHA-256)
- **AES**: Web Crypto API (AES-GCM with 256-bit key)
- **Key Storage**: `electron-secure-store` (OS-native secure storage)
- **WebSocket**: `socket.io` for reliable real-time communication
- **UI**: React for component-based interface

### Usage

1. Install dependencies: `npm install`
2. Start development server: `npm run dev`
3. For production build: `npm run build` then `npm start`

### Deployment Notes

The WebSocket server's sole responsibility is transporting encrypted messages. It can be deployed to any Node.js hosting service (Heroku, Vercel, Railway, etc.) as it performs no cryptographic operations and cannot access message contents.

For true end-to-end encryption verification:
1. Run two instances of the application
2. Complete key exchange and verification process
3. Send messages between instances
4. Use network inspection tools to verify WebSocket payloads are encrypted
5. Confirm that only the intended recipient can decrypt and display messages

## 📱 Cross-Device Communication

This application is designed to work across different devices and platforms (Windows, macOS, Linux). To communicate between devices:

1. Ensure both devices can connect to the same WebSocket server
2. Complete the key exchange process on each device
3. Verify key fingerprints through a secure channel (in-person, phone call, etc.)
4. Begin encrypted communication

The encryption ensures that even if messages are intercepted or the server is compromised, the content remains confidential to only the communicating parties.

---

*Built with Electron, React, and modern Web Cryptography APIs*