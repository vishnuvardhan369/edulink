// WebRTC signaling implementation based on working audio-call-app
module.exports = (io) => {
    // Store rooms and user mappings
    const rooms = new Map(); // roomId -> Set of userIds
    const userRooms = new Map(); // userId -> roomId

    io.on('connection', (socket) => {
        
        // Join room for calls
        socket.on('join-room', (roomId) => {
            const userId = socket.userId || socket.id;
            
            console.log(`📞 User ${userId} joining room ${roomId}`);
            
            // Leave previous room if any
            const prevRoom = userRooms.get(userId);
            if (prevRoom && rooms.has(prevRoom)) {
                rooms.get(prevRoom).delete(userId);
                socket.leave(prevRoom);
                socket.to(prevRoom).emit('user-disconnected', userId);
                console.log(`👋 User ${userId} left previous room ${prevRoom}`);
            }
            
            // Join new room
            socket.join(roomId);
            userRooms.set(userId, roomId);
            
            if (!rooms.has(roomId)) {
                rooms.set(roomId, new Set());
            }
            rooms.get(roomId).add(userId);
            
            // Notify other users in room that a new user connected
            socket.to(roomId).emit('user-connected', userId);
            
            console.log(`✅ User ${userId} joined room ${roomId}. Room now has ${rooms.get(roomId).size} users`);
        });

        // Handle WebRTC offers
        socket.on('offer', (data) => {
            const { offer, target } = data;
            const caller = socket.userId || socket.id;
            
            console.log(`📞 Relaying offer from ${caller} to ${target}`);
            socket.to(target).emit('offer', { offer, caller });
        });

        // Handle WebRTC answers
        socket.on('answer', (data) => {
            const { answer, target } = data;
            const answerer = socket.userId || socket.id;
            
            console.log(`✅ Relaying answer from ${answerer} to ${target}`);
            socket.to(target).emit('answer', { answer, answerer });
        });

        // Handle ICE candidates
        socket.on('ice-candidate', (data) => {
            const { candidate, target } = data;
            const from = socket.userId || socket.id;
            
            console.log(`📡 Relaying ICE candidate from ${from} to ${target}`);
            socket.to(target).emit('ice-candidate', { candidate, from });
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            const userId = socket.userId || socket.id;
            
            console.log(`🔌 User ${userId} disconnecting`);
            
            // Clean up rooms
            const roomId = userRooms.get(userId);
            if (roomId && rooms.has(roomId)) {
                rooms.get(roomId).delete(userId);
                socket.to(roomId).emit('user-disconnected', userId);
                
                console.log(`👋 User ${userId} disconnected from room ${roomId}`);
                
                // Clean up empty rooms
                if (rooms.get(roomId).size === 0) {
                    rooms.delete(roomId);
                    console.log(`🗑️ Cleaned up empty room ${roomId}`);
                }
            }
            userRooms.delete(userId);
        });
    });
};