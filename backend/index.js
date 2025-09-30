const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config(); 
const { Client, Pool } = require('pg');
const { BlobServiceClient, StorageSharedKeyCredential, BlobSASPermissions, generateBlobSASQueryParameters } = require('@azure/storage-blob');
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  process.exit(1);
});

console.log('🔧 Global error handlers set up');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
});

const client = pool;

pool.connect()
  .then((client) => {
    console.log('Connected to DigitalOcean PostgreSQL database');
    client.release();
  })
  .catch(err => {
    console.error('Error connecting to PostgreSQL:', err);
  });

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

const app = express();
const server = createServer(app);

// Enhanced Socket.IO configuration for Azure App Services
const io = new Server(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production' 
            ? [
                "https://edulink-g0gqgxhhezfjbzg4.southindia-01.azurewebsites.net",
                "https://www.edulink.social",
                "https://edulink.social"
              ]
            : [
                "http://localhost:5173", 
                "http://localhost:5174", 
                "http://localhost:3000", 
                "https://www.edulink.social",
                "https://edulink.social",
                // Local network testing URLs
                "http://10.12.151.180:5173",
                "http://10.12.151.180:5174",
                "http://10.12.151.180:3000"
              ],
        methods: ["GET", "POST"],
        credentials: true,
        allowEIO3: true // Support for older Socket.IO versions
    },
    // Azure-optimized settings
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    maxHttpBufferSize: 1e8, // 100 MB
    transports: ['polling', 'websocket'], // Prefer polling first for Azure
    allowUpgrades: true,
    httpCompression: true,
    // Additional settings for production stability
    ...(process.env.NODE_ENV === 'production' && {
        cookie: false, // Disable cookies in production
        serveClient: false // Don't serve Socket.IO client files
    })
});
const PORT = process.env.PORT;

const corsOptions = {
    origin: function(origin, callback) {
        const allowedOrigins = process.env.NODE_ENV === 'production' 
            ? [
                "https://edulink-g0gqgxhhezfjbzg4.southindia-01.azurewebsites.net",
                "https://www.edulink.social",
                // GitHub hosting domains
                "https://vishnuvardhan369.github.io",
                "https://edulink-app.github.io",
                "https://raw.githubusercontent.com",
                // GitHub Codespaces and dev environments
                "https://preview.app.github.dev",
                "https://github.dev",
                // Common hosting platforms
                "https://netlify.app",
                "https://vercel.app",
                "https://surge.sh",
                "https://herokuapp.com"
              ]
            : [
                "https://www.edulink.social",
                "http://localhost:5173",
                "http://localhost:5174",
                "http://localhost:3000",
                // Local network testing URLs
                "http://10.12.151.180:5173",
                "http://10.12.151.180:5174",
                "http://10.12.151.180:3000",
                // GitHub hosting domains (for development testing)
                "https://vishnuvardhan369.github.io",
                "https://edulink-app.github.io",
                "https://raw.githubusercontent.com",
                "https://preview.app.github.dev",
                "https://github.dev"
              ];
        
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) {
            return callback(null, true);
        }
        
        // Check for exact match
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } 
        // Check for GitHub-related domains with wildcards
        else if (origin.includes('github.io') || 
                 origin.includes('githubusercontent.com') ||
                 origin.includes('github.dev') ||
                 origin.includes('codespaces.new') ||
                 origin.includes('preview.app.github.dev')) {
            callback(null, true);
        }
        // Check for common hosting platform wildcards
        else if (origin.includes('netlify.app') ||
                 origin.includes('vercel.app') ||
                 origin.includes('surge.sh') ||
                 origin.includes('herokuapp.com')) {
            callback(null, true);
        }
        else {
            console.log(`❌ CORS blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Origin", "X-Requested-With", "Accept"],
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Serve static files from React build (for production deployment)
const path = require('path');
if (process.env.NODE_ENV === 'production') {
    // Serve static files from the public directory
    app.use(express.static(path.join(__dirname, 'public')));
    
    // Handle React Router - send all non-API routes to index.html
    app.get('*', (req, res, next) => {
        // Skip API routes
        if (req.path.startsWith('/api') || req.path.startsWith('/auth') || req.path.startsWith('/health')) {
            return next();
        }
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        port: PORT
    });
});

// Database health check
app.get('/api/health/db', async (req, res) => {
    try {
        const result = await client.query('SELECT NOW() as current_time');
        res.status(200).json({
            status: 'OK',
            database: 'Connected',
            timestamp: result.rows[0].current_time
        });
    } catch (error) {
        console.error('❌ Database health check failed:', error);
        res.status(500).json({
            status: 'ERROR',
            database: 'Disconnected',
            error: error.message
        });
    }
});

const isDevelopment = process.env.NODE_ENV === 'development';
const isAzure = !!process.env.WEBSITE_SITE_NAME;

const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
if (!accountName || !accountKey) { 
    console.error("Error: Azure Storage credentials are not set in the .env file.");
    process.exit(1);
}
const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);

app.get('/', (req, res) => res.send('EduLink Backend is running! v2.0 - DB Compatible'));

// Store active users for real-time features
const activeUsers = new Map(); // userId -> { socketId, status, lastSeen }
const activeRooms = new Map(); // conversationId -> Set of socketIds
const activeCalls = new Map(); // Track active calls to prevent duplicates

// Socket.IO Connection Handler with enhanced logging
io.on('connection', (socket) => {
    console.log('🔗 New Socket.IO connection:', {
        socketId: socket.id,
        transport: socket.conn.transport.name,
        remoteAddress: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent'],
        origin: socket.handshake.headers.origin,
        referer: socket.handshake.headers.referer
    });

    // Log transport upgrades
    socket.conn.on('upgrade', (transport) => {
        console.log('⬆️ Socket transport upgraded:', socket.id, 'to', transport.name);
    });

    // Handle user authentication and join
    socket.on('user:join', async (userIdOrData) => {
        try {
            // Handle both userId string and userData object for backward compatibility
            const userId = typeof userIdOrData === 'string' ? userIdOrData : userIdOrData.userId;
            const username = typeof userIdOrData === 'object' ? userIdOrData.username : null;
            
            socket.userId = userId;
            if (username) socket.username = username;
            
            // Join user to their personal room for notifications
            socket.join(userId);
            console.log(`👤 User ${userId} joined their personal room`);
            
            // Store active user
            activeUsers.set(userId, {
                socketId: socket.id,
                status: 'online',
                lastSeen: new Date()
            });

            // Confirm successful join
            socket.emit('user:joined', { 
                userId, 
                status: 'connected',
                message: 'Successfully connected to real-time notifications' 
            });

            // Skip conversation room joining for now to avoid database issues
            console.log(`✅ User ${userId} successfully joined and ready for notifications`);
            
        } catch (error) {
            console.error('❌ Error in user:join:', error);
            socket.emit('error', { message: 'Failed to join notifications' });
        }
    });

    // Handle sending messages
    socket.on('message:send', async (messageData) => {
        try {
            const { conversationId, messageText, messageType = 'text', fileUrl, fileName, replyToMessageId } = messageData;
            const senderId = socket.userId;

            if (!senderId) {
                socket.emit('error', { message: 'User not authenticated' });
                return;
            }

            // Verify user is participant in conversation
            const participantCheck = await client.query(
                'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
                [conversationId, senderId]
            );

            if (participantCheck.rows.length === 0) {
                socket.emit('error', { message: 'Not authorized to send message to this conversation' });
                return;
            }

            // Insert message
            const messageId = uuidv4();
            const insertMessageQuery = `
                INSERT INTO messages (message_id, conversation_id, sender_id, message_text, message_type, file_url, file_name, reply_to_message_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING message_id, created_at
            `;
            
            const messageResult = await client.query(insertMessageQuery, [
                messageId, conversationId, senderId, messageText, messageType, fileUrl, fileName, replyToMessageId
            ]);

            // Get sender info
            const senderInfo = await client.query(
                'SELECT username, display_name, profile_picture_url FROM users WHERE user_id = $1',
                [senderId]
            );

            const message = {
                message_id: messageId,
                conversation_id: conversationId,
                sender_id: senderId,
                sender_username: senderInfo.rows[0].username,
                sender_display_name: senderInfo.rows[0].display_name,
                sender_profile_picture: senderInfo.rows[0].profile_picture_url,
                message_text: messageText,
                message_type: messageType,
                file_url: fileUrl,
                file_name: fileName,
                reply_to_message_id: replyToMessageId,
                created_at: messageResult.rows[0].created_at,
                reactions: []
            };

            // Update conversation updated_at
            await client.query(
                'UPDATE conversations SET updated_at = NOW() WHERE conversation_id = $1',
                [conversationId]
            );

            // Broadcast message to conversation room
            io.to(conversationId).emit('message:receive', message);

            console.log(`📨 Message sent in conversation ${conversationId}`);
        } catch (error) {
            console.error('❌ Error in message:send:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    // Handle typing indicators
    socket.on('typing:start', async (data) => {
        const { conversationId } = data;
        const userId = socket.userId;

        if (!userId) return;

        try {
            // Insert/update typing indicator
            await client.query(`
                INSERT INTO typing_indicators (conversation_id, user_id, expires_at)
                VALUES ($1, $2, NOW() + INTERVAL '10 seconds')
                ON CONFLICT (conversation_id, user_id) 
                DO UPDATE SET started_at = NOW(), expires_at = NOW() + INTERVAL '10 seconds'
            `, [conversationId, userId]);

            // Broadcast to others in conversation
            io.to(conversationId).emit('typing:user_start', {
                userId: userId,
                username: socket.username
            });
        } catch (error) {
            console.error('❌ Error in typing:start:', error);
        }
    });

    socket.on('typing:stop', async (data) => {
        const { conversationId } = data;
        const userId = socket.userId;

        if (!userId) return;

        try {
            // Remove typing indicator
            await client.query(
                'DELETE FROM typing_indicators WHERE conversation_id = $1 AND user_id = $2',
                [conversationId, userId]
            );

            // Broadcast to others in conversation
            io.to(conversationId).emit('typing:user_stop', {
                userId: userId
            });
        } catch (error) {
            console.error('❌ Error in typing:stop:', error);
        }
    });

    // WebRTC Signaling for Voice/Video Calls
    // WebRTC Call Start Handler
    socket.on('webrtc:call-start', async (data) => {
        const { callId, callerId, targetUserId, conversationId, type, offer } = data;
        const senderId = socket.userId;

        console.log(`🔥 WebRTC CALL START:`, {
            callId,
            callerId: callerId || senderId,
            targetUserId,
            type,
            conversationId,
            hasOffer: !!offer
        });

        const actualCallerId = callerId || senderId;
        if (!actualCallerId) {
            console.error('❌ No callerId found');
            socket.emit('webrtc:call-failed', { error: 'No caller ID' });
            return;
        }

        try {
            // Store call in active calls
            activeCalls.set(callId, {
                callId,
                callerId: actualCallerId,
                targetUserId,
                conversationId,
                type,
                status: 'ringing',
                startTime: Date.now()
            });

            console.log(`👤 Caller: ${actualCallerId}`);
            console.log(`🎯 Target user: ${targetUserId}`);
            console.log(`👥 Active users:`, Array.from(activeUsers.keys()));

            // Check if target user is online
            const targetUser = activeUsers.get(targetUserId);
            if (targetUser) {
                console.log(`📞 Target user IS ONLINE - sending call`);
                
                // Send to target user's personal room
                io.to(targetUserId).emit('webrtc:incoming-call', {
                    callId,
                    callerId: actualCallerId,
                    conversationId,
                    type,
                    offer // Include WebRTC offer
                });
                
                console.log(`✅ WebRTC call notification sent successfully`);
            } else {
                console.log(`📵 Target user IS OFFLINE: ${targetUserId}`);
                
                // Remove call from active calls
                activeCalls.delete(callId);
                
                // Notify caller user is offline
                socket.emit('webrtc:call-failed', {
                    callId,
                    error: 'User is offline'
                });
            }

        } catch (error) {
            console.error('❌ Error in webrtc:call-start:', error);
            socket.emit('webrtc:call-failed', { callId, error: error.message });
        }
    });

    // Test notification function
    socket.on('test:notification', (data) => {
        const { targetUserId, message } = data;
        const senderId = socket.userId;
        
        console.log(`🧪 TEST NOTIFICATION:`, {
            from: senderId,
            to: targetUserId,
            message
        });
        
        // Send test notification to target user
        io.to(targetUserId).emit('test:received', {
            from: senderId,
            message: message || 'Test notification!'
        });
        
        console.log(`✅ Test notification sent to room: ${targetUserId}`);
    });

    // WebRTC Call Answer Handler
    socket.on('webrtc:call-answer', async (data) => {
        const { callId, answer } = data;
        const answererId = socket.userId;

        console.log(`🔥 WebRTC CALL ANSWER:`, {
            callId,
            answererId,
            hasAnswer: !!answer
        });

        if (!answererId) {
            console.error('❌ No answererId found in socket');
            return;
        }

        try {
            // Get call info
            const call = activeCalls.get(callId);
            if (!call) {
                console.error(`❌ Call ${callId} not found in active calls`);
                return;
            }

            // Update call status
            call.status = 'answered';
            call.answerTime = Date.now();
            activeCalls.set(callId, call);

            console.log(`📞 Sending webrtc:call-answered to caller: ${call.callerId}`);
            
            // Send answer back to caller
            io.to(call.callerId).emit('webrtc:call-answer', {
                callId,
                answererId,
                answer // Include WebRTC answer
            });

            console.log(`✅ WebRTC call answered: ${call.callerId} <- ${answererId}`);
            
        } catch (error) {
            console.error('❌ Error in webrtc:call-answer:', error);
        }
    });

    // Handle WebRTC signaling
    // WebRTC ICE Candidate Handler
    socket.on('webrtc:ice-candidate', async (data) => {
        const { callId, candidate, targetUserId } = data;
        const senderId = socket.userId;
        
        console.log(`📡 WebRTC ICE candidate: ${senderId} -> ${targetUserId}`);
        console.log(` Candidate type:`, candidate?.candidate?.split(' ')[7] || 'unknown');
        
        // Relay ICE candidate to target user
        const targetUser = activeUsers.get(targetUserId);
        if (targetUser) {
            io.to(targetUserId).emit('webrtc:ice-candidate', {
                callId,
                candidate,
                senderId
            });
            
            console.log(`✅ ICE candidate relayed to ${targetUserId}`);
        } else {
            console.error(`❌ Target user ${targetUserId} not online for ICE candidate`);
        }
    });

    // WebRTC Call Decline Handler
    socket.on('webrtc:call-decline', async (data) => {
        const { callId } = data;
        const declinerId = socket.userId;
        
        console.log(`❌ WebRTC call declined: ${declinerId} declined call ${callId}`);
        
        try {
            // Get call info
            const call = activeCalls.get(callId);
            if (call) {
                // Notify caller
                io.to(call.callerId).emit('webrtc:call-decline', {
                    callId,
                    declinerId
                });
                
                // Remove from active calls
                activeCalls.delete(callId);
                
                console.log(`📞 Call ${callId} declined and removed`);
            }
        } catch (error) {
            console.error('❌ Error in webrtc:call-decline:', error);
        }
    });

    // WebRTC Call End Handler
    socket.on('webrtc:call-end', async (data) => {
        const { callId, targetUserId } = data;
        const senderId = socket.userId;

        console.log(`📞 WebRTC call ended: ${senderId} ended call ${callId}`);

        try {
            // Get call info
            const call = activeCalls.get(callId);
            if (call) {
                // Calculate duration
                const duration = Math.floor((Date.now() - call.startTime) / 1000);
                
                // Notify other participant
                const otherUserId = call.callerId === senderId ? call.targetUserId : call.callerId;
                if (otherUserId) {
                    io.to(otherUserId).emit('webrtc:call-end', {
                        callId,
                        endedBy: senderId,
                        duration
                    });
                    
                    console.log(`✅ Call end notification sent to ${otherUserId}`);
                }
                
                // Remove from active calls
                activeCalls.delete(callId);
                
                console.log(`📞 Call ${callId} ended (duration: ${duration}s)`);
            } else {
                console.log(`⚠️ Call ${callId} not found in active calls`);
                
                // Still try to notify target user
                if (targetUserId) {
                    io.to(targetUserId).emit('webrtc:call-end', {
                        callId,
                        endedBy: senderId
                    });
                }
            }
        } catch (error) {
            console.error('❌ Error in webrtc:call-end:', error);
        }
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
        const userId = socket.userId;
        
        console.log(`🔌 User disconnecting: ${userId || socket.id}`);
        
        if (userId) {
            // Clean up active calls involving this user
            for (const [callKey, callData] of activeCalls.entries()) {
                if (callKey.includes(userId)) {
                    console.log(`📞 Auto-ending call due to disconnect: ${callKey}`);
                    activeCalls.delete(callKey);
                }
            }

            // Update user status to offline
            activeUsers.delete(userId);
            
            // Remove from active rooms
            for (const [roomId, sockets] of activeRooms.entries()) {
                sockets.delete(socket.id);
                if (sockets.size === 0) {
                    activeRooms.delete(roomId);
                }
            }

            // Remove typing indicators
            try {
                await client.query('DELETE FROM typing_indicators WHERE user_id = $1', [userId]);
                
                // End any active calls in database
                await client.query(`
                    UPDATE call_logs 
                    SET status = 'ended', ended_at = NOW(),
                        duration = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
                    WHERE (caller_id = $1) AND status IN ('initiated', 'answered')
                `, [userId]);
                
            } catch (error) {
                console.error('❌ Error cleaning up on disconnect:', error);
            }

            // Broadcast user offline status
            socket.broadcast.emit('user:status_changed', {
                userId: userId,
                status: 'offline',
                lastSeen: new Date()
            });
            
            console.log(`✅ User ${userId} cleanup completed`);
        }

        console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
});

// Chat API Endpoints

// Get user's conversations
app.get('/api/chats', async (req, res) => {
    try {
        const { userId } = req.query;
        console.log(`🔍 Fetching chats for userId: ${userId}`);
        
        if (!userId) {
            console.log('❌ Missing userId in request');
            return res.status(400).send({ error: 'User ID is required' });
        }

        console.log('📝 Executing conversations query...');
        const conversationsQuery = `
            SELECT 
                c.conversation_id,
                c.type,
                c.name,
                c.avatar_url,
                c.created_by,
                c.created_at,
                c.updated_at,
                (
                    SELECT json_agg(
                        json_build_object(
                            'user_id', u.user_id,
                            'username', u.username,
                            'display_name', u.display_name,
                            'profile_picture_url', u.profile_picture_url,
                            'role', cp.role
                        )
                    )
                    FROM conversation_participants cp
                    JOIN users u ON cp.user_id = u.user_id
                    WHERE cp.conversation_id = c.conversation_id
                ) as participants,
                (
                    SELECT json_build_object(
                        'message_id', m.message_id,
                        'sender_id', m.sender_id,
                        'sender_username', u.username,
                        'sender_display_name', u.display_name,
                        'message_text', m.message_text,
                        'message_type', m.message_type,
                        'created_at', m.created_at
                    )
                    FROM messages m
                    JOIN users u ON m.sender_id = u.user_id
                    WHERE m.conversation_id = c.conversation_id
                    ORDER BY m.created_at DESC
                    LIMIT 1
                ) as last_message,
                (
                    SELECT COUNT(*)::INTEGER
                    FROM messages m
                    LEFT JOIN message_status ms ON m.message_id = ms.message_id AND ms.user_id = $1
                    WHERE m.conversation_id = c.conversation_id 
                    AND m.sender_id != $1
                    AND (ms.status IS NULL OR ms.status != 'read')
                ) as unread_count
            FROM conversations c
            JOIN conversation_participants cp ON c.conversation_id = cp.conversation_id
            WHERE cp.user_id = $1 AND c.is_active = true
            ORDER BY c.updated_at DESC
        `;

        const result = await client.query(conversationsQuery, [userId]);
        console.log(`✅ Found ${result.rows.length} conversations for user ${userId}`);
        res.status(200).send(result.rows);
    } catch (error) {
        console.error('❌ Error fetching conversations:', error.message);
        console.error('📍 Stack trace:', error.stack);
        
        // If it's a table-related error, return empty array instead of failing
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
            console.log('🔄 Database tables not found, returning empty array');
            return res.status(200).send([]);
        }
        
        res.status(500).send({ 
            error: 'Failed to fetch conversations',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Create new conversation
app.post('/api/chats', async (req, res) => {
    try {
        const { createdBy, type = 'direct', name, participants } = req.body;
        
        if (!createdBy || !participants || participants.length === 0) {
            return res.status(400).send({ error: 'Creator and participants are required' });
        }

        await client.query('BEGIN');

        const conversationId = uuidv4();
        
        // Create conversation
        await client.query(`
            INSERT INTO conversations (conversation_id, type, name, created_by)
            VALUES ($1, $2, $3, $4)
        `, [conversationId, type, name, createdBy]);

        // Add participants (including creator)
        const allParticipants = [...new Set([createdBy, ...participants])];
        for (const participantId of allParticipants) {
            const role = participantId === createdBy ? 'admin' : 'member';
            await client.query(`
                INSERT INTO conversation_participants (conversation_id, user_id, role)
                VALUES ($1, $2, $3)
            `, [conversationId, participantId, role]);
        }

        await client.query('COMMIT');

        // Return the new conversation
        const newConversation = await client.query(`
            SELECT c.*, 
                   json_agg(
                       json_build_object(
                           'user_id', u.user_id,
                           'username', u.username,
                           'display_name', u.display_name,
                           'profile_picture_url', u.profile_picture_url
                       )
                   ) as participants
            FROM conversations c
            JOIN conversation_participants cp ON c.conversation_id = cp.conversation_id
            JOIN users u ON cp.user_id = u.user_id
            WHERE c.conversation_id = $1
            GROUP BY c.conversation_id
        `, [conversationId]);

        res.status(201).send(newConversation.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating conversation:', error);
        res.status(500).send({ error: 'Failed to create conversation' });
    }
});

// Get messages for a conversation
app.get('/api/chats/:conversationId/messages', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { userId, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        if (!userId) return res.status(400).send({ error: 'User ID is required' });

        // Verify user is participant
        const participantCheck = await client.query(
            'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
            [conversationId, userId]
        );

        if (participantCheck.rows.length === 0) {
            return res.status(403).send({ error: 'Not authorized to view this conversation' });
        }

        // Get messages with sender info and reactions
        const messagesQuery = `
            SELECT 
                m.message_id,
                m.conversation_id,
                m.sender_id,
                u.username as sender_username,
                u.display_name as sender_display_name,
                u.profile_picture_url as sender_profile_picture,
                m.message_text,
                m.message_type,
                m.file_url,
                m.file_name,
                m.call_data,
                m.reply_to_message_id,
                m.created_at,
                m.edited_at,
                COALESCE(
                    json_agg(
                        CASE WHEN mr.reaction_id IS NOT NULL THEN
                            json_build_object(
                                'emoji', mr.emoji,
                                'user_id', mr.user_id,
                                'username', ru.username
                            )
                        END
                    ) FILTER (WHERE mr.reaction_id IS NOT NULL),
                    '[]'::json
                ) as reactions
            FROM messages m
            JOIN users u ON m.sender_id = u.user_id
            LEFT JOIN message_reactions mr ON m.message_id = mr.message_id
            LEFT JOIN users ru ON mr.user_id = ru.user_id
            WHERE m.conversation_id = $1 AND m.is_deleted = false
            GROUP BY m.message_id, u.user_id
            ORDER BY m.created_at DESC
            LIMIT $2 OFFSET $3
        `;

        const result = await client.query(messagesQuery, [conversationId, limit, offset]);
        const messages = result.rows.reverse(); // Reverse to show oldest first

        res.status(200).send(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).send({ error: 'Failed to fetch messages' });
    }
});

// Mark messages as read
app.put('/api/chats/:conversationId/read', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { userId, lastReadMessageId } = req.body;

        if (!userId) return res.status(400).send({ error: 'User ID is required' });

        // Update participant's last_read_at
        await client.query(`
            UPDATE conversation_participants 
            SET last_read_at = NOW()
            WHERE conversation_id = $1 AND user_id = $2
        `, [conversationId, userId]);

        // Mark messages as read
        if (lastReadMessageId) {
            await client.query(`
                INSERT INTO message_status (message_id, user_id, status)
                SELECT m.message_id, $2, 'read'
                FROM messages m
                WHERE m.conversation_id = $1 
                AND m.sender_id != $2
                AND m.created_at <= (
                    SELECT created_at FROM messages WHERE message_id = $3
                )
                ON CONFLICT (message_id, user_id) 
                DO UPDATE SET status = 'read', timestamp = NOW()
            `, [conversationId, userId, lastReadMessageId]);
        }

        res.status(200).send({ message: 'Messages marked as read' });
    } catch (error) {
        console.error('Error marking messages as read:', error);
        res.status(500).send({ error: 'Failed to mark messages as read' });
    }
});

// Add reaction to message
app.post('/api/messages/:messageId/reactions', async (req, res) => {
    try {
        const { messageId } = req.params;
        const { userId, emoji } = req.body;

        if (!userId || !emoji) {
            return res.status(400).send({ error: 'User ID and emoji are required' });
        }

        // Check if reaction already exists
        const existingReaction = await client.query(
            'SELECT reaction_id FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
            [messageId, userId, emoji]
        );

        if (existingReaction.rows.length > 0) {
            // Remove reaction
            await client.query(
                'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
                [messageId, userId, emoji]
            );
        } else {
            // Add reaction
            await client.query(
                'INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)',
                [messageId, userId, emoji]
            );
        }

        // Get conversation ID for broadcasting
        const messageInfo = await client.query(
            'SELECT conversation_id FROM messages WHERE message_id = $1',
            [messageId]
        );

        if (messageInfo.rows.length > 0) {
            const conversationId = messageInfo.rows[0].conversation_id;
            
            // Get updated reactions
            const reactions = await client.query(`
                SELECT mr.emoji, mr.user_id, u.username
                FROM message_reactions mr
                JOIN users u ON mr.user_id = u.user_id
                WHERE mr.message_id = $1
            `, [messageId]);

            // Broadcast reaction update
            io.to(conversationId).emit('message:reaction_updated', {
                messageId,
                reactions: reactions.rows
            });
        }

        res.status(200).send({ message: 'Reaction updated' });
    } catch (error) {
        console.error('Error updating reaction:', error);
        res.status(500).send({ error: 'Failed to update reaction' });
    }
});

// Get call logs for a conversation
app.get('/api/chats/:conversationId/calls', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        const callsQuery = `
            SELECT 
                cl.*,
                u.username as caller_username,
                u.display_name as caller_display_name,
                u.profile_picture_url as caller_profile_picture
            FROM call_logs cl
            JOIN users u ON cl.caller_id = u.user_id
            WHERE cl.conversation_id = $1
            ORDER BY cl.created_at DESC
            LIMIT $2 OFFSET $3
        `;

        const result = await client.query(callsQuery, [conversationId, limit, offset]);
        res.status(200).send(result.rows);
    } catch (error) {
        console.error('Error fetching call logs:', error);
        res.status(500).send({ error: 'Failed to fetch call logs' });
    }
});

// Get missed calls for a user
app.get('/api/users/:userId/missed-calls', async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        const missedCallsQuery = `
            SELECT 
                cl.*,
                u.username as caller_username,
                u.display_name as caller_display_name,
                u.profile_picture_url as caller_profile_picture,
                c.conversation_id,
                c.conversation_name
            FROM call_logs cl
            JOIN users u ON cl.caller_id = u.user_id
            JOIN conversations c ON cl.conversation_id = c.conversation_id
            JOIN conversation_participants cp ON c.conversation_id = cp.conversation_id
            WHERE cp.user_id = $1 
            AND cl.caller_id != $1
            AND cl.status = 'missed'
            ORDER BY cl.created_at DESC
            LIMIT $2 OFFSET $3
        `;

        const result = await client.query(missedCallsQuery, [userId, limit, offset]);
        res.status(200).send(result.rows);
    } catch (error) {
        console.error('Error fetching missed calls:', error);
        res.status(500).send({ error: 'Failed to fetch missed calls' });
    }
});

// File upload for chat
app.post('/api/upload/chat-file', (req, res) => {
    try {
        const { fileName, conversationId } = req.body;
        if (!fileName || !conversationId) {
            return res.status(400).send({ error: 'fileName and conversationId are required.' });
        }

        const containerName = 'chat-files';
        const blobName = `${conversationId}/${Date.now()}-${fileName}`;
        
        const sasToken = generateBlobSASQueryParameters({
            containerName, blobName,
            permissions: BlobSASPermissions.parse("w"),
            startsOn: new Date(),
            expiresOn: new Date(new Date().valueOf() + 3600 * 1000)
        }, sharedKeyCredential).toString();
        
        const uploadUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}?${sasToken}`;
        const fileUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}`;
        
        res.status(200).send({ uploadUrl, fileUrl, blobName });
    } catch (error) {
        console.error('Error generating chat file upload URL:', error);
        res.status(500).send({ error: 'Failed to generate chat file upload URL.' });
    }
});

// Existing API endpoints continue below...

app.post('/api/generate-upload-url', (req, res) => {
    try {
        const { fileName } = req.body;
        if (!fileName) return res.status(400).send({ error: 'fileName is required.' });
        const containerName = 'profile-pictures'; 
        const blobName = `${Date.now()}-${fileName}`;
        const sasToken = generateBlobSASQueryParameters({
            containerName, blobName,
            permissions: BlobSASPermissions.parse("w"),
            startsOn: new Date(),
            expiresOn: new Date(new Date().valueOf() + 3600 * 1000)
        }, sharedKeyCredential).toString();
        const uploadUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}?${sasToken}`;
        res.status(200).send({ uploadUrl, blobName });
    } catch (error) {
        res.status(500).send({ error: 'Failed to generate profile picture upload URL.' });
    }
});

app.post('/api/generate-post-upload-url', (req, res) => {
    try {
        const { fileName } = req.body;
        if (!fileName) return res.status(400).send({ error: 'fileName is required.' });
        const containerName = 'post-images';
        const blobName = `${Date.now()}-${fileName}`;
        const sasToken = generateBlobSASQueryParameters({
            containerName, blobName,
            permissions: BlobSASPermissions.parse("w"),
            startsOn: new Date(),
            expiresOn: new Date(new Date().valueOf() + 3600 * 1000)
        }, sharedKeyCredential).toString();
        const uploadUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}?${sasToken}`;
        res.status(200).send({ uploadUrl, blobName });
    } catch (error) {
        res.status(500).send({ error: 'Failed to generate post upload URL.' });
    }
});

app.post('/api/posts', async (req, res) => {
    try {
        const { userId, description, imageUrls } = req.body;
        if (!userId || !description) return res.status(400).send({ error: 'userId and description are required.' });
        
        const checkUserQuery = `SELECT user_id FROM users WHERE user_id = $1`;
        const userResult = await client.query(checkUserQuery, [userId]);
        
        if (userResult.rows.length === 0) {
            const createUserQuery = `
                INSERT INTO users (user_id, username, email, display_name, display_name_lowercase, created_at) 
                VALUES ($1, $2, $3, $4, $5, NOW())
            `;
            const tempUsername = `user_${userId.slice(-8)}`;
            const tempEmail = `${userId}@temp.com`;
            const tempDisplayName = `User ${userId.slice(-8)}`;
            await client.query(createUserQuery, [userId, tempUsername, tempEmail, tempDisplayName, tempDisplayName.toLowerCase()]);
        }
        
        const insertPostQuery = `
            INSERT INTO posts (user_id, description) 
            VALUES ($1, $2) 
            RETURNING post_id, created_at
        `;
        const postResult = await client.query(insertPostQuery, [userId, description]);
        const postId = postResult.rows[0].post_id;
        
        if (imageUrls && imageUrls.length > 0) {
            const insertImageQuery = `
                INSERT INTO post_images (post_id, image_url) 
                VALUES ($1, $2)
            `;
            for (const imageUrl of imageUrls) {
                await client.query(insertImageQuery, [postId, imageUrl]);
            }
        }
        
        res.status(201).send({ message: 'Post created successfully', postId });
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).send({ error: 'Failed to create post.' });
    }
});

app.get('/api/posts', async (req, res) => {
    try {
        const postsQuery = `
            SELECT 
                p.post_id as id,
                p.user_id as "userId",
                p.description,
                p.created_at,
                u.username,
                u.display_name as "displayName",
                u.profile_picture_url as "profilePictureUrl",
                COALESCE(
                    json_agg(
                        DISTINCT pi.image_url
                    ) FILTER (WHERE pi.image_url IS NOT NULL), 
                    '[]'::json
                ) as "imageUrls",
                COALESCE(
                    json_agg(
                        DISTINCT jsonb_build_object(
                            'userId', l.user_id
                        )
                    ) FILTER (WHERE l.user_id IS NOT NULL), 
                    '[]'::json
                ) as likes,
                COALESCE(
                    json_agg(
                        DISTINCT jsonb_build_object(
                            'userId', c.user_id,
                            'text', c.comment_text,
                            'createdAt', EXTRACT(EPOCH FROM c.created_at) * 1000
                        )
                    ) FILTER (WHERE c.comment_text IS NOT NULL), 
                    '[]'::json
                ) as comments
            FROM posts p
            JOIN users u ON p.user_id = u.user_id
            LEFT JOIN post_images pi ON p.post_id = pi.post_id
            LEFT JOIN likes l ON p.post_id = l.post_id
            LEFT JOIN comments c ON p.post_id = c.post_id
            GROUP BY p.post_id, p.user_id, p.description, p.created_at, u.username, u.display_name, u.profile_picture_url
            ORDER BY p.created_at DESC
        `;
        
        const result = await client.query(postsQuery);
        
        const posts = result.rows.map(row => ({
            ...row,
            createdAt: new Date(row.created_at).getTime()
        }));
        
        res.status(200).send(posts);
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).send({ error: 'Failed to fetch posts.' });
    }
});

app.delete('/api/posts/:postId', async (req, res) => {
    try {
        const { postId } = req.params;
        const { userId } = req.body;
        if (!userId) return res.status(400).send({ error: 'User ID is required.' });
        
        const checkPostQuery = `SELECT user_id FROM posts WHERE post_id = $1`;
        const checkResult = await client.query(checkPostQuery, [postId]);
        
        if (checkResult.rows.length === 0) {
            return res.status(404).send({ error: 'Post not found.' });
        }
        
        if (checkResult.rows[0].user_id !== userId) {
            return res.status(403).send({ error: 'Forbidden' });
        }
        
        const deletePostQuery = `DELETE FROM posts WHERE post_id = $1`;
        await client.query(deletePostQuery, [postId]);
        
        res.status(200).send({ message: 'Post deleted successfully.' });
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).send({ error: 'Failed to delete post.' });
    }
});

app.post('/api/posts/:postId/like', async (req, res) => {
    try {
        const { postId } = req.params;
        const { userId } = req.body;
        if (!userId) return res.status(400).send({ error: 'userId is required.' });
        
        const checkPostQuery = `SELECT post_id FROM posts WHERE post_id = $1`;
        const postResult = await client.query(checkPostQuery, [postId]);
        if (postResult.rows.length === 0) {
            return res.status(404).send({ error: 'Post not found.' });
        }
        
        const checkLikeQuery = `SELECT 1 FROM likes WHERE post_id = $1 AND user_id = $2`;
        const likeResult = await client.query(checkLikeQuery, [postId, userId]);
        
        if (likeResult.rows.length > 0) {
            const deleteLikeQuery = `DELETE FROM likes WHERE post_id = $1 AND user_id = $2`;
            await client.query(deleteLikeQuery, [postId, userId]);
        } else {
            const insertLikeQuery = `INSERT INTO likes (post_id, user_id) VALUES ($1, $2)`;
            await client.query(insertLikeQuery, [postId, userId]);
        }
        
        res.status(200).send({ message: 'Like status updated.' });
    } catch (error) {
        console.error('Error updating like status:', error);
        res.status(500).send({ error: 'Failed to update like status.' });
    }
});

app.post('/api/posts/:postId/comment', async (req, res) => {
    try {
        const { postId } = req.params;
        const { userId, text } = req.body;
        if (!userId || !text) return res.status(400).send({ error: 'userId and text are required.' });
        
        const checkPostQuery = `SELECT post_id FROM posts WHERE post_id = $1`;
        const postResult = await client.query(checkPostQuery, [postId]);
        if (postResult.rows.length === 0) {
            return res.status(404).send({ error: 'Post not found.' });
        }
        
        const insertCommentQuery = `
            INSERT INTO comments (post_id, user_id, comment_text) 
            VALUES ($1, $2, $3)
        `;
        await client.query(insertCommentQuery, [postId, userId, text]);
        
        const updatedPostQuery = `
            SELECT 
                p.post_id as id,
                p.user_id as "userId",
                p.description,
                p.created_at,
                u.username,
                u.display_name as "displayName",
                u.profile_picture_url as "profilePictureUrl",
                COALESCE(
                    json_agg(
                        DISTINCT pi.image_url
                    ) FILTER (WHERE pi.image_url IS NOT NULL), 
                    '[]'::json
                ) as "imageUrls",
                COALESCE(
                    json_agg(
                        DISTINCT jsonb_build_object(
                            'userId', l.user_id
                        )
                    ) FILTER (WHERE l.user_id IS NOT NULL), 
                    '[]'::json
                ) as likes,
                COALESCE(
                    json_agg(
                        DISTINCT jsonb_build_object(
                            'userId', c.user_id,
                            'text', c.comment_text,
                            'createdAt', EXTRACT(EPOCH FROM c.created_at) * 1000
                        )
                    ) FILTER (WHERE c.comment_text IS NOT NULL), 
                    '[]'::json
                ) as comments
            FROM posts p
            JOIN users u ON p.user_id = u.user_id
            LEFT JOIN post_images pi ON p.post_id = pi.post_id
            LEFT JOIN likes l ON p.post_id = l.post_id
            LEFT JOIN comments c ON p.post_id = c.post_id
            WHERE p.post_id = $1
            GROUP BY p.post_id, p.user_id, p.description, p.created_at, u.username, u.display_name, u.profile_picture_url
        `;
        
        const result = await client.query(updatedPostQuery, [postId]);
        const updatedPost = {
            ...result.rows[0],
            createdAt: new Date(result.rows[0].created_at).getTime()
        };
        
        res.status(201).send(updatedPost);
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).send({ error: 'Failed to add comment.' });
    }
});

app.delete('/api/comments/:commentId', async (req, res) => {
    try {
        const { commentId } = req.params;
        const { userId } = req.body;
        if (!userId) return res.status(400).send({ error: 'User ID is required.' });
        
        const checkCommentQuery = `SELECT user_id, post_id FROM comments WHERE comment_id = $1`;
        const checkResult = await client.query(checkCommentQuery, [commentId]);
        
        if (checkResult.rows.length === 0) {
            return res.status(404).send({ error: 'Comment not found.' });
        }
        
        if (checkResult.rows[0].user_id !== userId) {
            return res.status(403).send({ error: 'Forbidden' });
        }
        
        const deleteCommentQuery = `DELETE FROM comments WHERE comment_id = $1`;
        await client.query(deleteCommentQuery, [commentId]);
        
        res.status(200).send({ message: 'Comment deleted successfully.' });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).send({ error: 'Failed to delete comment.' });
    }
});

app.get('/api/users/search', async (req, res) => {
    try {
        const { query } = req.query;
        if (!query || query.length < 2) return res.status(200).send([]);
        
        const searchQuery = `
            SELECT 
                user_id as id,
                username,
                display_name as "displayName",
                profile_picture_url as "profilePictureUrl",
                bio
            FROM users 
            WHERE 
                LOWER(display_name) LIKE LOWER($1) OR 
                LOWER(username) LIKE LOWER($1)
            ORDER BY 
                CASE 
                    WHEN LOWER(username) = LOWER($2) THEN 1
                    WHEN LOWER(display_name) = LOWER($2) THEN 2
                    WHEN LOWER(username) LIKE LOWER($1) THEN 3
                    ELSE 4
                END
            LIMIT 10
        `;
        
        const searchPattern = `%${query}%`;
        const result = await client.query(searchQuery, [searchPattern, query]);
        
        res.status(200).send(result.rows);
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).send({ error: 'Failed to search for users.' });
    }
});

app.post('/api/users/:userId/follow', async (req, res) => {
    try {
        const { userId: userToFollowId } = req.params;
        const { currentUserId } = req.body;
        if (!currentUserId || userToFollowId === currentUserId) {
            return res.status(400).send({ error: 'Invalid request.' });
        }
        
        const checkUsersQuery = `
            SELECT user_id FROM users WHERE user_id IN ($1, $2)
        `;
        const usersResult = await client.query(checkUsersQuery, [currentUserId, userToFollowId]);
        if (usersResult.rows.length < 2) {
            return res.status(404).send({ error: 'One or both users not found.' });
        }
        
        const insertConnectionQuery = `
            INSERT INTO user_connections (follower_id, following_id, created_at) 
            VALUES ($1, $2, NOW())
            ON CONFLICT (follower_id, following_id) DO NOTHING
        `;
        await client.query(insertConnectionQuery, [currentUserId, userToFollowId]);
        
        res.status(200).send({ message: 'Successfully followed user.' });
    } catch (error) {
        console.error('Error following user:', error);
        res.status(500).send({ error: 'Failed to follow user.' });
    }
});

app.post('/api/users/:userId/unfollow', async (req, res) => {
    try {
        const { userId: userToUnfollowId } = req.params;
        const { currentUserId } = req.body;
        if (!currentUserId) return res.status(400).send({ error: 'Current user ID is required.' });
        
        const deleteConnectionQuery = `
            DELETE FROM user_connections 
            WHERE follower_id = $1 AND following_id = $2
        `;
        await client.query(deleteConnectionQuery, [currentUserId, userToUnfollowId]);
        
        res.status(200).send({ message: 'Successfully unfollowed user.' });
    } catch (error) {
        console.error('Error unfollowing user:', error);
        res.status(500).send({ error: 'Failed to unfollow user.' });
    }
});

app.post('/api/users/:userId/request-connect', async (req, res) => {
    try {
        const { userId: recipientId } = req.params;
        const { currentUserId: senderId } = req.body;
        
        if (!senderId || recipientId === senderId) {
            return res.status(400).json({ error: 'Invalid request.' });
        }
        
        const checkUsersQuery = `SELECT user_id, display_name FROM users WHERE user_id IN ($1, $2)`;
        const usersResult = await client.query(checkUsersQuery, [senderId, recipientId]);
        
        if (usersResult.rows.length < 2) {
            return res.status(404).json({ error: 'One or both users not found.' });
        }
        
        const existingRequestQuery = `
            SELECT id FROM connection_requests 
            WHERE sender_id = $1 AND recipient_id = $2
        `;
        const existingRequest = await client.query(existingRequestQuery, [senderId, recipientId]);
        
        if (existingRequest.rows.length > 0) {
            return res.status(400).json({ error: 'Connection request already exists.' });
        }
        
        const connectionQuery = `
            SELECT connection_id FROM user_connections 
            WHERE follower_id = $1 AND following_id = $2
        `;
        const existingConnection = await client.query(connectionQuery, [senderId, recipientId]);
        
        if (existingConnection.rows.length > 0) {
            return res.status(400).json({ error: 'Users are already connected.' });
        }
        
        await client.query('BEGIN');
        
        try {
            const insertRequestQuery = `
                INSERT INTO connection_requests (sender_id, recipient_id, created_at) 
                VALUES ($1, $2, NOW())
                RETURNING id
            `;
            const requestResult = await client.query(insertRequestQuery, [senderId, recipientId]);
            
            const senderInfo = usersResult.rows.find(user => user.user_id === senderId);
            const senderName = senderInfo?.display_name || 'Someone';
            
            const notificationQuery = `
                INSERT INTO notifications (user_id, type, title, message, related_user_id, is_read, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
                RETURNING notification_id
            `;
            const notificationResult = await client.query(notificationQuery, [
                recipientId,
                'connection_request',
                'New Connection Request',
                `${senderName} wants to connect with you`,
                senderId,
                false
            ]);
            
            await client.query('COMMIT');
            
            res.status(200).json({ 
                message: 'Connection request sent successfully',
                requestId: requestResult.rows[0].id,
                notificationId: notificationResult.rows[0].notification_id
            });
            
        } catch (innerError) {
            await client.query('ROLLBACK');
            throw innerError;
        }
        
    } catch (error) {
        console.error('Error sending connection request:', error);
        res.status(500).json({ error: 'Failed to send connection request: ' + error.message });
    }
});

app.post('/api/users/:userId/accept-connect', async (req, res) => {
    try {
        const { userId: senderId } = req.params;
        const { currentUserId: recipientId } = req.body;
        
        if (!recipientId || senderId === recipientId) {
            return res.status(400).json({ error: 'Invalid request.' });
        }
        
        const checkRequestQuery = `
            SELECT id FROM connection_requests 
            WHERE sender_id = $1 AND recipient_id = $2
        `;
        const requestResult = await client.query(checkRequestQuery, [senderId, recipientId]);
        
        if (requestResult.rows.length === 0) {
            return res.status(404).json({ error: 'Connection request not found.' });
        }
        
        await client.query('BEGIN');
        
        try {
            const deleteRequestQuery = `
                DELETE FROM connection_requests 
                WHERE sender_id = $1 AND recipient_id = $2
            `;
            await client.query(deleteRequestQuery, [senderId, recipientId]);
            
            const insertConnectionQuery = `
                INSERT INTO user_connections (follower_id, following_id, created_at) 
                VALUES ($1, $2, NOW()), ($2, $1, NOW())
                ON CONFLICT (follower_id, following_id) DO NOTHING
            `;
            await client.query(insertConnectionQuery, [recipientId, senderId]);
            
            const getUsersQuery = `SELECT user_id, display_name FROM users WHERE user_id IN ($1, $2)`;
            const usersResult = await client.query(getUsersQuery, [senderId, recipientId]);
            const recipientInfo = usersResult.rows.find(user => user.user_id === recipientId);
            const recipientName = recipientInfo?.display_name || 'Someone';
            
            const notificationQuery = `
                INSERT INTO notifications (user_id, type, title, message, related_user_id, is_read, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
            `;
            await client.query(notificationQuery, [
                senderId,
                'connection_accepted',
                'Connection Request Accepted',
                `${recipientName} accepted your connection request`,
                recipientId,
                false
            ]);
            
            await client.query('COMMIT');
            
            res.status(200).json({ message: 'Connection accepted successfully.' });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Error accepting connection:', error);
        res.status(500).json({ error: 'Failed to accept connection: ' + error.message });
    }
});

app.post('/api/users/:userId/cancel-request', async (req, res) => {
    try {
        const { userId: recipientId } = req.params;
        const { currentUserId: senderId } = req.body;
        if (!senderId) return res.status(400).send({ error: 'Current user ID is required.' });
        
        const deleteRequestQuery = `
            DELETE FROM connection_requests 
            WHERE sender_id = $1 AND recipient_id = $2
        `;
        await client.query(deleteRequestQuery, [senderId, recipientId]);
        
        res.status(200).send({ message: 'Request cancelled.' });
    } catch (error) {
        console.error('Error cancelling request:', error);
        res.status(500).send({ error: 'Failed to cancel request.' });
    }
});

app.post('/api/users/:userId/reject-request', async (req, res) => {
    try {
        const { userId: senderId } = req.params;
        const { currentUserId: recipientId } = req.body;
        if (!recipientId || senderId === recipientId) {
            return res.status(400).send({ error: 'Invalid request.' });
        }
        
        const deleteRequestQuery = `
            DELETE FROM connection_requests 
            WHERE sender_id = $1 AND recipient_id = $2
        `;
        await client.query(deleteRequestQuery, [senderId, recipientId]);
        
        res.status(200).send({ message: 'Request rejected.' });
    } catch (error) {
        console.error('Error rejecting request:', error);
        res.status(500).send({ error: 'Failed to reject request.' });
    }
});

app.post('/api/users/notifications', async (req, res) => {
    try {
        const { userIds } = req.body;
        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(200).send([]);
        }
        
        const placeholders = userIds.map((_, index) => `$${index + 1}`).join(',');
        
        const getUsersQuery = `
            SELECT 
                user_id as id,
                username,
                display_name as "displayName",
                profile_picture_url as "profilePictureUrl",
                bio
            FROM users 
            WHERE user_id IN (${placeholders})
        `;
        
        const result = await client.query(getUsersQuery, userIds);
        res.status(200).send(result.rows);
    } catch (error) {
        console.error('Error fetching notification data:', error);
        res.status(500).send({ error: 'Failed to fetch notification data.' });
    }
});

app.get('/api/notifications/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 20, offset = 0 } = req.query;
        
        const getNotificationsQuery = `
            SELECT 
                n.notification_id,
                n.type,
                n.title,
                n.message,
                n.is_read,
                n.created_at,
                n.related_user_id,
                u.display_name as "fromUserName",
                u.username as "fromUserUsername",
                u.profile_picture_url as "fromUserProfilePicture"
            FROM notifications n
            LEFT JOIN users u ON n.related_user_id = u.user_id
            WHERE n.user_id = $1
            ORDER BY n.created_at DESC
            LIMIT $2 OFFSET $3
        `;
        
        const result = await client.query(getNotificationsQuery, [userId, limit, offset]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications.' });
    }
});

app.patch('/api/notifications/:notificationId/read', async (req, res) => {
    try {
        const { notificationId } = req.params;
        const { userId } = req.body;
        
        const updateQuery = `
            UPDATE notifications 
            SET is_read = true 
            WHERE notification_id = $1 AND user_id = $2
            RETURNING notification_id
        `;
        
        const result = await client.query(updateQuery, [notificationId, userId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Notification not found.' });
        }
        
        res.status(200).json({ message: 'Notification marked as read.' });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Failed to mark notification as read.' });
    }
});

app.get('/api/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`🔍 Fetching user data for userId: ${userId}`);
        
        const getUserQuery = `
            SELECT 
                user_id as id,
                username,
                display_name as "displayName",
                profile_picture_url as "profilePictureUrl",
                bio,
                headline,
                location,
                skills,
                social_links as "socialLinks",
                created_at as "createdAt"
            FROM users 
            WHERE user_id = $1
        `;
        
        console.log(`📝 Executing query: ${getUserQuery}`);
        console.log(`📝 Query parameters: [${userId}]`);
        const result = await client.query(getUserQuery, [userId]);
        console.log(`✅ Query result: ${result.rows.length} rows found`);
        
        if (result.rows.length === 0) {
            console.log(`❌ User not found: ${userId}`);
            return res.status(404).send({ error: 'User not found.' });
        }
        
        const user = result.rows[0];
        
        const followersQuery = `
            SELECT follower_id FROM user_connections WHERE following_id = $1
        `;
        const followersResult = await client.query(followersQuery, [userId]);
        user.followers = followersResult.rows.map(row => row.follower_id);
        
        const followingQuery = `
            SELECT following_id FROM user_connections WHERE follower_id = $1
        `;
        const followingResult = await client.query(followingQuery, [userId]);
        user.following = followingResult.rows.map(row => row.following_id);
        
        const requestsSentQuery = `
            SELECT recipient_id FROM connection_requests WHERE sender_id = $1
        `;
        const requestsSentResult = await client.query(requestsSentQuery, [userId]);
        user.connectionRequestsSent = requestsSentResult.rows.map(row => row.recipient_id);
        
        const requestsReceivedQuery = `
            SELECT sender_id FROM connection_requests WHERE recipient_id = $1
        `;
        const requestsReceivedResult = await client.query(requestsReceivedQuery, [userId]);
        user.connectionRequestsReceived = requestsReceivedResult.rows.map(row => row.sender_id);
        
        res.status(200).send(user);
    } catch (error) {
        console.error('❌ Error fetching user:', error.message);
        console.error('📍 Stack trace:', error.stack);
        console.error('🔍 Query parameters:', { userId: req.params.userId });
        res.status(500).send({ 
            error: 'Failed to fetch user.',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

app.put('/api/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { username, displayName, bio, headline, location, skills, socialLinks, profilePictureUrl } = req.body;
        
        const updateUserQuery = `
            UPDATE users 
            SET 
                username = COALESCE($2, username),
                display_name = COALESCE($3, display_name),
                bio = COALESCE($4, bio),
                headline = COALESCE($5, headline),
                location = COALESCE($6, location),
                skills = COALESCE($7::jsonb, skills),
                social_links = COALESCE($8::jsonb, social_links),
                profile_picture_url = COALESCE($9, profile_picture_url)
            WHERE user_id = $1
            RETURNING 
                user_id as id, 
                username, 
                display_name as "displayName", 
                bio, 
                headline,
                location,
                skills,
                social_links as "socialLinks",
                profile_picture_url as "profilePictureUrl"
        `;
        
        const result = await client.query(updateUserQuery, [
            userId, 
            username, 
            displayName, 
            bio, 
            headline, 
            location, 
            skills ? JSON.stringify(skills) : null,
            socialLinks ? JSON.stringify(socialLinks) : null,
            profilePictureUrl
        ]);
        if (result.rows.length === 0) {
            return res.status(404).send({ error: 'User not found.' });
        }
        
        res.status(200).send(result.rows[0]);
    } catch (error) {
        console.error('Error updating user:', error);
        if (error.code === '23505') {
            res.status(400).send({ error: 'Username already exists.' });
        } else {
            res.status(500).send({ error: 'Failed to update user.' });
        }
    }
});

app.post('/api/users', async (req, res) => {
    try {
        const { userId, username, email, displayName, profilePictureUrl, bio } = req.body;
        if (!userId || !username || !email || !displayName) {
            return res.status(400).send({ error: 'userId, username, email, and displayName are required.' });
        }
        
        const insertUserQuery = `
            INSERT INTO users (user_id, username, email, display_name, display_name_lowercase, profile_picture_url, bio, created_at) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                username = EXCLUDED.username,
                email = EXCLUDED.email,
                display_name = EXCLUDED.display_name,
                display_name_lowercase = EXCLUDED.display_name_lowercase,
                profile_picture_url = EXCLUDED.profile_picture_url,
                bio = EXCLUDED.bio
            RETURNING user_id as id, username, display_name as "displayName", profile_picture_url as "profilePictureUrl", bio
        `;
        
        const result = await client.query(insertUserQuery, [userId, username, email, displayName, displayName.toLowerCase(), profilePictureUrl, bio]);
        res.status(201).send(result.rows[0]);
    } catch (error) {
        console.error('Error creating user:', error);
        if (error.code === '23505') {
            res.status(400).send({ error: 'Username or email already exists.' });
        } else {
            res.status(500).send({ error: 'Failed to create user.' });
        }
    }
});

app.get('/api/users/:userId/connections', async (req, res) => {
    try {
        const { userId } = req.params;
        const { type } = req.query;
        
        let query;
        let params = [userId];
        
        if (type === 'followers') {
            query = `
                SELECT 
                    u.user_id as id,
                    u.username,
                    u.display_name as "displayName",
                    u.profile_picture_url as "profilePictureUrl",
                    u.bio
                FROM user_connections uc
                JOIN users u ON uc.follower_id = u.user_id
                WHERE uc.following_id = $1
                ORDER BY uc.created_at DESC
            `;
        } else if (type === 'following') {
            query = `
                SELECT 
                    u.user_id as id,
                    u.username,
                    u.display_name as "displayName",
                    u.profile_picture_url as "profilePictureUrl",
                    u.bio
                FROM user_connections uc
                JOIN users u ON uc.following_id = u.user_id
                WHERE uc.follower_id = $1
                ORDER BY uc.created_at DESC
            `;
        } else if (type === 'requests') {
            query = `
                SELECT 
                    u.user_id as id,
                    u.username,
                    u.display_name as "displayName",
                    u.profile_picture_url as "profilePictureUrl",
                    u.bio
                FROM connection_requests cr
                JOIN users u ON cr.sender_id = u.user_id
                WHERE cr.recipient_id = $1
                ORDER BY cr.created_at DESC
            `;
        } else {
            return res.status(400).send({ error: 'Invalid type parameter. Use followers, following, or requests.' });
        }
        
        const result = await client.query(query, params);
        res.status(200).send(result.rows);
    } catch (error) {
        console.error('Error fetching connections:', error);
        res.status(500).send({ error: 'Failed to fetch connections.' });
    }
});

app.post('/api/polls', async (req, res) => {
    try {
        const { userId, question, description, options, allowMultipleVotes, expiresAt } = req.body;
        if (!userId || !question || !options || options.length < 2) {
            return res.status(400).send({ error: 'userId, question, and at least 2 options are required.' });
        }
        if (options.length > 20) {
            return res.status(400).send({ error: 'Maximum 20 options allowed.' });
        }
        
        const checkUserQuery = `SELECT user_id FROM users WHERE user_id = $1`;
        const userResult = await client.query(checkUserQuery, [userId]);
        
        if (userResult.rows.length === 0) {
            const createUserQuery = `
                INSERT INTO users (user_id, username, email, display_name, display_name_lowercase, created_at) 
                VALUES ($1, $2, $3, $4, $5, NOW())
            `;
            const tempUsername = `user_${userId.slice(-8)}`;
            const tempEmail = `${userId}@temp.com`;
            const tempDisplayName = `User ${userId.slice(-8)}`;
            await client.query(createUserQuery, [userId, tempUsername, tempEmail, tempDisplayName, tempDisplayName.toLowerCase()]);
        }
        
        await client.query('BEGIN');
        
        try {
            const insertPollQuery = `
                INSERT INTO polls (user_id, question, description, allow_multiple_votes, expires_at) 
                VALUES ($1, $2, $3, $4, $5) 
                RETURNING poll_id, created_at
            `;
            const pollResult = await client.query(insertPollQuery, [
                userId, 
                question, 
                description, 
                allowMultipleVotes || false,
                expiresAt ? new Date(expiresAt) : null
            ]);
            const pollId = pollResult.rows[0].poll_id;
            
            const insertOptionQuery = `
                INSERT INTO poll_options (poll_id, option_text, option_order) 
                VALUES ($1, $2, $3)
            `;
            for (let i = 0; i < options.length; i++) {
                await client.query(insertOptionQuery, [pollId, options[i], i + 1]);
            }
            
            await client.query('COMMIT');
            res.status(201).send({ message: 'Poll created successfully', pollId });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Error creating poll:', error);
        res.status(500).send({ error: 'Failed to create poll.' });
    }
});

app.get('/api/polls', async (req, res) => {
    try {
        const pollsQuery = `
            SELECT 
                p.poll_id as id,
                p.user_id as "userId",
                p.question,
                p.description,
                p.allow_multiple_votes as "allowMultipleVotes",
                p.created_at,
                p.expires_at as "expiresAt",
                u.username,
                u.display_name as "displayName",
                u.profile_picture_url as "profilePictureUrl",
                COALESCE(
                    json_agg(
                        json_build_object(
                            'optionId', po.option_id,
                            'text', po.option_text,
                            'order', po.option_order,
                            'votes', COALESCE(vote_counts.vote_count, 0)
                        )
                        ORDER BY po.option_order
                    ) FILTER (WHERE po.option_id IS NOT NULL), 
                    '[]'::json
                ) as options,
                COALESCE(
                    (
                        SELECT json_agg(
                            jsonb_build_object(
                                'userId', pv2.user_id,
                                'optionId', pv2.option_id
                            )
                        )
                        FROM poll_votes pv2 
                        WHERE pv2.poll_id = p.poll_id
                    ),
                    '[]'::json
                ) as "userVotes"
            FROM polls p
            JOIN users u ON p.user_id = u.user_id
            LEFT JOIN poll_options po ON p.poll_id = po.poll_id
            LEFT JOIN (
                SELECT 
                    option_id,
                    COUNT(*) as vote_count
                FROM poll_votes
                GROUP BY option_id
            ) vote_counts ON po.option_id = vote_counts.option_id
            GROUP BY p.poll_id, p.user_id, p.question, p.description, p.allow_multiple_votes, p.created_at, p.expires_at, u.username, u.display_name, u.profile_picture_url
            ORDER BY p.created_at DESC
        `;
        
        const result = await client.query(pollsQuery);
        
        const polls = result.rows.map(row => ({
            ...row,
            createdAt: new Date(row.created_at).getTime(),
            expiresAt: row.expiresAt ? new Date(row.expiresAt).getTime() : null
        }));
        
        res.status(200).send(polls);
    } catch (error) {
        console.error('Error fetching polls:', error);
        res.status(500).send({ error: 'Failed to fetch polls.' });
    }
});

app.post('/api/polls/:pollId/vote', async (req, res) => {
    try {
        const { pollId } = req.params;
        const { userId, optionIds } = req.body;
        if (!userId || !optionIds || !Array.isArray(optionIds) || optionIds.length === 0) {
            return res.status(400).send({ error: 'userId and optionIds array are required.' });
        }
        
        const pollQuery = `SELECT allow_multiple_votes FROM polls WHERE poll_id = $1`;
        const pollResult = await client.query(pollQuery, [pollId]);
        if (pollResult.rows.length === 0) {
            return res.status(404).send({ error: 'Poll not found.' });
        }
        
        const allowMultipleVotes = pollResult.rows[0].allow_multiple_votes;
        
        if (!allowMultipleVotes && optionIds.length > 1) {
            return res.status(400).send({ error: 'This poll only allows one vote per user.' });
        }
        
        await client.query('BEGIN');
        
        try {
            const deleteVotesQuery = `DELETE FROM poll_votes WHERE poll_id = $1 AND user_id = $2`;
            await client.query(deleteVotesQuery, [pollId, userId]);
            
            const insertVoteQuery = `
                INSERT INTO poll_votes (poll_id, option_id, user_id) 
                VALUES ($1, $2, $3)
            `;
            for (const optionId of optionIds) {
                await client.query(insertVoteQuery, [pollId, optionId, userId]);
            }
            
            await client.query('COMMIT');
            res.status(200).send({ message: 'Vote recorded successfully.' });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Error voting on poll:', error);
        res.status(500).send({ error: 'Failed to vote on poll.' });
    }
});

app.delete('/api/polls/:pollId', async (req, res) => {
    try {
        const { pollId } = req.params;
        const { userId } = req.body;
        if (!userId) return res.status(400).send({ error: 'User ID is required.' });
        
        const checkPollQuery = `SELECT user_id FROM polls WHERE poll_id = $1`;
        const checkResult = await client.query(checkPollQuery, [pollId]);
        
        if (checkResult.rows.length === 0) {
            return res.status(404).send({ error: 'Poll not found.' });
        }
        
        if (checkResult.rows[0].user_id !== userId) {
            return res.status(403).send({ error: 'Forbidden' });
        }
        
        const deletePollQuery = `DELETE FROM polls WHERE poll_id = $1`;
        await client.query(deletePollQuery, [pollId]);
        
        res.status(200).send({ message: 'Poll deleted successfully.' });
    } catch (error) {
        console.error('Error deleting poll:', error);
        res.status(500).send({ error: 'Failed to delete poll.' });
    }
});

app.get('/api/feed', async (req, res) => {
    try {
        const { type = 'all' } = req.query;
        
        let feedItems = [];
        
        if (type === 'all' || type === 'posts') {
            const postsQuery = `
                SELECT 
                    'post' as type,
                    p.post_id as id,
                    p.user_id as "userId",
                    p.description,
                    p.created_at,
                    u.username,
                    u.display_name as "displayName",
                    u.profile_picture_url as "profilePictureUrl",
                    COALESCE(
                        json_agg(
                            DISTINCT pi.image_url
                        ) FILTER (WHERE pi.image_url IS NOT NULL), 
                        '[]'::json
                    ) as "imageUrls",
                    COALESCE(
                        json_agg(
                            DISTINCT jsonb_build_object(
                                'userId', l.user_id
                            )
                        ) FILTER (WHERE l.user_id IS NOT NULL), 
                        '[]'::json
                    ) as likes,
                    COALESCE(
                        json_agg(
                            DISTINCT jsonb_build_object(
                                'userId', c.user_id,
                                'text', c.comment_text,
                                'createdAt', EXTRACT(EPOCH FROM c.created_at) * 1000
                            )
                        ) FILTER (WHERE c.comment_text IS NOT NULL), 
                        '[]'::json
                    ) as comments
                FROM posts p
                JOIN users u ON p.user_id = u.user_id
                LEFT JOIN post_images pi ON p.post_id = pi.post_id
                LEFT JOIN likes l ON p.post_id = l.post_id
                LEFT JOIN comments c ON p.post_id = c.post_id
                GROUP BY p.post_id, p.user_id, p.description, p.created_at, u.username, u.display_name, u.profile_picture_url
            `;
            
            const postsResult = await client.query(postsQuery);
            const posts = postsResult.rows.map(row => ({
                ...row,
                createdAt: new Date(row.created_at).getTime()
            }));
            feedItems = feedItems.concat(posts);
        }
        
        if (type === 'all' || type === 'polls') {
            const pollsQuery = `
                SELECT 
                    'poll' as type,
                    p.poll_id as id,
                    p.user_id as "userId",
                    p.question,
                    p.description,
                    p.allow_multiple_votes as "allowMultipleVotes",
                    p.created_at,
                    p.expires_at as "expiresAt",
                    u.username,
                    u.display_name as "displayName",
                    u.profile_picture_url as "profilePictureUrl",
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'optionId', po.option_id,
                                'text', po.option_text,
                                'order', po.option_order,
                                'votes', COALESCE(vote_counts.vote_count, 0)
                            )
                            ORDER BY po.option_order
                        ) FILTER (WHERE po.option_id IS NOT NULL), 
                        '[]'::json
                    ) as options,
                    COALESCE(
                        (
                            SELECT json_agg(
                                jsonb_build_object(
                                    'userId', pv2.user_id,
                                    'optionId', pv2.option_id
                                )
                            )
                            FROM poll_votes pv2 
                            WHERE pv2.poll_id = p.poll_id
                        ),
                        '[]'::json
                    ) as "userVotes"
                FROM polls p
                JOIN users u ON p.user_id = u.user_id
                LEFT JOIN poll_options po ON p.poll_id = po.poll_id
                LEFT JOIN (
                    SELECT 
                        option_id,
                        COUNT(*) as vote_count
                    FROM poll_votes
                    GROUP BY option_id
                ) vote_counts ON po.option_id = vote_counts.option_id
                GROUP BY p.poll_id, p.user_id, p.question, p.description, p.allow_multiple_votes, p.created_at, p.expires_at, u.username, u.display_name, u.profile_picture_url
            `;
            
            const pollsResult = await client.query(pollsQuery);
            const polls = pollsResult.rows.map(row => ({
                ...row,
                createdAt: new Date(row.created_at).getTime(),
                expiresAt: row.expiresAt ? new Date(row.expiresAt).getTime() : null
            }));
            feedItems = feedItems.concat(polls);
        }
        
        feedItems.sort((a, b) => b.createdAt - a.createdAt);
        
        res.status(200).send(feedItems);
    } catch (error) {
        console.error('Error fetching feed:', error);
        res.status(500).send({ error: 'Failed to fetch feed.' });
    }
});

app.get('/api/users/:userId/chats', async (req, res) => {
    try {
        console.log(`✅ Found ${conversations.length} conversations for user ${userId}`);
        res.status(200).send(conversations);
    } catch (error) {
        console.error('❌ Error fetching chats:', error.message);
        console.error('📍 Stack trace:', error.stack);
        console.error('🔍 Query parameters:', { userId: req.query.userId });
        res.status(500).send({ 
            error: 'Failed to fetch chats.',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

app.get('/api/chats/:chatId/messages', async (req, res) => {
    try {
        res.status(200).send([]);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).send({ error: 'Failed to fetch messages.' });
    }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 EduLink Backend Server Started!`);
  console.log(`📍 Environment: ${isDevelopment ? 'Development' : isAzure ? 'Azure Cloud' : 'Production'}`);
  console.log(`🌐 Server running on:`);
  console.log(`   - Local: http://localhost:${PORT}`);
  console.log(`   - Network: http://10.12.151.180:${PORT}`);
  console.log(`💾 Database: PostgreSQL ${isDevelopment ? '(DigitalOcean)' : '(DigitalOcean Cloud)'}`);
  console.log(`☁️ Storage: ${sharedKeyCredential ? 'Azure Blob Storage' : 'Not configured (Dev mode)'}`);
  console.log(`🔐 Auth: Firebase Admin SDK`);
  console.log(`💬 Chat: Socket.IO Real-time`);
  console.log(`📞 Calls: WebRTC P2P`);
  console.log('✅ Ready to accept requests!');
});
