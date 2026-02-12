// ============================================
// CANVAS - Drawing, Grid, Fog of War
// ============================================

let canvas, ctx;
let mapCanvas, mapCtx;

// Grid state
let gridCells = {};
let lockedCells = {};
let currentCellX = 1;
let currentCellY = 1;

// Drawing state
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let drawMode = DRAW_MODES.NONE;
let drawColor = DEFAULT_DRAW_COLOR;
let lineWidth = DEFAULT_LINE_WIDTH;
let drawHistory = [];
let historyIndex = -1;

// Fog of war
let fogGroups = {
    everyone: { name: 'Everyone', canvas: null }
};
let activeFogGroup = 'everyone';
let fogMode = FOG_MODES.REVEAL;
let fogBrushSize = 50;

// View state
let zoom = DEFAULT_ZOOM;
let panX = 0;
let panY = 0;
let isPanning = false;
let lastPanX = 0;
let lastPanY = 0;

// Grid snap
let gridSnapEnabled = true;

// Placed images
let placedImages = [];

function initCanvas() {
    canvas = document.getElementById('mainCanvas');
    ctx = canvas.getContext('2d');
    
    mapCanvas = document.getElementById('mapCanvas');
    if (mapCanvas) {
        mapCtx = mapCanvas.getContext('2d');
    }
    
    resizeCanvas();
    
    // Event listeners
    canvas.addEventListener('mousedown', handleCanvasMouseDown);
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    canvas.addEventListener('mouseup', handleCanvasMouseUp);
    canvas.addEventListener('wheel', handleCanvasWheel, { passive: false });
    
    if (mapCanvas) {
        mapCanvas.addEventListener('mousedown', handleMapCanvasMouseDown);
        mapCanvas.addEventListener('mousemove', handleMapCanvasMouseMove);
        mapCanvas.addEventListener('mouseup', handleMapCanvasMouseUp);
    }
    
    // Initialize fog canvases
    for (let group in fogGroups) {
        const fogCanvas = document.createElement('canvas');
        fogCanvas.width = GRID_SIZE * CELL_SIZE;
        fogCanvas.height = GRID_SIZE * CELL_SIZE;
        const fogCtx = fogCanvas.getContext('2d');
        fogCtx.fillStyle = 'rgba(0,0,0,1)';
        fogCtx.fillRect(0, 0, fogCanvas.width, fogCanvas.height);
        fogGroups[group].canvas = fogCanvas;
    }
    
    draw();
    console.log('✅ Canvas initialized');
}

function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;
    draw();
}

function draw() {
    if (!canvas || !ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    
    // Apply zoom and pan
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-canvas.width / 2 + panX, -canvas.height / 2 + panY);
    
    // Draw grid cells
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            const key = `${x},${y}`;
            const cellCanvas = gridCells[key];
            
            const drawX = x * CELL_SIZE;
            const drawY = y * CELL_SIZE;
            
            // Draw cell background
            if (cellCanvas) {
                ctx.drawImage(cellCanvas, drawX, drawY);
            }
            
            // Draw grid lines
            ctx.strokeStyle = GRID_LINE_COLOR;
            ctx.lineWidth = GRID_LINE_WIDTH / zoom;
            ctx.strokeRect(drawX, drawY, CELL_SIZE, CELL_SIZE);
            
            // Highlight current cell
            if (x === currentCellX && y === currentCellY && isDM) {
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = 4 / zoom;
                ctx.strokeRect(drawX, drawY, CELL_SIZE, CELL_SIZE);
            }
            
            // Show locked indicator
            if (lockedCells[key]) {
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.fillRect(drawX, drawY, CELL_SIZE, CELL_SIZE);
                ctx.font = `${60 / zoom}px Arial`;
                ctx.fillStyle = '#fff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🔒', drawX + CELL_SIZE / 2, drawY + CELL_SIZE / 2);
            }
        }
    }
    
    // Draw placed images
    placedImages.forEach(img => {
        ctx.save();
        ctx.translate(img.x + img.width / 2, img.y + img.height / 2);
        ctx.rotate(img.rotation || 0);
        ctx.drawImage(img.img, -img.width / 2, -img.height / 2, img.width, img.height);
        ctx.restore();
    });
    
    // Draw placed tokens
    drawTokens();
    
    // Draw fog of war
    if (fogGroups[activeFogGroup] && fogGroups[activeFogGroup].canvas) {
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(fogGroups[activeFogGroup].canvas, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
    }
    
    ctx.restore();
}

function handleCanvasMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - canvas.width / 2) / zoom - panX + canvas.width / 2;
    const y = (e.clientY - rect.top - canvas.height / 2) / zoom - panY + canvas.height / 2;
    
    if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
        // Pan
        isPanning = true;
        lastPanX = e.clientX;
        lastPanY = e.clientY;
        canvas.style.cursor = 'grabbing';
        return;
    }
    
    if (drawMode !== DRAW_MODES.NONE && isDM) {
        isDrawing = true;
        lastX = x;
        lastY = y;
        
        if (drawMode === DRAW_MODES.PEN) {
            drawOnMap(x, y, x, y);
        }
    }
    
    // Check for fog drawing
    if (isDM && (fogMode === FOG_MODES.REVEAL || fogMode === FOG_MODES.HIDE)) {
        drawFog(x, y);
    }
}

function handleCanvasMouseMove(e) {
    if (isPanning) {
        const dx = e.clientX - lastPanX;
        const dy = e.clientY - lastPanY;
        panX += dx / zoom;
        panY += dy / zoom;
        lastPanX = e.clientX;
        lastPanY = e.clientY;
        draw();
        return;
    }
    
    if (!isDrawing) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - canvas.width / 2) / zoom - panX + canvas.width / 2;
    const y = (e.clientY - rect.top - canvas.height / 2) / zoom - panY + canvas.height / 2;
    
    if (drawMode === DRAW_MODES.PEN) {
        drawOnMap(lastX, lastY, x, y);
        lastX = x;
        lastY = y;
    }
    
    if (fogMode === FOG_MODES.REVEAL || fogMode === FOG_MODES.HIDE) {
        drawFog(x, y);
    }
}

function handleCanvasMouseUp(e) {
    isPanning = false;
    isDrawing = false;
    canvas.style.cursor = 'grab';
    
    if (drawMode !== DRAW_MODES.NONE && isDM) {
        saveDrawHistory();
        broadcastGridUpdate();
    }
}

function handleCanvasWheel(e) {
    e.preventDefault();
    
    const delta = -e.deltaY * ZOOM_SPEED;
    const oldZoom = zoom;
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta));
    
    if (zoom !== oldZoom) {
        document.getElementById('zoomSlider').value = zoom * 100;
        document.getElementById('zoomValue').textContent = Math.round(zoom * 100) + '%';
        draw();
    }
}

function drawOnMap(x1, y1, x2, y2) {
    const cellX = Math.floor(x1 / CELL_SIZE);
    const cellY = Math.floor(y1 / CELL_SIZE);
    const key = `${cellX},${cellY}`;
    
    if (!gridCells[key]) {
        gridCells[key] = document.createElement('canvas');
        gridCells[key].width = CELL_SIZE;
        gridCells[key].height = CELL_SIZE;
    }
    
    const cellCtx = gridCells[key].getContext('2d');
    
    const localX1 = x1 - cellX * CELL_SIZE;
    const localY1 = y1 - cellY * CELL_SIZE;
    const localX2 = x2 - cellX * CELL_SIZE;
    const localY2 = y2 - cellY * CELL_SIZE;
    
    cellCtx.strokeStyle = drawColor;
    cellCtx.lineWidth = lineWidth;
    cellCtx.lineCap = 'round';
    cellCtx.lineJoin = 'round';
    
    if (drawMode === DRAW_MODES.ERASER) {
        cellCtx.globalCompositeOperation = 'destination-out';
        cellCtx.lineWidth = lineWidth * 2;
    } else {
        cellCtx.globalCompositeOperation = 'source-over';
    }
    
    cellCtx.beginPath();
    cellCtx.moveTo(localX1, localY1);
    cellCtx.lineTo(localX2, localY2);
    cellCtx.stroke();
    
    draw();
    updateMinimap();
}

function drawFog(x, y) {
    const fogCanvas = fogGroups[activeFogGroup].canvas;
    if (!fogCanvas) return;
    
    const fogCtx = fogCanvas.getContext('2d');
    
    if (fogMode === FOG_MODES.REVEAL) {
        fogCtx.globalCompositeOperation = 'destination-out';
    } else {
        fogCtx.globalCompositeOperation = 'source-over';
        fogCtx.fillStyle = 'rgba(0,0,0,1)';
    }
    
    fogCtx.beginPath();
    fogCtx.arc(x, y, fogBrushSize, 0, Math.PI * 2);
    fogCtx.fill();
    
    draw();
    
    if (isDM) {
        broadcastFogUpdate();
    }
}

function handleMapCanvasMouseDown(e) {
    if (!isDM || !mapCtx) return;
    
    const rect = mapCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    isDrawing = true;
    lastX = x;
    lastY = y;
}

function handleMapCanvasMouseMove(e) {
    if (!isDrawing || !isDM || !mapCtx) return;
    
    const rect = mapCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    mapCtx.strokeStyle = drawColor;
    mapCtx.lineWidth = lineWidth;
    mapCtx.lineCap = 'round';
    
    mapCtx.beginPath();
    mapCtx.moveTo(lastX, lastY);
    mapCtx.lineTo(x, y);
    mapCtx.stroke();
    
    lastX = x;
    lastY = y;
}

function handleMapCanvasMouseUp() {
    isDrawing = false;
}

function clearCurrentCell() {
    const key = `${currentCellX},${currentCellY}`;
    if (gridCells[key]) {
        const cellCtx = gridCells[key].getContext('2d');
        cellCtx.clearRect(0, 0, CELL_SIZE, CELL_SIZE);
        draw();
        updateMinimap();
        broadcastGridUpdate();
    }
}

function clearMapCanvas() {
    if (mapCtx) {
        mapCtx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
    }
}

function importMapToGrid() {
    if (!mapCanvas) return;
    
    const key = `${currentCellX},${currentCellY}`;
    
    if (!gridCells[key]) {
        gridCells[key] = document.createElement('canvas');
        gridCells[key].width = CELL_SIZE;
        gridCells[key].height = CELL_SIZE;
    }
    
    const cellCtx = gridCells[key].getContext('2d');
    cellCtx.drawImage(mapCanvas, 0, 0, CELL_SIZE, CELL_SIZE);
    
    draw();
    updateMinimap();
    clearMapCanvas();
    broadcastGridUpdate();
    
    showNotification('Map imported to grid!', 'success');
}

function setDrawMode(mode) {
    drawMode = mode;
    
    // Update UI
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (mode !== DRAW_MODES.NONE) {
        const activeBtn = document.querySelector(`[data-mode="${mode}"]`);
        if (activeBtn) activeBtn.classList.add('active');
    }
}

function setDrawColor(color) {
    drawColor = color;
}

function setLineWidth(width) {
    lineWidth = width;
}

function setFogMode(mode) {
    fogMode = mode;
}

function setFogBrushSize(size) {
    fogBrushSize = size;
}

function saveDrawHistory() {
    // Simplified history - just save current state
    historyIndex++;
    drawHistory = drawHistory.slice(0, historyIndex);
    drawHistory.push(JSON.stringify(gridCells));
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        gridCells = JSON.parse(drawHistory[historyIndex]);
        draw();
    }
}

function redo() {
    if (historyIndex < drawHistory.length - 1) {
        historyIndex++;
        gridCells = JSON.parse(drawHistory[historyIndex]);
        draw();
    }
}

function broadcastGridUpdate() {
    if (!isDM) return;
    
    const gridData = {};
    for (let key in gridCells) {
        if (gridCells[key]) {
            gridData[key] = gridCells[key].toDataURL();
        }
    }
    
    broadcastToPlayers({
        type: 'gridUpdate',
        gridData: gridData
    });
}

function broadcastFogUpdate() {
    if (!isDM) return;
    
    const fogData = {};
    for (let group in fogGroups) {
        if (fogGroups[group].canvas) {
            fogData[group] = fogGroups[group].canvas.toDataURL();
        }
    }
    
    broadcastToPlayers({
        type: 'fogUpdate',
        fogData: fogData
    });
}

function handleGridUpdate(data) {
    if (isDM) return; // DM doesn't receive grid updates
    
    for (let key in data.gridData) {
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
        img.src = data.gridData[key];
    }
}

function handleFogUpdate(data) {
    if (isDM) return;
    
    for (let group in data.fogData) {
        const img = new Image();
        img.onload = () => {
            const fogCanvas = document.createElement('canvas');
            fogCanvas.width = GRID_SIZE * CELL_SIZE;
            fogCanvas.height = GRID_SIZE * CELL_SIZE;
            const fogCtx = fogCanvas.getContext('2d');
            fogCtx.drawImage(img, 0, 0);
            
            if (!fogGroups[group]) {
                fogGroups[group] = { name: group, canvas: fogCanvas };
            } else {
                fogGroups[group].canvas = fogCanvas;
            }
            
            draw();
        };
        img.src = data.fogData[group];
    }
}

console.log('✅ Canvas module loaded');
