import { useState, useEffect, useRef } from 'react';
import { useSocket } from './useSocket';

export const useWebRTCSimple = (user) => {
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [currentCall, setCurrentCall] = useState(null); // { roomId, type, participants }
    const [incomingCall, setIncomingCall] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);
    
    const { socket } = useSocket();
    const peerConnections = useRef({}); // Multiple peer connections for group calls
    const localStreamRef = useRef(null);
    const currentRoomRef = useRef(null);

    // WebRTC Configuration - Simple approach like working code
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            {
                urls: 'turn:relay1.expressturn.com:3480',
                username: 'e8c59f88c7ae9cb2b1e8a4e1',
                credential: 'KImxF2Hqnzp9oJE6'
            }
        ]
    };

    // Start a call by joining a room based on conversation ID
    const startCall = async (conversationId, type, targetUserId) => {
        if (!user || !socket) return;
        
        try {
            setIsConnecting(true);
            
            // Create room ID from conversation (consistent for both users)
            const roomId = `call_${conversationId}`;
            
            // Get media based on call type
            const mediaConstraints = {
                audio: true,
                video: type === 'video',
                screen: type === 'screen'
            };
            
            let stream;
            if (type === 'screen') {
                stream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: true
                });
            } else {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: mediaConstraints.audio,
                    video: mediaConstraints.video
                });
            }
            
            setLocalStream(stream);
            localStreamRef.current = stream;
            currentRoomRef.current = roomId;
            
            setCurrentCall({
                roomId,
                type,
                participants: [user.id, targetUserId],
                conversationId
            });
            
            // Join the room - this will trigger peer connections
            socket.emit('webrtc:join-room', { roomId, userId: user.id, callType: type });
            
            setIsConnecting(false);
            
        } catch (error) {
            console.error('Error starting call:', error);
            setIsConnecting(false);
            alert('Could not access camera/microphone');
        }
    };

    // Answer an incoming call
    const answerCall = async () => {
        if (!incomingCall || !user || !socket) return;
        
        try {
            setIsConnecting(true);
            
            const { roomId, type } = incomingCall;
            
            // Get media based on call type
            let stream;
            if (type === 'screen') {
                // For screen sharing, we still get camera/mic for the answerer
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: type === 'video'
                });
            } else {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: type === 'video'
                });
            }
            
            setLocalStream(stream);
            localStreamRef.current = stream;
            currentRoomRef.current = roomId;
            
            setCurrentCall({
                roomId,
                type,
                participants: incomingCall.participants,
                conversationId: incomingCall.conversationId
            });
            
            // Join the room
            socket.emit('webrtc:join-room', { roomId, userId: user.id, callType: type });
            
            setIncomingCall(null);
            setIsConnecting(false);
            
        } catch (error) {
            console.error('Error answering call:', error);
            setIsConnecting(false);
            alert('Could not access camera/microphone');
        }
    };

    // Decline an incoming call
    const declineCall = () => {
        if (!incomingCall || !socket) return;
        
        socket.emit('webrtc:call-decline', {
            roomId: incomingCall.roomId,
            userId: user.id
        });
        
        setIncomingCall(null);
    };

    // End the current call
    const endCall = () => {
        // Stop local stream
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            setLocalStream(null);
            localStreamRef.current = null;
        }
        
        // Close all peer connections
        Object.values(peerConnections.current).forEach(pc => {
            if (pc) pc.close();
        });
        peerConnections.current = {};
        
        // Notify server
        if (socket && currentRoomRef.current) {
            socket.emit('webrtc:leave-room', {
                roomId: currentRoomRef.current,
                userId: user.id
            });
        }
        
        // Reset state
        setRemoteStream(null);
        setCurrentCall(null);
        setIncomingCall(null);
        setIsConnecting(false);
        currentRoomRef.current = null;
    };

    // Socket event handlers - Based on working code
    useEffect(() => {
        if (!socket) return;

        // Someone joined our room
        socket.on('webrtc:user-connected', async (data) => {
            const { userId: remoteUserId } = data;
            
            if (!localStreamRef.current || remoteUserId === user.id) return;
            
            // Create peer connection for new user
            const peerConnection = new RTCPeerConnection(configuration);
            peerConnections.current[remoteUserId] = peerConnection;

            // Add local stream tracks
            localStreamRef.current.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStreamRef.current);
            });

            // Handle incoming tracks
            peerConnection.ontrack = (event) => {
                const [stream] = event.streams;
                setRemoteStream(stream);
            };

            // Handle ICE candidates
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit('webrtc:ice-candidate', {
                        candidate: event.candidate,
                        target: remoteUserId,
                        roomId: currentRoomRef.current
                    });
                }
            };

            // Create and send offer
            try {
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);
                
                socket.emit('webrtc:offer', {
                    offer,
                    target: remoteUserId,
                    roomId: currentRoomRef.current
                });
            } catch (error) {
                console.error('Error creating offer:', error);
            }
        });

        // Received an offer
        socket.on('webrtc:offer', async (data) => {
            const { offer, caller, roomId } = data;
            
            if (!localStreamRef.current || roomId !== currentRoomRef.current) return;
            
            // Create peer connection for caller
            const peerConnection = new RTCPeerConnection(configuration);
            peerConnections.current[caller] = peerConnection;

            // Add local stream tracks
            localStreamRef.current.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStreamRef.current);
            });

            // Handle incoming tracks
            peerConnection.ontrack = (event) => {
                const [stream] = event.streams;
                setRemoteStream(stream);
            };

            // Handle ICE candidates
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit('webrtc:ice-candidate', {
                        candidate: event.candidate,
                        target: caller,
                        roomId: currentRoomRef.current
                    });
                }
            };

            try {
                // Set remote description and create answer
                await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                
                socket.emit('webrtc:answer', {
                    answer,
                    target: caller,
                    roomId: currentRoomRef.current
                });
            } catch (error) {
                console.error('Error handling offer:', error);
            }
        });

        // Received an answer
        socket.on('webrtc:answer', async (data) => {
            const { answer, answerer, roomId } = data;
            
            if (roomId !== currentRoomRef.current) return;
            
            const peerConnection = peerConnections.current[answerer];
            if (peerConnection) {
                try {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                } catch (error) {
                    console.error('Error setting remote description:', error);
                }
            }
        });

        // Received ICE candidate
        socket.on('webrtc:ice-candidate', async (data) => {
            const { candidate, from, roomId } = data;
            
            if (roomId !== currentRoomRef.current) return;
            
            const peerConnection = peerConnections.current[from];
            if (peerConnection) {
                try {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (error) {
                    console.error('Error adding ICE candidate:', error);
                }
            }
        });

        // User disconnected from room
        socket.on('webrtc:user-disconnected', (data) => {
            const { userId } = data;
            
            if (peerConnections.current[userId]) {
                peerConnections.current[userId].close();
                delete peerConnections.current[userId];
            }
            
            // If this was the only remote user, clear remote stream
            if (Object.keys(peerConnections.current).length === 0) {
                setRemoteStream(null);
            }
        });

        // Incoming call notification (from outside the room)
        socket.on('webrtc:incoming-call', (data) => {
            setIncomingCall({
                roomId: data.roomId,
                type: data.callType,
                callerId: data.callerId,
                callerName: data.callerName,
                participants: data.participants,
                conversationId: data.conversationId
            });
        });

        // Call was declined or ended
        socket.on('webrtc:call-ended', () => {
            endCall();
        });

        return () => {
            socket.off('webrtc:user-connected');
            socket.off('webrtc:offer');
            socket.off('webrtc:answer');
            socket.off('webrtc:ice-candidate');
            socket.off('webrtc:user-disconnected');
            socket.off('webrtc:incoming-call');
            socket.off('webrtc:call-ended');
        };
    }, [socket, user]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            endCall();
        };
    }, []);

    return {
        localStream,
        remoteStream,
        currentCall,
        incomingCall,
        isConnecting,
        isScreenSharing: currentCall?.type === 'screen',
        startCall,
        answerCall,
        declineCall,
        endCall
    };
};