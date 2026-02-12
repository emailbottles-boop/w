// ============================================
// TOKENS - Token Management
// ============================================

let stagingTokens = [];
let placedTokens = [];
let selectedToken = null;
let draggingToken = null;

function createToken(emoji, color, owner) {
    const token = {
        id: Date.now() + Math.random(),
        emoji: emoji,
        color: color,
        owner: owner || myName,
        x: 0,
        y: 0,
        placed: false
    };
    
    stagingTokens.push(token);
    renderStagingTokens();
    
    if (isDM) {
        saveSessionData();
    }
    
    return token;
}

function renderStagingTokens() {
    const container = document.getElementById('stagingTokensContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    stagingTokens.forEach(token => {
        const tokenEl = document.createElement('div');
        tokenEl.className = 'token-item';
        tokenEl.style.backgroundColor = token.color;
        tokenEl.innerHTML = `
            ${token.emoji}
            <div class="token-owner">${token.owner}</div>
        `;
        tokenEl.draggable = true;
        tokenEl.dataset.tokenId = token.id;
        
        tokenEl.addEventListener('dragstart', (e) => {
            draggingToken = token;
            e.dataTransfer.effectAllowed = 'move';
        });
        
        tokenEl.addEventListener('dblclick', () => {
            removeTokenFromStaging(token.id);
        });
        
        container.appendChild(tokenEl);
    });
}

function removeTokenFromStaging(tokenId) {
    const index = stagingTokens.findIndex(t => t.id === tokenId);
    if (index !== -1) {
        stagingTokens.splice(index, 1);
        renderStagingTokens();
        
        if (isDM) {
            saveSessionData();
        }
    }
}

function placeTokenOnGrid(token, canvasX, canvasY) {
    // Convert canvas coordinates to grid coordinates
    const gridX = Math.floor(canvasX / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
    const gridY = Math.floor(canvasY / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
    
    // Snap to grid if enabled
    if (gridSnapEnabled) {
        token.x = gridX;
        token.y = gridY;
    } else {
        token.x = canvasX;
        token.y = canvasY;
    }
    
    token.placed = true;
    
    // Move from staging to placed
    const stagingIndex = stagingTokens.findIndex(t => t.id === token.id);
    if (stagingIndex !== -1) {
        stagingTokens.splice(stagingIndex, 1);
    }
    
    placedTokens.push(token);
    
    renderStagingTokens();
    draw();
    
    if (isDM) {
        broadcastToPlayers({
            type: 'tokenPlace',
            token: token
        });
        saveSessionData();
    }
}

function handleTokenPlace(data) {
    if (isDM) return;
    
    const existingIndex = placedTokens.findIndex(t => t.id === data.token.id);
    if (existingIndex !== -1) {
        placedTokens[existingIndex] = data.token;
    } else {
        placedTokens.push(data.token);
    }
    
    draw();
}

function moveToken(tokenId, newX, newY) {
    const token = placedTokens.find(t => t.id === tokenId);
    if (!token) return;
    
    if (gridSnapEnabled) {
        token.x = Math.floor(newX / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
        token.y = Math.floor(newY / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
    } else {
        token.x = newX;
        token.y = newY;
    }
    
    draw();
    
    if (isDM) {
        broadcastToPlayers({
            type: 'tokenMove',
            tokenId: tokenId,
            x: token.x,
            y: token.y
        });
        saveSessionData();
    }
}

function handleTokenMove(data) {
    if (isDM) return;
    
    const token = placedTokens.find(t => t.id === data.tokenId);
    if (token) {
        token.x = data.x;
        token.y = data.y;
        draw();
    }
}

function removeToken(tokenId) {
    const index = placedTokens.findIndex(t => t.id === tokenId);
    if (index !== -1) {
        placedTokens.splice(index, 1);
        draw();
        
        if (isDM) {
            broadcastToPlayers({
                type: 'tokenRemove',
                tokenId: tokenId
            });
            saveSessionData();
        }
    }
}

function handleTokenRemove(data) {
    if (isDM) return;
    
    const index = placedTokens.findIndex(t => t.id === data.tokenId);
    if (index !== -1) {
        placedTokens.splice(index, 1);
        draw();
    }
}

function drawTokens() {
    placedTokens.forEach(token => {
        ctx.save();
        
        // Draw token circle
        ctx.beginPath();
        ctx.arc(token.x, token.y, 30 / zoom, 0, Math.PI * 2);
        ctx.fillStyle = token.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3 / zoom;
        ctx.stroke();
        
        // Draw emoji
        ctx.font = `${40 / zoom}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(token.emoji, token.x, token.y);
        
        // Draw owner name below
        ctx.font = `${12 / zoom}px Inter`;
        ctx.fillStyle = '#fff';
        ctx.fillText(token.owner, token.x, token.y + 45 / zoom);
        
        ctx.restore();
    });
}

function getTokenAtPosition(x, y) {
    for (let i = placedTokens.length - 1; i >= 0; i--) {
        const token = placedTokens[i];
        const distance = Math.sqrt(Math.pow(token.x - x, 2) + Math.pow(token.y - y, 2));
        
        if (distance <= 30) {
            return token;
        }
    }
    
    return null;
}

function setupTokenDragDrop() {
    canvas.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    });
    
    canvas.addEventListener('drop', (e) => {
        e.preventDefault();
        
        if (!draggingToken) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - canvas.width / 2) / zoom - panX + canvas.width / 2;
        const y = (e.clientY - rect.top - canvas.height / 2) / zoom - panY + canvas.height / 2;
        
        placeTokenOnGrid(draggingToken, x, y);
        draggingToken = null;
    });
}

function addPlayerToken(playerName) {
    if (!isDM) return;
    
    // Emoji picker - simplified version
    const emojis = ['🧙', '⚔️', '🛡️', '🏹', '🗡️', '⚡', '🔥', '❄️', '🌟', '💀'];
    const colors = ['#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'];
    
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    createToken(emoji, color, playerName);
}

function openTokenCreator() {
    const emoji = prompt('Enter an emoji for your token:', '🧙');
    if (!emoji) return;
    
    const color = prompt('Enter a color (hex code):', '#8b5cf6');
    if (!color) return;
    
    createToken(emoji, color, myName);
}

function clearAllTokens() {
    if (confirm('Clear all tokens? This cannot be undone.')) {
        stagingTokens = [];
        placedTokens = [];
        renderStagingTokens();
        draw();
        
        if (isDM) {
            broadcastToPlayers({ type: 'clearTokens' });
            saveSessionData();
        }
    }
}

function toggleGridSnap() {
    gridSnapEnabled = !gridSnapEnabled;
    
    const btn = document.getElementById('gridSnapBtn');
    if (btn) {
        btn.classList.toggle('active', gridSnapEnabled);
        btn.textContent = gridSnapEnabled ? '📐 Snap: ON' : '📐 Snap: OFF';
    }
    
    if (isDM) {
        saveSessionData();
    }
}

console.log('✅ Token module loaded');
