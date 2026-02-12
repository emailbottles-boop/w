// ============================================
// MINIMAP & INITIALIZATION
// ============================================

let minimapCollapsed = false;
let minimapDragging = false;
let minimapDragStartX = 0;
let minimapDragStartY = 0;
let minimapX = 20;
let minimapY = 20;

function updateMinimap() {
    const grid = document.getElementById('minimapGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            const cell = document.createElement('div');
            cell.className = 'minimap-cell';
            
            const key = `${x},${y}`;
            
            // Check if cell has content
            if (gridCells[key]) {
                cell.classList.add('has-content');
            }
            
            // Check if locked
            if (lockedCells[key]) {
                cell.classList.add('locked');
            }
            
            // Check if current
            if (x === currentCellX && y === currentCellY) {
                cell.classList.add('current');
            }
            
            cell.onclick = () => {
                currentCellX = x;
                currentCellY = y;
                updateGridDisplay();
                updateMinimap();
                draw();
            };
            
            grid.appendChild(cell);
        }
    }
}

function toggleMinimap() {
    minimapCollapsed = !minimapCollapsed;
    const minimap = document.getElementById('minimap');
    
    if (minimap) {
        minimap.classList.toggle('collapsed', minimapCollapsed);
    }
}

function setupMinimapDragging() {
    const container = document.getElementById('minimapContainer');
    if (!container) return;
    
    const header = container.querySelector('.minimap-header');
    
    header.addEventListener('mousedown', (e) => {
        if (e.target.closest('.minimap-btn')) return;
        
        minimapDragging = true;
        minimapDragStartX = e.clientX - minimapX;
        minimapDragStartY = e.clientY - minimapY;
        container.style.cursor = 'grabbing';
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!minimapDragging) return;
        
        minimapX = e.clientX - minimapDragStartX;
        minimapY = e.clientY - minimapDragStartY;
        
        container.style.left = minimapX + 'px';
        container.style.bottom = 'auto';
        container.style.top = minimapY + 'px';
    });
    
    document.addEventListener('mouseup', () => {
        if (minimapDragging) {
            minimapDragging = false;
            container.style.cursor = 'move';
        }
    });
}

function dockMinimap() {
    const container = document.getElementById('minimapContainer');
    if (!container) return;
    
    container.style.left = '20px';
    container.style.top = 'auto';
    container.style.bottom = '20px';
    minimapX = 20;
    minimapY = 20;
}

// MAIN INITIALIZATION
function init() {
    console.log('🎮 Initializing Fractured Sky VTT...');
    
    // Initialize canvas
    initCanvas();
    
    // Setup event listeners
    window.addEventListener('resize', resizeCanvas);
    
    // Setup minimap dragging
    setupMinimapDragging();
    
    // Setup token drag and drop
    setupTokenDragDrop();
    
    // Initialize UI elements
    updateMinimap();
    updateGridDisplay();
    renderFogGroups();
    renderStagingTokens();
    
    console.log('✅ VTT Initialized and Ready!');
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

console.log('✅ Minimap & Init module loaded');
