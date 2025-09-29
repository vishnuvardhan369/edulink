import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

// Singleton socket manager to prevent multiple connections
let globalSocket = null;
let connectionCount = 0;

const createSocket = () => {
    if (!globalSocket) {
        console.log('🔌 Creating new socket connection...');
        globalSocket = io('http://localhost:3000', {
            transports: ['websocket', 'polling'],
            autoConnect: true,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5,
            timeout: 20000,
            forceNew: false,
        });

        globalSocket.on('connect', () => {
            console.log('✅ Global socket connected:', globalSocket.id);
        });

        globalSocket.on('disconnect', (reason) => {
            console.log('❌ Global socket disconnected:', reason);
        });

        globalSocket.on('connect_error', (error) => {
            console.error('🚨 Global socket connection error:', error);
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