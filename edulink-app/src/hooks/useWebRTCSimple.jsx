import { useState, useEffect, useRef } from 'react';
import { useSocket } from './useSocket';
import { API_BASE_URL } from '../config/api';

export const useWebRTCSimple = (user, incomingCallProp = null) => {
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [currentCall, setCurrentCall] = useState(null); // { roomId, type, participants }
    const [incomingCall, setIncomingCall] = useState(incomingCallProp);
    const [isConnecting, setIsConnecting] = useState(false);
    const [configuration, setConfiguration] = useState(null);
    
    const { socket } = useSocket();
    const peerConnections = useRef({}); // Multiple peer connections for group calls
    const localStreamRef = useRef(null);
    const currentRoomRef = useRef(null);

    // Update incoming call when prop changes
    useEffect(() => {
        if (incomingCallProp) {
            console.log('📞 useWebRTCSimple received incoming call prop:', incomingCallProp);
            setIncomingCall(incomingCallProp);
        }
    }, [incomingCallProp]);

    // Fetch TURN credentials from backend on mount
    useEffect(() => {
        const fetchTurnCredentials = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/turn-credentials`);
                const config = await response.json();
                console.log('🔐 TURN credentials fetched from backend (Simple)');
                setConfiguration(config);
            } catch (error) {
                console.error('❌ Failed to fetch TURN credentials:', error);
                // Fallback to STUN-only configuration
                setConfiguration({
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ]
                });
            }
        };
        fetchTurnCredentials();
    }, []);

    // Start a call by joining a room based on conversation ID or direct roomId (for Meet calls)
    const startCall = async (conversationIdOrRoomId, type, targetUserId, isInitiator = true) => {
        if (!user || !socket) return;
        
        try {
            setIsConnecting(true);
            console.log('📞 startCall called with:', { conversationIdOrRoomId, type, targetUserId, isInitiator });
            
            // Check if this is already a room ID (starts with 'meet_' or 'call_')
            const roomId = conversationIdOrRoomId.startsWith('meet_') || conversationIdOrRoomId.startsWith('call_') 
                ? conversationIdOrRoomId 
                : `call_${conversationIdOrRoomId}`;
            
            console.log('📞 Using room ID:', roomId);
            
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
            } else if (type === 'audio') {
                // For audio-only calls, request ONLY audio (no video at all)
                console.log('🎤 Requesting audio-only stream (no video)');
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: false  // Don't request video at all
                });
                console.log('✅ Got audio stream with tracks:', {
                    audio: stream.getAudioTracks().length,
                    video: stream.getVideoTracks().length
                });
                stream.getAudioTracks().forEach(track => {
                    console.log('🎤 Audio track:', track.label, 'enabled:', track.enabled);
                });
            } else {
                // For video calls, request both audio and video
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: mediaConstraints.audio,
                    video: mediaConstraints.video
                });
            }
            
            console.log('✅ Got local stream');
            
            setLocalStream(stream);
            localStreamRef.current = stream;
            currentRoomRef.current = roomId;
            
            setCurrentCall({
                roomId,
                type,
                callType: type,  // ✅ Add callType for VideoCallWindow
                participants: [user.id, targetUserId],
                participantName: 'Connecting...',  // ✅ Add participantName for VideoCallWindow
                conversationId: conversationIdOrRoomId.startsWith('meet_') ? null : conversationIdOrRoomId,
                callId: null, // Will be set when backend sends it
                isInitiator
            });
            
            console.log('📡 Emitting webrtc:join-room:', { roomId, userId: user.id, callType: type });
            
            // Join the room - this will trigger peer connections
            socket.emit('webrtc:join-room', { roomId, userId: user.id, callType: type, callId: null });
            
            setIsConnecting(false);
            
        } catch (error) {
            console.error('❌ Error starting call:', error);
            setIsConnecting(false);
            alert('Could not access camera/microphone');
        }
    };

    // Answer an incoming call
    const answerCall = async () => {
        console.log('📞 answerCall() called');
        console.log('- incomingCall:', incomingCall);
        console.log('- user:', user);
        console.log('- socket:', socket);
        
        if (!incomingCall || !user || !socket) {
            console.error('❌ Cannot answer call - missing data:', { incomingCall, user, socket: !!socket });
            return;
        }
        
        try {
            setIsConnecting(true);
            console.log('🎥 Getting user media...');
            
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
            
            console.log('✅ Got user media stream');
            
            setLocalStream(stream);
            localStreamRef.current = stream;
            currentRoomRef.current = roomId;
            
            setCurrentCall({
                roomId,
                type,
                callType: type,  // Add for VideoCallWindow
                participants: incomingCall.participants,
                participantName: incomingCall.callerName || 'Unknown',  // Add caller name
                conversationId: incomingCall.conversationId,
                callId: incomingCall.callId
            });
            
            console.log('📡 Emitting webrtc:join-room:', { 
                roomId, 
                userId: user.id, 
                callType: type,
                callId: incomingCall.callId 
            });
            
            // Join the room with callId - this is CRITICAL for establishing connection
            socket.emit('webrtc:join-room', { 
                roomId, 
                userId: user.id, 
                callType: type,
                callId: incomingCall.callId 
            });
            
            setIncomingCall(null);
            setIsConnecting(false);
            console.log('✅ Call answered successfully - waiting for peer connection');
            
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
            callId: incomingCall.callId,
            targetUserId: incomingCall.callerId,
            conversationId: incomingCall.conversationId,
            roomId: incomingCall.roomId,
            userId: user.id
        });
        
        setIncomingCall(null);
    };

    // End the current call
    const endCall = (duration = 0) => {
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
        
        // Notify server with duration
        if (socket && currentRoomRef.current) {
            socket.emit('webrtc:leave-room', {
                roomId: currentRoomRef.current,
                userId: user.id,
                duration: duration
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
            console.log('👥 webrtc:user-connected:', data);
            const { userId: remoteUserId } = data;
            
            if (!localStreamRef.current) {
                console.warn('⚠️ No local stream yet, cannot create peer connection');
                return;
            }
            
            if (remoteUserId === user.id) {
                console.log('🔄 Ignoring self-connection');
                return;
            }
            
            // Check if peer connection already exists
            if (peerConnections.current[remoteUserId]) {
                console.log('⚠️ Peer connection already exists for user:', remoteUserId);
                return;
            }
            
            console.log('🔗 Creating peer connection for user:', remoteUserId);
            // Create peer connection for new user
            const peerConnection = new RTCPeerConnection(configuration);
            peerConnections.current[remoteUserId] = peerConnection;

            // Add local stream tracks
            localStreamRef.current.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStreamRef.current);
            });

            // Handle incoming tracks
            peerConnection.ontrack = (event) => {
                console.log('📺 Received remote track:', event.track.kind, 'enabled:', event.track.enabled);
                const [stream] = event.streams;
                console.log('🎵 Remote stream tracks:', {
                    audio: stream.getAudioTracks().length,
                    video: stream.getVideoTracks().length
                });
                setRemoteStream(stream);
            };

            // Handle ICE candidates
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log('🧊 Sending ICE candidate to:', remoteUserId);
                    socket.emit('webrtc:ice-candidate', {
                        candidate: event.candidate,
                        target: remoteUserId,
                        roomId: currentRoomRef.current
                    });
                }
            };

            // Create and send offer
            try {
                console.log('📤 Creating offer for:', remoteUserId);
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);
                
                console.log('📤 Sending offer to:', remoteUserId);
                socket.emit('webrtc:offer', {
                    offer,
                    target: remoteUserId,
                    roomId: currentRoomRef.current
                });
            } catch (error) {
                console.error('❌ Error creating offer:', error);
            }
        });

        // Received an offer
        socket.on('webrtc:offer', async (data) => {
            console.log('📥 Received offer from:', data.caller);
            const { offer, caller, roomId } = data;
            
            if (!localStreamRef.current) {
                console.warn('⚠️ No local stream, ignoring offer');
                return;
            }
            
            if (roomId !== currentRoomRef.current) {
                console.warn('⚠️ Offer for different room, ignoring');
                return;
            }
            
            // Check if peer connection already exists
            if (peerConnections.current[caller]) {
                console.log('⚠️ Peer connection already exists for caller:', caller);
                return;
            }
            
            console.log('🔗 Creating peer connection for caller:', caller);
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
                    // Only set remote description if we're in the correct state
                    if (peerConnection.signalingState === 'have-local-offer') {
                        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                        console.log('✅ Remote description (answer) set successfully');
                    } else {
                        console.warn('⚠️ Cannot set remote answer, wrong signaling state:', peerConnection.signalingState);
                    }
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
                    // Only add ICE candidate if remote description is set
                    if (peerConnection.remoteDescription) {
                        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                        console.log('✅ ICE candidate added successfully');
                    } else {
                        console.warn('⚠️ Cannot add ICE candidate: no remote description set yet');
                        // You could queue candidates here if needed
                    }
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

        // NOTE: webrtc:incoming-call is handled globally in App.jsx, not here
        // This hook only handles the WebRTC peer connections for active calls

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