# 🐛 BUG FIXES - v4.1

## ✅ Fixed Issues

### 1. **Import to Grid Button**
- ✅ Fixed: Now properly imports map canvas to current grid cell
- ✅ Fixed: Scales content correctly to fit cell size
- ✅ Fixed: Shows confirmation message with cell coordinates
- ✅ Fixed: Clears map canvas after import

### 2. **Brush Alignment**
- ✅ Fixed: Drawing brush now aligns perfectly with mouse cursor
- ✅ Fixed: Coordinates properly transformed for zoom/pan
- ✅ Fixed: Works correctly at all zoom levels
- ✅ Fixed: Fog brush also properly aligned

### 3. **Map Readjustment (Pan)**
- ✅ Fixed: Middle-click to pan
- ✅ Fixed: Right-click to pan
- ✅ Fixed: Ctrl+Click to pan
- ✅ Fixed: Smooth panning at all zoom levels
- ✅ Fixed: Context menu disabled (no right-click menu popup)

### 4. **Session Persistence**
- ✅ Verified: Auto-save every 30 seconds working
- ✅ Verified: Save on page unload working
- ✅ Verified: DM Rejoin button functional
- ✅ Verified: 5-minute session timeout active
- ✅ Fixed: Room code displays in connection panel
- ✅ Fixed: Pending requests section shows/hides properly

### 5. **Grid Navigation**
- ✅ Fixed: Grid now starts at cell (1,1) for user display
- ✅ Fixed: Internal 0-based indexing works correctly
- ✅ Fixed: Grid navigation buttons work properly

## 🎮 How to Test

### Test Import to Grid:
1. Open DM panel
2. Draw something on the Map Builder canvas
3. Click "Import to Grid"
4. Should see drawing in current cell on main canvas
5. Minimap should update

### Test Brush Alignment:
1. Select Pen tool in DM panel
2. Draw on main canvas
3. Brush should follow cursor exactly
4. Try at different zoom levels

### Test Panning:
1. Middle-click and drag on canvas
2. OR Right-click and drag
3. OR Ctrl+Click and drag
4. Canvas should pan smoothly

### Test Session Persistence:
1. Create room as DM
2. Draw something, place tokens
3. Copy your Room Code
4. Refresh the page
5. Click "Rejoin Session (DM)"
6. Enter credentials + paste Room Code
7. Everything should restore!

## 📊 Changes Made

- **canvas.js**: Fixed mouse coordinate transformation
- **canvas.js**: Added mouseleave handlers
- **canvas.js**: Improved importMapToGrid function
- **canvas.js**: Added context menu prevention
- **networking.js**: Enhanced room code display
- **networking.js**: Fixed pending requests visibility
- **dm-panel.js**: Added debug logging for grid position

All fixes tested and working! ✅
