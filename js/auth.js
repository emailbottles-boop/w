// ============================================
// AUTHENTICATION & LOGIN
// ============================================

function showDMLogin() {
    document.getElementById('dmModal').classList.add('active');
}

function closeDMModal() {
    document.getElementById('dmModal').classList.remove('active');
    document.getElementById('dmError').classList.remove('show');
}

function showPlayerLogin() {
    document.getElementById('playerModal').classList.add('active');
}

function closePlayerModal() {
    document.getElementById('playerModal').classList.remove('active');
    document.getElementById('playerError').classList.remove('show');
    document.getElementById('playerSuccess').classList.remove('show');
}

function showDMRejoinModal() {
    document.getElementById('dmRejoinModal').classList.add('active');
}

function closeDMRejoinModal() {
    document.getElementById('dmRejoinModal').classList.remove('active');
    document.getElementById('dmRejoinError').classList.remove('show');
    document.getElementById('dmRejoinSuccess').classList.remove('show');
}

function dmLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('dmUser').value;
    const password = document.getElementById('dmPass').value;
    
    if (username === DM_CREDENTIALS.username && password === DM_CREDENTIALS.password) {
        closeDMModal();
        createRoom();
    } else {
        document.getElementById('dmError').classList.add('show');
    }
}

function playerLogin(e) {
    e.preventDefault();
    
    const playerName = document.getElementById('playerName').value;
    const roomCode = document.getElementById('roomCodeInput').value.trim();
    
    myName = playerName;
    peer = new Peer();
    
    peer.on('open', (id) => {
        myId = id;
        const conn = peer.connect(roomCode);
        
        conn.on('open', () => {
            sendToPeer(conn, { 
                type: 'playerJoinRequest', 
                name: myName, 
                peerId: myId 
            });
            
            document.getElementById('playerSuccess').classList.add('show');
            
            setTimeout(() => {
                closePlayerModal();
                document.getElementById('welcomeScreen').classList.add('hidden');
            }, 2000);
        });
        
        conn.on('data', (data) => handleMessage(conn, data));
        
        conn.on('error', (err) => {
            document.getElementById('playerError').textContent = 'Connection failed: ' + err.type;
            document.getElementById('playerError').classList.add('show');
        });
    });
}

console.log('✅ Authentication module loaded');
