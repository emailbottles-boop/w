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
    document.getElementById('dmRejoinError').classList.remove('show');
    
    setTimeout(() => {
        closeDMRejoinModal();
        isDM = true;
        myName = 'Dungeon Master';
        
        console.log('🔄 Attempting to rejoin session:', sessionId);
        
        // CRITICAL: Use the EXACT same session ID to reconnect
        // This keeps the same PeerJS ID so players can stay connected
        peer = new Peer(sessionId, {
            debug: 2 // Enable debug logging
        });
        
        peer.on('open', (id) => {
            console.log('✅ Successfully reconnected with ID:', id);
            myId = roomCode = id;
            
            // CRITICAL: Verify we got the SAME ID back
            if (id !== sessionId) {
                console.error('⚠️ WARNING: Got different ID than requested!');
                console.log('Requested:', sessionId);
                console.log('Received:', id);
            }
            
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
            
            // Success message
            alert('✅ Session Rejoined Successfully!\n\n' +
                  'Room Code: ' + id + '\n\n' +
                  '✓ All maps restored\n' +
                  '✓ All tokens restored\n' +
                  '✓ All fog restored\n' +
                  '✓ Same session ID\n' +
                  '✓ Players can reconnect\n\n' +
                  'You can continue building right where you left off!');
            
            // Setup connection handler for NEW incoming connections
            peer.on('connection', (conn) => {
                console.log('New player connecting:', conn.peer);
                setupConnection(conn);
            });
            
            // Restart session timeout
            startSessionTimeout();
            
            // Save immediately to update timestamp
            saveSessionData();
        });
        
        peer.on('error', (err) => {
            console.error('Peer connection error:', err);
            
            if (err.type === 'unavailable-id') {
                // The session ID is truly unavailable (someone else using it, or PeerJS issue)
                alert('⚠️ CANNOT REJOIN - Session ID In Use\n\n' +
                      'The session ID is currently unavailable.\n\n' +
                      'This can happen if:\n' +
                      '• Another browser tab has this session open\n' +
                      '• The PeerJS server hasn\'t released the ID yet\n\n' +
                      'OPTIONS:\n' +
                      '1. Close any other tabs with this session\n' +
                      '2. Wait 30 seconds and try again\n' +
                      '3. Create a new session (your map will be restored)\n\n' +
                      'Create new session with your saved data?');
                
                if (confirm('Create NEW session with your saved map data?')) {
                    createRoomWithRestoredData(sessionData);
                } else {
                    document.getElementById('welcomeScreen').classList.remove('hidden');
                }
            } else if (err.type === 'peer-unavailable') {
                console.log('Peer unavailable - this is normal, session can still be used');
            } else {
                alert('Connection error: ' + err.type + '\n\nTry again or create a new session.');
                document.getElementById('welcomeScreen').classList.remove('hidden');
            }
        });
        
        peer.on('disconnected', () => {
            console.log('⚠️ Peer disconnected - attempting to reconnect...');
            peer.reconnect();
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
    console.log('🔄 Restoring game state...');
    
    // Restore grid cells
    gridCells = {};
    let cellsToLoad = Object.keys(sessionData.gridCells).length;
    let cellsLoaded = 0;
    
    for (let key in sessionData.gridCells) {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = CELL_SIZE;
            canvas.height = CELL_SIZE;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            gridCells[key] = canvas;
            cellsLoaded++;
            console.log(`Loaded grid cell ${key} (${cellsLoaded}/${cellsToLoad})`);
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
                console.log(`Loaded fog group: ${group}`);
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
    if (sessionData.placedImages && sessionData.placedImages.length > 0) {
        console.log(`Restoring ${sessionData.placedImages.length} images...`);
        sessionData.placedImages.forEach((imgData, index) => {
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
                console.log(`Loaded image ${index + 1}/${sessionData.placedImages.length}`);
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
    currentCellX = sessionData.currentCellX || 0;
    currentCellY = sessionData.currentCellY || 0;
    gridSnapEnabled = sessionData.gridSnapEnabled !== undefined ? sessionData.gridSnapEnabled : true;
    
    // Update zoom UI
    if (document.getElementById('zoomSlider')) {
        document.getElementById('zoomSlider').value = zoom * 100;
        document.getElementById('zoomValue').textContent = Math.round(zoom * 100) + '%';
    }
    
    console.log('✅ Game state restoration complete!');
    console.log(`  - Grid cells: ${Object.keys(gridCells).length}`);
    console.log(`  - Locked cells: ${Object.keys(lockedCells).length}`);
    console.log(`  - Fog groups: ${Object.keys(fogGroups).length}`);
    console.log(`  - Staging tokens: ${stagingTokens.length}`);
    console.log(`  - Placed tokens: ${placedTokens.length}`);
    console.log(`  - Images: ${placedImages.length}`);
    console.log(`  - Current cell: [${currentCellX}, ${currentCellY}]`);
    console.log(`  - Zoom: ${zoom}x, Pan: [${panX}, ${panY}]`);
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
