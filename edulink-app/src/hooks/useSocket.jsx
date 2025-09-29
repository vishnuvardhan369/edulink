import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { SOCKET_URL } from '../config/api.js';

// Singleton socket manager to prevent multiple connections
let globalSocket = null;
let connectionCount = 0;

const createSocket = () => {
    if (!globalSocket) {
        console.log('🔌 Creating new socket connection...');
        console.log('🌐 Connecting to:', SOCKET_URL);
        
        // Enhanced Socket.IO configuration for production
        globalSocket = io(SOCKET_URL, {
            transports: ['polling', 'websocket'], // Start with polling for better Azure compatibility
            autoConnect: true,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 10,
            timeout: 30000,
            forceNew: false,
            upgrade: true,
            rememberUpgrade: false, // Don't remember upgrades for Azure
            // Additional options for production stability
            pingTimeout: 60000,
            pingInterval: 25000,
            // Force specific transport order for Azure
            ...(SOCKET_URL.includes('azurewebsites.net') && {
                transports: ['polling'], // Force polling only for Azure initially
                upgrade: false // Disable WebSocket upgrade for initial connection
            })
        });

        globalSocket.on('connect', () => {
            console.log('✅ Global socket connected:', globalSocket.id);
            console.log('🚀 Transport:', globalSocket.io.engine.transport.name);
        });

        globalSocket.on('disconnect', (reason) => {
            console.log('❌ Global socket disconnected:', reason);
        });

        globalSocket.on('connect_error', (error) => {
            console.error('🚨 Global socket connection error:', error);
            console.error('🔍 Error details:', {
                message: error.message,
                description: error.description,
                context: error.context,
                stack: error.stack
            });
        });

        globalSocket.on('reconnect', (attemptNumber) => {
            console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
        });

        globalSocket.on('reconnect_error', (error) => {
            console.error('💥 Reconnection failed:', error);
        });

        globalSocket.on('reconnect_failed', () => {
            console.error('💀 Reconnection failed permanently');
        });

        // Listen for transport changes
        globalSocket.io.on('upgrade', (transport) => {
            console.log('⬆️ Upgraded to transport:', transport.name);
        });
    }
    return globalSocket;
};

export const useSocket = () => {
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const connectionIdRef = useRef(null);

    useEffect(() => {
        // Increment connection count
        connectionCount++;
        connectionIdRef.current = connectionCount;
        
        console.log(`🔗 useSocket hook mounted (connection #${connectionCount})`);

        // Get or create the singleton socket
        const currentSocket = createSocket();
        setSocket(currentSocket);
        
        // Set up local state listeners
        const handleConnect = () => {
            console.log(`✅ Socket connected for hook #${connectionIdRef.current}:`, currentSocket.id);
            setIsConnected(true);
        };

        const handleDisconnect = (reason) => {
            console.log(`❌ Socket disconnected for hook #${connectionIdRef.current}:`, reason);
            setIsConnected(false);
        };

        const handleConnectError = (error) => {
            console.error(`🚨 Socket connection error for hook #${connectionIdRef.current}:`, error);
            setIsConnected(false);
        };

        // Add listeners
        currentSocket.on('connect', handleConnect);
        currentSocket.on('disconnect', handleDisconnect);
        currentSocket.on('connect_error', handleConnectError);
        
        // Set initial state
        setIsConnected(currentSocket.connected);

        return () => {
            console.log(`🧹 Cleaning up useSocket hook #${connectionIdRef.current}...`);
            
            // Remove only this hook's listeners
            currentSocket.off('connect', handleConnect);
            currentSocket.off('disconnect', handleDisconnect);
            currentSocket.off('connect_error', handleConnectError);
            
            // Decrement connection count
            connectionCount--;
            
            // Only disconnect if this is the last hook using the socket
            if (connectionCount <= 0) {
                console.log('🛑 Last connection, disconnecting global socket...');
                if (globalSocket) {
                    globalSocket.disconnect();
                    globalSocket = null;
                }
                connectionCount = 0;
            }
        };
    }, []);

    return {
        socket,
        isConnected
    };
};