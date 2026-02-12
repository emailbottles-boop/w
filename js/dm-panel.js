// ============================================
// DM PANEL - Controls & Tools
// ============================================

let dmPanelOpen = false;

function toggleDMPanel() {
    dmPanelOpen = !dmPanelOpen;
    const panel = document.getElementById('dmPanel');
    
    if (panel) {
        panel.classList.toggle('open', dmPanelOpen);
    }
}

function updateGridDisplay() {
    const display = document.getElementById('currentGridDisplay');
    if (display) {
        // Show 1-based to user, but use 0-based internally
        display.innerHTML = `<span class="current">${currentCellX + 1}, ${currentCellY + 1}</span>`;
    }
    
    console.log('Current grid cell:', currentCellX, currentCellY);
}

function navigateGrid(direction) {
    switch(direction) {
        case 'up':
            if (currentCellY > 0) currentCellY--;
            break;
        case 'down':
            if (currentCellY < GRID_SIZE - 1) currentCellY++;
            break;
        case 'left':
            if (currentCellX > 0) currentCellX--;
            break;
        case 'right':
            if (currentCellX < GRID_SIZE - 1) currentCellX++;
            break;
        case 'center':
            currentCellX = 1;
            currentCellY = 1;
            break;
    }
    
    updateGridDisplay();
    draw();
    updateMinimap();
    
    if (isDM) {
        saveSessionData();
    }
}

function lockCurrentCell() {
    const key = `${currentCellX},${currentCellY}`;
    lockedCells[key] = true;
    updateMinimap();
    draw();
    
    if (isDM) {
        broadcastToPlayers({
            type: 'cellLock',
            key: key,
            locked: true
        });
        saveSessionData();
    }
}

function unlockCurrentCell() {
    const key = `${currentCellX},${currentCellY}`;
    delete lockedCells[key];
    updateMinimap();
    draw();
    
    if (isDM) {
        broadcastToPlayers({
            type: 'cellLock',
            key: key,
            locked: false
        });
        saveSessionData();
    }
}

function createFogGroup() {
    const name = prompt('Enter fog group name (e.g., "Party A", "Private"):');
    if (!name || name.trim() === '') return;
    
    const groupId = name.toLowerCase().replace(/\s+/g, '_');
    
    if (fogGroups[groupId]) {
        alert('A fog group with this name already exists!');
        return;
    }
    
    const fogCanvas = document.createElement('canvas');
    fogCanvas.width = GRID_SIZE * CELL_SIZE;
    fogCanvas.height = GRID_SIZE * CELL_SIZE;
    const fogCtx = fogCanvas.getContext('2d');
    fogCtx.fillStyle = 'rgba(0,0,0,1)';
    fogCtx.fillRect(0, 0, fogCanvas.width, fogCanvas.height);
    
    fogGroups[groupId] = {
        name: name,
        canvas: fogCanvas
    };
    
    renderFogGroups();
    
    if (isDM) {
        saveSessionData();
    }
}

function switchFogGroup(groupId) {
    if (!fogGroups[groupId]) return;
    
    activeFogGroup = groupId;
    renderFogGroups();
    draw();
    
    if (isDM) {
        saveSessionData();
    }
}

function deleteFogGroup(groupId) {
    if (groupId === 'everyone') {
        alert('Cannot delete the "Everyone" fog group!');
        return;
    }
    
    if (!confirm(`Delete fog group "${fogGroups[groupId].name}"?`)) return;
    
    delete fogGroups[groupId];
    
    if (activeFogGroup === groupId) {
        activeFogGroup = 'everyone';
    }
    
    renderFogGroups();
    draw();
    
    if (isDM) {
        saveSessionData();
    }
}

function renderFogGroups() {
    const container = document.getElementById('fogGroupsContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    for (let groupId in fogGroups) {
        const group = fogGroups[groupId];
        const isActive = groupId === activeFogGroup;
        
        const groupEl = document.createElement('div');
        groupEl.className = 'fog-group-item' + (isActive ? ' active' : '');
        groupEl.innerHTML = `
            <span class="fog-group-name">${group.name}</span>
            <div class="fog-group-controls">
                <button class="btn btn-small" onclick="switchFogGroup('${groupId}')">
                    ${isActive ? '✓' : 'Switch'}
                </button>
                ${groupId !== 'everyone' ? `
                    <button class="btn btn-small btn-danger" onclick="deleteFogGroup('${groupId}')">
                        ✗
                    </button>
                ` : ''}
            </div>
        `;
        
        container.appendChild(groupEl);
    }
}

function clearFogGroup(groupId) {
    if (!fogGroups[groupId]) return;
    
    const fogCanvas = fogGroups[groupId].canvas;
    const fogCtx = fogCanvas.getContext('2d');
    fogCtx.clearRect(0, 0, fogCanvas.width, fogCanvas.height);
    
    draw();
    
    if (isDM) {
        broadcastFogUpdate();
        saveSessionData();
    }
}

function resetFogGroup(groupId) {
    if (!fogGroups[groupId]) return;
    
    const fogCanvas = fogGroups[groupId].canvas;
    const fogCtx = fogCanvas.getContext('2d');
    fogCtx.fillStyle = 'rgba(0,0,0,1)';
    fogCtx.fillRect(0, 0, fogCanvas.width, fogCanvas.height);
    
    draw();
    
    if (isDM) {
        broadcastFogUpdate();
        saveSessionData();
    }
}

function uploadImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const placedImage = {
                    img: img,
                    x: currentCellX * CELL_SIZE,
                    y: currentCellY * CELL_SIZE,
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    rotation: 0,
                    gridX: currentCellX,
                    gridY: currentCellY
                };
                
                placedImages.push(placedImage);
                draw();
                
                if (isDM) {
                    broadcastToPlayers({
                        type: 'imagePlace',
                        imageData: {
                            src: img.src,
                            x: placedImage.x,
                            y: placedImage.y,
                            width: placedImage.width,
                            height: placedImage.height,
                            rotation: placedImage.rotation
                        }
                    });
                    saveSessionData();
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };
    
    input.click();
}

function clearAllImages() {
    if (!confirm('Clear all placed images?')) return;
    
    placedImages = [];
    draw();
    
    if (isDM) {
        broadcastToPlayers({ type: 'clearImages' });
        saveSessionData();
    }
}

function setZoom(value) {
    zoom = value / 100;
    document.getElementById('zoomValue').textContent = Math.round(zoom * 100) + '%';
    draw();
    
    if (isDM) {
        broadcastToPlayers({
            type: 'zoomPanUpdate',
            zoom: zoom,
            panX: panX,
            panY: panY
        });
    }
}

function resetView() {
    zoom = DEFAULT_ZOOM;
    panX = 0;
    panY = 0;
    
    document.getElementById('zoomSlider').value = zoom * 100;
    document.getElementById('zoomValue').textContent = '100%';
    
    draw();
    
    if (isDM) {
        broadcastToPlayers({
            type: 'zoomPanUpdate',
            zoom: zoom,
            panX: panX,
            panY: panY
        });
    }
}

function handleZoomPanUpdate(data) {
    if (isDM) return;
    
    zoom = data.zoom;
    panX = data.panX;
    panY = data.panY;
    
    if (document.getElementById('zoomSlider')) {
        document.getElementById('zoomSlider').value = zoom * 100;
        document.getElementById('zoomValue').textContent = Math.round(zoom * 100) + '%';
    }
    
    draw();
}

function exportSession() {
    const sessionData = {
        gridCells: {},
        lockedCells: lockedCells,
        fogGroups: {},
        placedTokens: placedTokens,
        stagingTokens: stagingTokens,
        placedImages: placedImages.map(img => ({
            src: img.img.src,
            x: img.x,
            y: img.y,
            width: img.width,
            height: img.height,
            rotation: img.rotation
        })),
        zoom: zoom,
        panX: panX,
        panY: panY,
        currentCellX: currentCellX,
        currentCellY: currentCellY
    };
    
    // Serialize grid cells
    for (let key in gridCells) {
        if (gridCells[key]) {
            sessionData.gridCells[key] = gridCells[key].toDataURL();
        }
    }
    
    // Serialize fog groups
    for (let group in fogGroups) {
        sessionData.fogGroups[group] = {
            name: fogGroups[group].name,
            canvasData: fogGroups[group].canvas ? fogGroups[group].canvas.toDataURL() : null
        };
    }
    
    const dataStr = JSON.stringify(sessionData);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `fractured-sky-session-${Date.now()}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    
    showNotification('Session exported!', 'success');
}

function importSession() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const sessionData = JSON.parse(event.target.result);
                loadFullGameState(sessionData);
                showNotification('Session imported!', 'success');
            } catch (err) {
                alert('Failed to import session: ' + err.message);
            }
        };
        reader.readAsText(file);
    };
    
    input.click();
}

console.log('✅ DM Panel module loaded');
