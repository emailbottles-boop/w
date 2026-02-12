// ============================================
// NETWORKING - PeerJS & Connections
// ============================================

let peer = null;
let isDM = false;
let myId = null;
let myName = null;
let roomCode = null;
let connections = new Map();
let pendingRequests = [];

function createRoom() {
    isDM = true;
    myName = 'Dungeon Master';
    peer = new Peer();
    
    peer.on('open', (id) => {
        myId = roomCode = id;
        
        // Initialize game state
        initializeGameState();
        
        // Update UI
        document.getElementById('welcomeScreen').classList.add('hidden');
        document.getElementById('connectionTabContainer').style.display = 'block';
        document.getElementById('roomCodeSection').style.display = 'block';
        document.getElementById('roomCode').textContent = roomCode;
        document.getElementById('dmControlsBtn').style.display = 'block';
        document.getElementById('stagingZone').style.display = 'flex';
        
        updateConnectionStatus('Connected as DM', true);
        updateUserList();
        
        alert('✅ Room Created!\n\nRoom Code: ' + id + '\n\nShare this code with your players.\n\nYou can rejoin within 5 minutes if you refresh!');
        
        peer.on('connection', (conn) => setupConnection(conn));
        
        // Start session persistence
        startSessionTimeout();
        saveSessionData();
        
        console.log('✅ DM Room Created:', id);
    });
    
    peer.on('error', (err) => {
        console.error('Peer error:', err);
        alert('Connection error: ' + err.type);
    });
}

function setupConnection(conn) {
    console.log('New connection:', conn.peer);
    
    connections.set(conn.peer, {
        conn: conn,
        name: 'Unknown',
        role: 'player',
        approved: false
    });
    
    conn.on('data', (data) => handleMessage(conn, data));
    
    conn.on('close', () => {
        console.log('Connection closed:', conn.peer);
        connections.delete(conn.peer);
        updateUserList();
        updateSessionTimeout();
    });
    
    conn.on('error', (err) => {
        console.error('Connection error:', err);
    });
}

function handleMessage(conn, data) {
    console.log('Received message:', data.type);
    
    switch(data.type) {
        case 'playerJoinRequest':
            handleJoinRequest(conn, data);
            break;
            
        case 'playerJoinApproved':
            handleJoinApproved(data);
            break;
            
        case 'playerJoinDenied':
            handleJoinDenied(data);
            break;
            
        case 'tokenPlace':
            handleTokenPlace(data);
            break;
            
        case 'tokenMove':
            handleTokenMove(data);
            break;
            
        case 'tokenRemove':
            handleTokenRemove(data);
            break;
            
        case 'gridUpdate':
            handleGridUpdate(data);
            break;
            
        case 'fogUpdate':
            handleFogUpdate(data);
            break;
            
        case 'fullStateSync':
            handleFullStateSync(data);
            break;
            
        case 'zoomPanUpdate':
            handleZoomPanUpdate(data);
            break;
            
        default:
            console.log('Unknown message type:', data.type);
    }
}

function handleJoinRequest(conn, data) {
    if (!isDM) return;
    
    const request = {
        peerId: data.peerId,
        name: data.name,
        conn: conn,
        timestamp: Date.now()
    };
    
    pendingRequests.push(request);
    renderPendingRequests();
    
    // Show notification
    showNotification(`${data.name} wants to join`, 'info');
}

function approvePlayer(peerId) {
    const requestIndex = pendingRequests.findIndex(r => r.peerId === peerId);
    if (requestIndex === -1) return;
    
    const request = pendingRequests[requestIndex];
    pendingRequests.splice(requestIndex, 1);
    
    // Update connection info
    if (connections.has(request.conn.peer)) {
        const connInfo = connections.get(request.conn.peer);
        connInfo.name = request.name;
        connInfo.approved = true;
    }
    
    // Send approval with full game state
    sendToPeer(request.conn, {
        type: 'playerJoinApproved',
        name: request.name,
        gameState: getFullGameState()
    });
    
    updateUserList();
    renderPendingRequests();
    showNotification(`${request.name} joined the game`, 'success');
}

function denyPlayer(peerId) {
    const requestIndex = pendingRequests.findIndex(r => r.peerId === peerId);
    if (requestIndex === -1) return;
    
    const request = pendingRequests[requestIndex];
    pendingRequests.splice(requestIndex, 1);
    
    sendToPeer(request.conn, {
        type: 'playerJoinDenied',
        reason: 'DM denied your request'
    });
    
    request.conn.close();
    renderPendingRequests();
}

function handleJoinApproved(data) {
    myName = data.name;
    
    // Load game state
    if (data.gameState) {
        loadFullGameState(data.gameState);
    }
    
    updateConnectionStatus(`Connected as ${myName}`, true);
    showNotification('You have joined the game!', 'success');
}

function handleJoinDenied(data) {
    alert('Join request denied: ' + (data.reason || 'Unknown reason'));
    location.reload();
}

function broadcastToPlayers(data) {
    connections.forEach((connInfo) => {
        if (connInfo.approved) {
            sendToPeer(connInfo.conn, data);
        }
    });
}

function sendToPeer(conn, data) {
    try {
        conn.send(data);
    } catch (err) {
        console.error('Failed to send message:', err);
    }
}

function updateConnectionStatus(message, connected) {
    const indicator = document.querySelector('.connection-indicator');
    const statusText = document.querySelector('.connection-status-text');
    
    if (indicator) {
        if (connected) {
            indicator.classList.add('connected');
        } else {
            indicator.classList.remove('connected');
        }
    }
    
    if (statusText) {
        statusText.textContent = message;
    }
}

function updateUserList() {
    const userList = document.getElementById('userList');
    if (!userList) return;
    
    userList.innerHTML = '';
    
    // Add DM
    if (isDM) {
        const dmItem = document.createElement('div');
        dmItem.className = 'user-item';
        dmItem.innerHTML = `
            <span>${myName}</span>
            <span class="user-role">DM</span>
        `;
        userList.appendChild(dmItem);
    }
    
    // Add approved players
    connections.forEach((connInfo) => {
        if (connInfo.approved) {
            const playerItem = document.createElement('div');
            playerItem.className = 'user-item';
            playerItem.innerHTML = `
                <span>${connInfo.name}</span>
                <span class="user-role">Player</span>
            `;
            userList.appendChild(playerItem);
        }
    });
}

function renderPendingRequests() {
    const container = document.getElementById('pendingRequestsContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (pendingRequests.length === 0) {
        container.innerHTML = '<p style="color: var(--text-dim); font-size: 0.85rem;">No pending requests</p>';
        return;
    }
    
    pendingRequests.forEach(request => {
        const requestItem = document.createElement('div');
        requestItem.className = 'request-item';
        requestItem.innerHTML = `
            <div class="request-info">
                <div class="request-name">${request.name}</div>
                <div class="request-detail">Peer ID: ${request.peerId.substring(0, 8)}...</div>
            </div>
            <div class="request-actions">
                <button class="btn btn-small btn-success" onclick="approvePlayer('${request.peerId}')">✓</button>
                <button class="btn btn-small btn-danger" onclick="denyPlayer('${request.peerId}')">✗</button>
            </div>
        `;
        container.appendChild(requestItem);
    });
}

function showNotification(message, type = 'info') {
    // Simple notification - you can enhance this
    console.log(`[${type.toUpperCase()}] ${message}`);
}

function copyRoomCode() {
    if (!roomCode) return;
    
    navigator.clipboard.writeText(roomCode).then(() => {
        const elem = document.getElementById('roomCode');
        const oldText = elem.textContent;
        elem.textContent = '✓ Copied!';
        setTimeout(() => {
            elem.textContent = oldText;
        }, 2000);
    }).catch(() => {
        alert('Room Code: ' + roomCode);
    });
}

function toggleConnectionPanel() {
    const panel = document.getElementById('connectionPanel');
    const tab = document.getElementById('connectionTab');
    
    panel.classList.toggle('open');
    tab.classList.toggle('open');
}

console.log('✅ Networking module loaded');
