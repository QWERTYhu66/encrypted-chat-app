// Renderer process JavaScript for the encrypted chat app
console.log('Renderer index.js loaded');

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded event fired');
    // DOM elements
    const loginContainer = document.getElementById('login-container');
    const chatContainer = document.getElementById('chat-container');
    const statusElement = document.getElementById('status');
    const initBtn = document.getElementById('init-btn');
    const connectionStatusElement = document.getElementById('connection-status');
    const messagesContainer = document.getElementById('messages-container');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const settingsBtn = document.getElementById('settings-btn');

    console.log('DOM elements retrieved:', {
        loginContainer: !!loginContainer,
        chatContainer: !!chatContainer,
        statusElement: !!statusElement,
        initBtn: !!initBtn,
        connectionStatusElement: !!connectionStatusElement,
        messagesContainer: !!messagesContainer,
        messageInput: !!messageInput,
        sendBtn: !!sendBtn,
        settingsBtn: !!settingsBtn
    });

    // State
    let currentUserId = null;
    let currentUserPublicKey = null;
    let currentUserPrivateKey = null; // Will be stored securely, not exposed to renderer
    let userID = null; // Persistent user ID chosen by the user

    console.log('Initial state:', { currentUserId, currentUserPublicKey, currentUserPrivateKey, userID });

    // Set up listeners for IPC events from main process
    console.log('Setting up IPC listeners');
    window.electronAPI.onPublicKeyResponse((publicKey) => {
        console.log('Received public key response:', publicKey);
        // In a real app, we might use this for key exchange
    });

    window.electronAPI.onReceivedEncryptedMessage((message) => {
        console.log('Received encrypted message:', message);
        // In a real app, we would decrypt this message
        // For demo, we'll simulate decryption
        simulateReceiveMessage(message);
    });

    window.electronAPI.onConnectionStatus((status) => {
        console.log('Received connection status:', status);
        updateConnectionStatus(status);
    });

    // Handle incoming user ID result from main process
    window.electronAPI.onUserIDResult((userIDFromStorage) => {
        // This is called when we request the user ID
        console.log('Received userID from storage:', userIDFromStorage);
        if (userIDFromStorage && !userID) { // Only set if we don't already have one from storage
            userID = userIDFromStorage;
            console.log('Set userID from storage:', userID);
        }
    });

    // Handle user ID set confirmation from main process
    window.electronAPI.onUserIDSet(() => {
        // User ID has been successfully stored
        console.log('User ID set confirmation received');
    });

    // Initialize the app automatically on page load
    console.log('Calling initializeApp()');
    initializeApp();

    // Send message handler
    console.log('Setting up send button listener');
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Settings button handler
    console.log('Setting up settings button listener');
    settingsBtn.addEventListener('click', openUserIDSettings);
});

    
    // Show user ID setup screen
    function showUserIDSetup() {
        return new Promise((resolve, reject) => {
            // Create setup container if it doesn't exist
            let setupContainer = document.getElementById('userID-setup-container');
            if (!setupContainer) {
                setupContainer = document.createElement('div');
                setupContainer.id = 'userID-setup-container';
                setupContainer.innerHTML = `
                    <div class="userID-setup">
                        <h2>Welcome to Encrypted Chat</h2>
                        <p>Please choose a user ID that others will see:</p>
                        <input type="text" id="userID-input" placeholder="Enter your user ID" maxlength="20" />
                        <button id="userID-submit">Continue</button>
                        <div id="userID-error" class="error-message" style="display: none; color: #e74c3c;"></div>
                    </div>
                `;
                // Style the setup container
                setupContainer.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: #ecf0f1;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                `;

                // Style the userID-setup div
                const userIDSetupDiv = setupContainer.querySelector('.userID-setup');
                userIDSetupDiv.style.cssText = `
                    background: white;
                    padding: 2rem;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    text-align: center;
                    width: 300px;
                `;

                // Style the input
                const input = setupContainer.querySelector('#userID-input');
                input.style.cssText = `
                    width: 100%;
                    padding: 0.5rem;
                    margin: 1rem 0;
                    border: 1px solid #bdc3c7;
                    border-radius: 4px;
                    font-size: 1rem;
                `;

                // Style the button
                const button = setupContainer.querySelector('#userID-submit');
                button.style.cssText = `
                    background-color: #3498db;
                    color: white;
                    border: none;
                    padding: 0.5rem 1rem;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 1rem;
                `;

                button.addEventListener('mouseover', () => {
                    button.style.backgroundColor = '#2c80b9';
                });

                button.addEventListener('mouseout', () => {
                    button.style.backgroundColor = '#3498db';
                });

                document.body.appendChild(setupContainer);

                // Handle submit button click
                button.addEventListener('click', () => {
                    const input = setupContainer.querySelector('#userID-input');
                    const errorDiv = setupContainer.querySelector('#userID-error');
                    const userIDValue = input.value.trim();

                    // Basic validation
                    if (!userIDValue) {
                        errorDiv.textContent = 'Please enter a user ID';
                        errorDiv.style.display = 'block';
                        reject(new Error('Please enter a user ID'));
                        return;
                    }

                    if (userIDValue.length < 2) {
                        errorDiv.textContent = 'User ID must be at least 2 characters';
                        errorDiv.style.display = 'block';
                        reject(new Error('User ID must be at least 2 characters'));
                        return;
                    }

                    // Store the user ID
                    storeUserID(userIDValue).then(() => {
                        userID = userIDValue;
                        // Hide the setup container
                        setupContainer.style.display = 'none';
                        resolve();
                    }).catch((err) => {
                        errorDiv.textContent = 'Failed to save user ID: ' + err.message;
                        errorDiv.style.display = 'block';
                        reject(new Error('Failed to save user ID: ' + err.message));
                    });
                });

                // Handle Enter key in input
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        button.click();
                    }
                });
            } else {
                // Container exists, just show it
                setupContainer.style.display = 'flex';
            }

            // Focus the input
            setTimeout(() => {
                const input = setupContainer.querySelector('#userID-input');
                input.focus();
            }, 100);
        });
    }

    // Initialize the application
    async function initializeApp() {
        console.log('initializeApp() called');
        statusElement.textContent = 'Initializing...';
        initBtn.disabled = true;

        try {
            // Check for stored user ID first
            console.log('Checking for stored user ID');
            const storedUserID = await getStoredUserID();
            console.log('Stored user ID:', storedUserID);
            if (storedUserID) {
                userID = storedUserID;
                statusElement.textContent = 'User ID loaded. Generating RSA key pair...';
            } else {
                // No user ID stored, prompt for it
                console.log('No stored user ID found, showing setup');
                await showUserIDSetup();
                // After user ID is set, continue with initialization
                statusElement.textContent = 'User ID set. Generating RSA key pair...';
            }

            // Generate RSA key pair for the user
            console.log('Generating user keys');
            await generateUserKeys();
            statusElement.textContent = 'Keys generated. Setting up secure storage...';
            // In a real app, we would store the private key securely using electron-secure-store
            // For now, we'll keep it in memory (not secure, but ok for demo)
            await setupSecureStorage();

            // Notify main process about our public key and user ID
            console.log('Setting public key and user ID in main process');
            window.electronAPI.setPublicKey(currentUserPublicKey);
            // Also notify about our user ID
            window.electronAPI.setUserID(userID);
            statusElement.textContent = 'Secure storage ready. Exchanging public keys...';
            await exchangePublicKeys();

            statusElement.textContent = 'Public keys exchanged. Starting chat...';
            // Show chat interface
            loginContainer.style.display = 'none';
            chatContainer.style.display = 'flex';

            // Update connection status
            console.log('Updating connection status to connected');
            updateConnectionStatus('connected');
            console.log('App initialization complete');
        } catch (error) {
            console.error('Initialization error:', error);
            statusElement.textContent = `Initialization failed: ${error.message}`;
            initBtn.disabled = false;
        }
    }

    // Generate RSA key pair for the user
    async function generateUserKeys() {
        statusElement.textContent = 'Generating RSA key pair...';

        // In a real implementation, we would use the Web Crypto API
        // This is a placeholder that simulates key generation
        // For a real implementation, we would use:
        // crypto.subtle.generateKey({name: "RSA-OAEP", modulusLength: 2048, ...})

        // Simulate key generation delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Generate mock keys for demo purposes
        // In reality, these would be actual CryptoKey objects
        currentUserId = 'user-' + Math.random().toString(36).substr(2, 9);
        currentUserPublicKey = 'mock-public-key-' + currentUserId;
        currentUserPrivateKey = 'mock-private-key-' + currentUserId; // NEVER expose this in real app!

        console.log('Generated keys for user:', currentUserId);
    }

    // Setup secure storage (placeholder)
    function setupSecureStorage() {
        // In a real app, we would initialize electron-secure-store here
        // For demo, we'll just return a resolved promise
        return Promise.resolve();
    }

    // Exchange public keys with other users - now includes user ID
    function exchangePublicKeys() {
        // In a real app, this would happen automatically when connecting to the WebSocket server
        // For demo, we'll just resolve immediately since we don't need to simulate contacts for a forum
        return Promise.resolve();
    }

    // Get user ID from storage
    async function getStoredUserID() {
        console.log('Calling getUserID via electronAPI');
        try {
            const result = await window.electronAPI.getUserID();
            console.log('getUserID result:', result);
            return result;
        } catch (error) {
            console.error('Error in getUserID:', error);
            throw error;
        }
    }

    // Store user ID
    async function storeUserID(id) {
        console.log('Calling setUserID via electronAPI with:', id);
        try {
            await window.electronAPI.setUserID(id);
            console.log('setUserID succeeded');
        } catch (error) {
            console.error('Error in setUserID:', error);
            throw error;
        }
    }

    // Send a message
    function sendMessage() {
        const messageText = messageInput.value.trim();
        if (!messageText) {
            return;
        }

        // Disable input while sending
        messageInput.disabled = true;
        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending...';

        // In a real implementation, we would:
        // 1. Get or generate AES session key for this conversation
        // 2. Encrypt the message with AES-GCM
        // 3. Encrypt the AES key with recipient's RSA public key
        // 4. Send the encrypted package via WebSocket

        // For demo, we'll simulate sending an encrypted message
        // and also send it via WebSocket for other clients to receive
        simulateSendMessage(messageText)
            .then(() => {
                // Clear input and re-enable
                messageInput.value = '';
                messageInput.disabled = false;
                sendBtn.disabled = false;
                sendBtn.textContent = 'Send';
                messageInput.focus();
            })
            .catch((error) => {
                console.error('Error sending message:', error);
                messageInput.disabled = false;
                sendBtn.disabled = false;
                sendBtn.textContent = 'Send';
                alert('Failed to send message: ' + error.message);
            });

        // Also send via WebSocket for actual client-to-client communication
        // In a real app, this would contain the encrypted message
        // For demo, we'll send a structured object with userID
        window.electronAPI.sendMessage({
            type: 'demo-message',
            content: messageText,
            userID: userID,
            timestamp: new Date().toISOString()
        });
    }

    // Simulate sending an encrypted message
    function simulateSendMessage(messageText) {
        return new Promise((resolve) => {
            // Simulate network delay
            setTimeout(() => {
                // Add message to UI as sent - pass our userID
                addMessageToUI(messageText, true, userID);

                // Simulate receiving an echo (in real app, this would come from another user in the forum)
                setTimeout(() => {
                    addMessageToUI(messageText, false, userID); // Echo from same user for demo
                }, 800);

                resolve();
            }, 600);
        });
    }

    // Add message to UI
    function addMessageToUI(text, isSent, senderUserID = null) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        messageDiv.classList.add(isSent ? 'sent' : 'received');

        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');
        contentDiv.textContent = text;

        const metaDiv = document.createElement('div');
        metaDiv.classList.add('message-meta');
        if (isSent) {
            // Show our own userID for sent messages
            metaDiv.textContent = userID || 'You';
        } else if (senderUserID) {
            // Show sender's userID for received messages if available
            metaDiv.textContent = senderUserID;
        } else {
            // Fallback to 'User' for forum-like interface when no userID available
            metaDiv.textContent = 'User';
        }
        metaDiv.textContent += ' • ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(metaDiv);

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Update connection status UI
    function updateConnectionStatus(status) {
        connectionStatusElement.textContent =
            status === 'connected' ? 'Connected' : 'Disconnected';
        connectionStatusElement.className = 'connection-status ' +
            (status === 'connected' ? 'connected' : 'disconnected');
    }

    
    
    
    
    // Open user ID settings modal
    function openUserIDSettings() {
        const modal = document.getElementById('userID-settings-modal');
        const input = document.getElementById('new-userID-input');
        const errorDiv = document.getElementById('userID-settings-error');

        // Set current value
        input.value = userID || '';
        errorDiv.style.display = 'none';

        // Show modal
        modal.style.display = 'block';

        // Focus input
        input.focus();
    }

    // Close user ID settings modal
    function closeUserIDSettings() {
        const modal = document.getElementById('userID-settings-modal');
        modal.style.display = 'none';
    }

    // Save new user ID from settings
    function saveUserIDFromSettings() {
        const input = document.getElementById('new-userID-input');
        const errorDiv = document.getElementById('userID-settings-error');
        const newUserID = input.value.trim();

        // Basic validation
        if (!newUserID) {
            errorDiv.textContent = 'Please enter a user ID';
            errorDiv.style.display = 'block';
            return;
        }

        if (newUserID.length < 2) {
            errorDiv.textContent = 'User ID must be at least 2 characters';
            errorDiv.style.display = 'block';
            return;
        }

        // Store the new user ID
        storeUserID(newUserID).then(() => {
            // Update our userID
            userID = newUserID;

            // Close the modal
            closeUserIDSettings();

            // Notify main process about our user ID change
            window.electronAPI.setUserID(userID);

            // Update UI to show new user ID
            // Update connection status or show a brief notification
            statusElement.textContent = `User ID updated to ${userID}`;
            setTimeout(() => {
                statusElement.textContent = updateConnectionStatus('connected') ? 'Connected' : 'Disconnected';
            }, 1500);

        }).catch((err) => {
            errorDiv.textContent = 'Failed to save user ID: ' + err.message;
            errorDiv.style.display = 'block';
        });
    }

    // Set up listeners for IPC events from main process
    window.electronAPI.onPublicKeyResponse((publicKey) => {
        console.log('Received public key response:', publicKey);
        // In a real app, we might use this for key exchange
    });

    
    window.electronAPI.onReceivedEncryptedMessage((message) => {
        console.log('Received encrypted message:', message);
        // In a real app, we would decrypt this message
        // For demo, we'll simulate decryption
        simulateReceiveMessage(message);
    });

    window.electronAPI.onConnectionStatus((status) => {
        updateConnectionStatus(status);
    });

    // Simulate receiving and decrypting a message
    function simulateReceiveMessage(message) {
        // In a real app, we would:
        // 1. Decrypt the AES key using our RSA private key
        // 2. Decrypt the message content using the AES key
        // 3. Display the decrypted message

        // For demo, we'll just show a simulated message
        setTimeout(() => {
            // Extract sender's userID from the message (if available)
            const senderUserID = message.userID || null;
            // For display, show the userID or a fallback
            const senderDisplay = senderUserID || `User ${message.senderId?.substring(0, 8) || 'unknown'}`;

            // For demo purposes, we'll show the sender's userID but in a real app this would be decrypted content
            addMessageToUI(`[From ${senderDisplay}] ${message.content || '[encrypted content]'}`, false, senderUserID);
        }, 600 + Math.random() * 1000); // Random delay to simulate network
    }

    // Clean up listeners when component unloads (not needed in Electron but good practice)
    window.addEventListener('beforeunload', () => {
        window.electronAPI.removePublicKeyListener(() => {});
        window.electronAPI.removeContactKeyListener(() => {});
        window.electronAPI.removeContactKeyReceivedListener(() => {});
        window.electronAPI.removeReceivedEncryptedMessageListener(() => {});
        window.electronAPI.removeConnectionStatusListener(() => {});
        window.electronAPI.removeUserIDResultListener(() => {});
        window.electronAPI.removeUserIDSetListener(() => {});
    });

    
    // Modal event listeners
    document.getElementById('cancel-userID-btn').addEventListener('click', closeUserIDSettings);
    document.getElementById('save-userID-btn').addEventListener('click', saveUserIDFromSettings);
    document.getElementById('userID-settings-modal').querySelector('.close-btn').addEventListener('click', closeUserIDSettings);

    // Handle Enter key in settings modal
    document.getElementById('new-userID-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveUserIDFromSettings();
        }
    });

    
    
    