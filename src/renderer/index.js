console.log('Renderer index.js loaded');

let currentUserId = null;
let currentUserPublicKey = null;
let currentUserPrivateKey = null;
let userID = null;

const cleanupFns = [];

function init() {
    const loginContainer = document.getElementById('login-container');
    const chatContainer = document.getElementById('chat-container');
    const statusElement = document.getElementById('status');
    const initBtn = document.getElementById('init-btn');
    const connectionStatusElement = document.getElementById('connection-status');
    const messagesContainer = document.getElementById('messages-container');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const settingsBtn = document.getElementById('settings-btn');

    cleanupFns.push(
        window.electronAPI.onPublicKeyResponse((publicKey) => {
            console.log('Received public key response:', publicKey);
        })
    );

    cleanupFns.push(
        window.electronAPI.onReceivedEncryptedMessage((message) => {
            console.log('Received encrypted message:', message);
            simulateReceiveMessage(message);
        })
    );

    cleanupFns.push(
        window.electronAPI.onConnectionStatus((status) => {
            updateConnectionStatus(status);
        })
    );

    cleanupFns.push(
        window.electronAPI.onUserIDResult((userIDFromStorage) => {
            if (userIDFromStorage && !userID) {
                userID = userIDFromStorage;
            }
        })
    );

    cleanupFns.push(
        window.electronAPI.onUserIDSet(() => {
            console.log('User ID set confirmation received');
        })
    );

    function showUserIDSetup() {
        return new Promise((resolve, reject) => {
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

                const userIDSetupDiv = setupContainer.querySelector('.userID-setup');
                userIDSetupDiv.style.cssText = `
                    background: white;
                    padding: 2rem;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    text-align: center;
                    width: 300px;
                `;

                const input = setupContainer.querySelector('#userID-input');
                input.style.cssText = `
                    width: 100%;
                    padding: 0.5rem;
                    margin: 1rem 0;
                    border: 1px solid #bdc3c7;
                    border-radius: 4px;
                    font-size: 1rem;
                `;

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

                button.addEventListener('click', () => {
                    const input = setupContainer.querySelector('#userID-input');
                    const errorDiv = setupContainer.querySelector('#userID-error');
                    const userIDValue = input.value.trim();

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

                    storeUserID(userIDValue).then(() => {
                        userID = userIDValue;
                        setupContainer.style.display = 'none';
                        resolve();
                    }).catch((err) => {
                        errorDiv.textContent = 'Failed to save user ID: ' + err.message;
                        errorDiv.style.display = 'block';
                        reject(new Error('Failed to save user ID: ' + err.message));
                    });
                });

                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        button.click();
                    }
                });
            } else {
                setupContainer.style.display = 'flex';
            }

            setTimeout(() => {
                const input = setupContainer.querySelector('#userID-input');
                input.focus();
            }, 100);
        });
    }

    async function initializeApp() {
        statusElement.textContent = 'Initializing...';
        initBtn.disabled = true;

        try {
            const storedUserID = await getStoredUserID();
            if (storedUserID) {
                userID = storedUserID;
                statusElement.textContent = 'User ID loaded. Generating RSA key pair...';
            } else {
                await showUserIDSetup();
                statusElement.textContent = 'User ID set. Generating RSA key pair...';
            }

            await generateUserKeys();
            statusElement.textContent = 'Keys generated. Setting up secure storage...';
            await setupSecureStorage();

            window.electronAPI.setPublicKey(currentUserPublicKey);
            statusElement.textContent = 'Secure storage ready. Exchanging public keys...';
            await exchangePublicKeys();

            statusElement.textContent = 'Public keys exchanged. Starting chat...';
            loginContainer.style.display = 'none';
            chatContainer.style.display = 'flex';

            updateConnectionStatus('connected');
        } catch (error) {
            console.error('Initialization error:', error);
            statusElement.textContent = `Initialization failed: ${error.message}`;
            initBtn.disabled = false;
        }
    }

    async function generateUserKeys() {
        statusElement.textContent = 'Generating RSA key pair...';
        await new Promise(resolve => setTimeout(resolve, 1000));

        currentUserId = 'user-' + Math.random().toString(36).substr(2, 9);
        currentUserPublicKey = 'mock-public-key-' + currentUserId;
        currentUserPrivateKey = 'mock-private-key-' + currentUserId;
    }

    function setupSecureStorage() {
        return Promise.resolve();
    }

    function exchangePublicKeys() {
        return Promise.resolve();
    }

    async function getStoredUserID() {
        try {
            return await window.electronAPI.getUserID();
        } catch (error) {
            console.error('Error in getUserID:', error);
            return '';
        }
    }

    async function storeUserID(id) {
        try {
            await window.electronAPI.setUserID(id);
        } catch (error) {
            console.error('Error in setUserID:', error);
            throw error;
        }
    }

    function sendMessage() {
        const messageText = messageInput.value.trim();
        if (!messageText) return;

        messageInput.disabled = true;
        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending...';

        simulateSendMessage(messageText)
            .then(() => {
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

        window.electronAPI.sendMessage({
            type: 'demo-message',
            content: messageText,
            userID: userID,
            timestamp: new Date().toISOString()
        });
    }

    function simulateSendMessage(messageText) {
        return new Promise((resolve) => {
            setTimeout(() => {
                addMessageToUI(messageText, true, userID);
                setTimeout(() => {
                    addMessageToUI(messageText, false, userID);
                }, 800);
                resolve();
            }, 600);
        });
    }

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
            metaDiv.textContent = userID || 'You';
        } else if (senderUserID) {
            metaDiv.textContent = senderUserID;
        } else {
            metaDiv.textContent = 'User';
        }
        metaDiv.textContent += ' \u2022 ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(metaDiv);

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function updateConnectionStatus(status) {
        connectionStatusElement.textContent =
            status === 'connected' ? 'Connected' : 'Disconnected';
        connectionStatusElement.className = 'connection-status ' +
            (status === 'connected' ? 'connected' : 'disconnected');
    }

    function openUserIDSettings() {
        const modal = document.getElementById('userID-settings-modal');
        const input = document.getElementById('new-userID-input');
        const errorDiv = document.getElementById('userID-settings-error');

        input.value = userID || '';
        errorDiv.style.display = 'none';
        modal.style.display = 'block';
        input.focus();
    }

    function closeUserIDSettings() {
        document.getElementById('userID-settings-modal').style.display = 'none';
    }

    function saveUserIDFromSettings() {
        const input = document.getElementById('new-userID-input');
        const errorDiv = document.getElementById('userID-settings-error');
        const newUserID = input.value.trim();

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

        storeUserID(newUserID).then(() => {
            userID = newUserID;
            closeUserIDSettings();
            window.electronAPI.setUserID(userID);
            statusElement.textContent = `User ID updated to ${userID}`;
            setTimeout(() => {
                updateConnectionStatus('connected');
            }, 1500);
        }).catch((err) => {
            errorDiv.textContent = 'Failed to save user ID: ' + err.message;
            errorDiv.style.display = 'block';
        });
    }

    function simulateReceiveMessage(message) {
        setTimeout(() => {
            const senderUserID = message.userID || null;
            addMessageToUI(message.content || '[encrypted content]', false, senderUserID);
        }, 600 + Math.random() * 1000);
    }

    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    settingsBtn.addEventListener('click', openUserIDSettings);

    document.getElementById('cancel-userID-btn').addEventListener('click', closeUserIDSettings);
    document.getElementById('save-userID-btn').addEventListener('click', saveUserIDFromSettings);
    document.getElementById('userID-settings-modal').querySelector('.close-btn').addEventListener('click', closeUserIDSettings);
    document.getElementById('new-userID-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveUserIDFromSettings();
    });

    initializeApp();
}

document.addEventListener('DOMContentLoaded', init);

window.addEventListener('beforeunload', () => {
    cleanupFns.forEach((fn) => fn());
});
