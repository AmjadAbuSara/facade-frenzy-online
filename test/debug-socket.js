const io = require('socket.io-client');
const sock = io('http://localhost:3000', { transports: ['websocket'], forceNew: true });
sock.on('connect', () => { console.log('Connected:', sock.id); sock.emit('joinOnlineMatch', { name: 'Debug' }); });
sock.on('lobbyCount', (c) => { console.log('lobbyCount:', c); });
sock.on('roomAssigned', (d) => { console.log('roomAssigned:', JSON.stringify(d)); });
sock.on('connect_error', (e) => { console.log('Error:', e.message); });
setTimeout(() => { console.log('Done, disconnecting'); sock.disconnect(); process.exit(0); }, 4000);
