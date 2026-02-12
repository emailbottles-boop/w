// ============================================
// FRACTURED SKY VTT - CONFIGURATION
// ============================================

// GRID & CANVAS SETTINGS
const GRID_SIZE = 3; // 3x3 grid
const CELL_SIZE = 1200; // pixels per cell
const GRID_LINE_COLOR = '#4b5563';
const GRID_LINE_WIDTH = 2;

// SESSION PERSISTENCE
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const STORAGE_KEY_PREFIX = 'fracturedSky_session_';
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

// AUTHENTICATION
const DM_CREDENTIALS = {
    username: 'Wizard',
    password: 'FracturedSky2025!'
};

// DRAWING TOOLS
const DRAW_MODES = {
    NONE: 'none',
    PEN: 'pen',
    ERASER: 'eraser',
    RECTANGLE: 'rectangle',
    CIRCLE: 'circle',
    LINE: 'line'
};

// FOG OF WAR
const FOG_MODES = {
    REVEAL: 'reveal',
    HIDE: 'hide'
};

// ZOOM SETTINGS
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;
const DEFAULT_ZOOM = 1;
const ZOOM_SPEED = 0.001;

// COLORS
const DEFAULT_DRAW_COLOR = '#000000';
const DEFAULT_LINE_WIDTH = 5;

// NETWORK
const PEER_CONFIG = {
    debug: 1
};

console.log('✅ Configuration loaded');
