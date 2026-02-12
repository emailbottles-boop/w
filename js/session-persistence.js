// ============================================
// SESSION PERSISTENCE - Save/Load & DM Rejoin
// ============================================

let sessionTimeout = null;

function saveSessionData() {
    if (!isDM || !roomCode) return;
    
    const gridData = {};
    for (let key in gridCells) {
        if (gridCells[key] && gridCells[key].toDataURL) {
            gridData[key] = gridCells[key].toDataURL();
        }
    }
    
    const fogData = {};
    for (let group in fogGroups) {
        fogData[group] = {
            name: fogGroups[group].name,
            canvasData: fogGroups[group].canvas ? fogGroups[group].canvas.toDataURL() : null
        };
    }
    
    const imagesData = placedImages.map(pi => ({
        src: pi.img.src,
        x: pi.x,
        y: pi.y,
        width: pi.width,
        height: pi.height,
        rotation: pi.rotation || 0,
        gridX: pi.gridX,
        gridY: pi.gridY
    }));
    
    const sessionData = {
        gridCells: gridData,
        lockedCells: lockedCells,
        fogGroups: fogData,
        activeFogGroup: activeFogGroup,
        stagingTokens: stagingTokens,
        placedTokens: placedTokens,
        placedImages: imagesData,
        zoom: zoom,
        panX: panX,
        panY: panY,
        currentCellX: currentCellX,
        currentCellY: currentCellY,
        gridSnapEnabled: gridSnapEnabled,
        timestamp: Date.now()
    };
    
    localStorage.setItem(STORAGE_KEY_PREFIX + roomCode, JSON.stringify(sessionData));
    console.log('💾 Session saved');
}

function loadSessionData(sessionId) {
    const data = localStorage.getItem(STORAGE_KEY_PREFIX + sessionId);
    if (!data) return null;
    
    try {
        const session = JSON.parse(data);
        const age = Date.now() - session.timestamp;
        
        if (age > SESSION_TIMEOUT) {
            localStorage.removeItem(STORAGE_KEY_PREFIX + sessionId);
            console.log('❌ Session expired');
            return null;
        }
        
        console.log('✅ Session loaded');
        return session;
    } catch (e) {
        console.error('Failed to load session:', e);
        return null;
    }
}

function dmRejoin(e) {
    e.preventDefault();
    
    const user = document.getElementById('dmRejoinUser').value;
    const pass = document.getElementById('dmRejoinPass').value;
    const sessionId = document.getElementById('dmRejoinSessionId').value.trim();
    
    if (user !== DM_CREDENTIALS.username || pass !== DM_CREDENTIALS.password) {
        document.getElementById('dmRejoinError').textContent = 'Invalid credentials';
        document.getElementById('dmRejoinError').classList.add('show');
        return;
    }
    
    const sessionData = loadSessionData(sessionId);
    if (!sessionData) {
        document.getElementById('dmRejoinError').textContent = 'Session not found or expired (5 min max)';
        document.getElementById('dmRejoinError').classList.add('show');
        return;
    }
    
    document.getElementById('dmRejoinSuccess').classList.add('show');
    
    setTimeout(() => {
        closeDMRejoinModal();
        isDM = true;
        myName = 'Dungeon Master';
        
        peer = new Peer(sessionId);
        
        peer.on('open', (id) => {
            myId = roomCode = id;
            
            // Restore game state
            restoreGameState(sessionData);
            
            // Update UI
            document.getElementById('welcomeScreen').classList.add('hidden');
            document.getElementById('connectionTabContainer').style.display = 'block';
            document.getElementById('roomCodeSection').style.display = 'block';
            document.getElementById('roomCode').textContent = roomCode;
            document.getElementById('dmControlsBtn').style.display = 'block';
            document.getElementById('stagingZone').style.display = 'flex';
            
            updateConnectionStatus('Connected as DM (Rejoined)', true);
            updateUserList();
            updateGridDisplay();
            renderFogGroups();
            renderStagingTokens();
            draw();
            updateMinimap();
            
            alert('✅ Session Rejoined!\n\nRoom Code: ' + id + '\n\nAll game state restored!');
            
            peer.on('connection', (conn) => setupConnection(conn));
            startSessionTimeout();
            saveSessionData();
        });
        
        peer.on('error', (err) => {
            if (err.type === 'unavailable-id') {
                alert('⚠️ Session ID unavailable.\n\nCreating new session with your data...');
                createRoomWithRestoredData(sessionData);
            } else {
                alert('Connection error: ' + err.type);
            }
        });
    }, 1000);
}

function createRoomWithRestoredData(sessionData) {
    isDM = true;
    myName = 'Dungeon Master';
    peer = new Peer();
    
    peer.on('open', (id) => {
        myId = roomCode = id;
        
        // Restore game state
        restoreGameState(sessionData);
        
        // Update UI
        document.getElementById('welcomeScreen').classList.add('hidden');
        document.getElementById('connectionTabContainer').style.display = 'block';
        document.getElementById('roomCodeSection').style.display = 'block';
        document.getElementById('roomCode').textContent = roomCode;
        document.getElementById('dmControlsBtn').style.display = 'block';
        document.getElementById('stagingZone').style.display = 'flex';
        
        updateConnectionStatus('Connected as DM', true);
        updateUserList();
        updateGridDisplay();
        renderFogGroups();
        renderStagingTokens();
        draw();
        updateMinimap();
        
        alert('✅ New Session Created!\n\nNEW Room Code: ' + id + '\n\nYour game state was restored!\n\nShare this NEW code with players.');
        
        peer.on('connection', (conn) => setupConnection(conn));
        startSessionTimeout();
        saveSessionData();
    });
}

function restoreGameState(sessionData) {
    // Restore grid cells
    gridCells = {};
    for (let key in sessionData.gridCells) {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = CELL_SIZE;
            canvas.height = CELL_SIZE;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            gridCells[key] = canvas;
            draw();
        };
        img.src = sessionData.gridCells[key];
    }
    
    // Restore fog groups
    fogGroups = {};
    for (let group in sessionData.fogGroups) {
        const fogCanvas = document.createElement('canvas');
        fogCanvas.width = GRID_SIZE * CELL_SIZE;
        fogCanvas.height = GRID_SIZE * CELL_SIZE;
        const fogCtx = fogCanvas.getContext('2d');
        
        if (sessionData.fogGroups[group].canvasData) {
            const img = new Image();
            img.onload = () => {
                fogCtx.drawImage(img, 0, 0);
                draw();
            };
            img.src = sessionData.fogGroups[group].canvasData;
        } else {
            fogCtx.fillStyle = 'rgba(0,0,0,1)';
            fogCtx.fillRect(0, 0, fogCanvas.width, fogCanvas.height);
        }
        
        fogGroups[group] = {
            name: sessionData.fogGroups[group].name,
            canvas: fogCanvas
        };
    }
    
    // Restore placed images
    placedImages = [];
    if (sessionData.placedImages) {
        sessionData.placedImages.forEach(imgData => {
            const img = new Image();
            img.onload = () => {
                placedImages.push({
                    img: img,
                    x: imgData.x,
                    y: imgData.y,
                    width: imgData.width,
                    height: imgData.height,
                    rotation: imgData.rotation || 0,
                    gridX: imgData.gridX,
                    gridY: imgData.gridY
                });
                draw();
            };
            img.src = imgData.src;
        });
    }
    
    // Restore other state
    lockedCells = sessionData.lockedCells || {};
    stagingTokens = sessionData.stagingTokens || [];
    placedTokens = sessionData.placedTokens || [];
    activeFogGroup = sessionData.activeFogGroup || 'everyone';
    zoom = sessionData.zoom || DEFAULT_ZOOM;
    panX = sessionData.panX || 0;
    panY = sessionData.panY || 0;
    currentCellX = sessionData.currentCellX || 1;
    currentCellY = sessionData.currentCellY || 1;
    gridSnapEnabled = sessionData.gridSnapEnabled !== undefined ? sessionData.gridSnapEnabled : true;
    
    // Update zoom UI
    if (document.getElementById('zoomSlider')) {
        document.getElementById('zoomSlider').value = zoom * 100;
        document.getElementById('zoomValue').textContent = Math.round(zoom * 100) + '%';
    }
}

function startSessionTimeout() {
    if (sessionTimeout) clearTimeout(sessionTimeout);
    
    sessionTimeout = setTimeout(() => {
        if (connections.size === 0 && isDM && roomCode) {
            localStorage.removeItem(STORAGE_KEY_PREFIX + roomCode);
            console.log('⏰ Session expired after 5 minutes of inactivity');
        }
    }, SESSION_TIMEOUT);
}

function updateSessionTimeout() {
    if (connections.size === 0 && isDM) {
        startSessionTimeout();
    } else if (connections.size > 0 && sessionTimeout) {
        clearTimeout(sessionTimeout);
        sessionTimeout = null;
    }
}

function initializeGameState() {
    gridCells = {};
    lockedCells = {};
    stagingTokens = [];
    placedTokens = [];
    placedImages = [];
    fogGroups = {
        everyone: { name: 'Everyone', canvas: null }
    };
    activeFogGroup = 'everyone';
    zoom = DEFAULT_ZOOM;
    panX = 0;
    panY = 0;
    currentCellX = 1;
    currentCellY = 1;
    gridSnapEnabled = true;
    
    // Initialize fog canvas
    const fogCanvas = document.createElement('canvas');
    fogCanvas.width = GRID_SIZE * CELL_SIZE;
    fogCanvas.height = GRID_SIZE * CELL_SIZE;
    const fogCtx = fogCanvas.getContext('2d');
    fogCtx.fillStyle = 'rgba(0,0,0,1)';
    fogCtx.fillRect(0, 0, fogCanvas.width, fogCanvas.height);
    fogGroups.everyone.canvas = fogCanvas;
}

function getFullGameState() {
    const gridData = {};
    for (let key in gridCells) {
        if (gridCells[key] && gridCells[key].toDataURL) {
            gridData[key] = gridCells[key].toDataURL();
        }
    }
    
    const fogData = {};
    for (let group in fogGroups) {
        fogData[group] = {
            name: fogGroups[group].name,
            canvasData: fogGroups[group].canvas ? fogGroups[group].canvas.toDataURL() : null
        };
    }
    
    const imagesData = placedImages.map(pi => ({
        src: pi.img.src,
        x: pi.x,
        y: pi.y,
        width: pi.width,
        height: pi.height,
        rotation: pi.rotation || 0
    }));
    
    return {
        gridCells: gridData,
        lockedCells: lockedCells,
        fogGroups: fogData,
        activeFogGroup: activeFogGroup,
        stagingTokens: stagingTokens,
        placedTokens: placedTokens,
        placedImages: imagesData,
        zoom: zoom,
        panX: panX,
        panY: panY
    };
}

function loadFullGameState(data) {
    // Restore grid cells
    for (let key in data.gridCells) {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = CELL_SIZE;
            canvas.height = CELL_SIZE;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            gridCells[key] = canvas;
            draw();
        };
        img.src = data.gridCells[key];
    }
    
    // Restore fog groups
    for (let group in data.fogGroups) {
        const fogCanvas = document.createElement('canvas');
        fogCanvas.width = GRID_SIZE * CELL_SIZE;
        fogCanvas.height = GRID_SIZE * CELL_SIZE;
        const fogCtx = fogCanvas.getContext('2d');
        
        if (data.fogGroups[group].canvasData) {
            const img = new Image();
            img.onload = () => {
                fogCtx.drawImage(img, 0, 0);
                draw();
            };
            img.src = data.fogGroups[group].canvasData;
        }
        
        fogGroups[group] = {
            name: data.fogGroups[group].name,
            canvas: fogCanvas
        };
    }
    
    // Restore images
    if (data.placedImages) {
        placedImages = [];
        data.placedImages.forEach(imgData => {
            const img = new Image();
            img.onload = () => {
                placedImages.push({
                    img: img,
                    x: imgData.x,
                    y: imgData.y,
                    width: imgData.width,
                    height: imgData.height,
                    rotation: imgData.rotation || 0
                });
                draw();
            };
            img.src = imgData.src;
        });
    }
    
    // Restore other state
    lockedCells = data.lockedCells || {};
    stagingTokens = data.stagingTokens || [];
    placedTokens = data.placedTokens || [];
    activeFogGroup = data.activeFogGroup || 'everyone';
    zoom = data.zoom || DEFAULT_ZOOM;
    panX = data.panX || 0;
    panY = data.panY || 0;
    
    draw();
}

// Auto-save every 30 seconds
setInterval(() => {
    if (isDM && roomCode) {
        saveSessionData();
    }
}, AUTO_SAVE_INTERVAL);

// Save on page unload
window.addEventListener('beforeunload', () => {
    if (isDM && roomCode) {
        saveSessionData();
    }
});

console.log('✅ Session Persistence module loaded');
