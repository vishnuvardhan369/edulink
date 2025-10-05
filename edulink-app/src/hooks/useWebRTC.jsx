import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from './useSocket';
import { API_BASE_URL } from '../config/api';

export const useWebRTC = (user) => {
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [inCall, setInCall] = useState(false);
    const [callType, setCallType] = useState(null);
    const [incomingCall, setIncomingCall] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [rtcConfig, setRtcConfig] = useState(null);
    
    const { socket } = useSocket();
    const peerConnection = useRef(null);
    const localStreamRef = useRef(null);
    const pendingCandidates = useRef([]);
    const callId = useRef(null);
    const targetUser = useRef(null);

    // Fetch TURN credentials from backend on mount
    useEffect(() => {
        const fetchTurnCredentials = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/turn-credentials`);
                const config = await response.json();
                console.log('🔐 TURN credentials fetched from backend');
                setRtcConfig(config);
            } catch (error) {
                console.error('❌ Failed to fetch TURN credentials:', error);
                // Fallback to STUN-only configuration
                setRtcConfig({
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' }
                    ],
                    iceCandidatePoolSize: 10
                });
            }
        };
        fetchTurnCredentials();
    }, []);

    // Create peer connection
    const createPeerConnection = useCallback(() => {
        if (!rtcConfig) {
            console.warn('⚠️ RTC config not yet loaded');
            return null;
        }
        console.log('🔗 Creating peer connection with TURN server');
        const pc = new RTCPeerConnection(rtcConfig);
        
        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate && socket && callId.current) {
                console.log('📡 Sending ICE candidate:', event.candidate.candidate.substring(0, 50));
                socket.emit('webrtc:ice-candidate', {
                    callId: callId.current,
                    candidate: event.candidate,
                    targetUserId: targetUser.current
                });
            }
        };
        
        // Handle remote stream
        pc.ontrack = (event) => {
            console.log('🎵 Received remote stream with tracks:', event.streams[0].getTracks().length);
            setRemoteStream(event.streams[0]);
        };
        
        // Handle connection state changes
        pc.onconnectionstatechange = () => {
            console.log('🔄 Connection state:', pc.connectionState);
            if (pc.connectionState === 'connected') {
                console.log('✅ WebRTC connection established!');
                setIsConnecting(false);
            } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                console.log('❌ Connection failed/disconnected');
                endCall();
            }
        };
        
        // Handle ICE connection state
        pc.oniceconnectionstatechange = () => {
            console.log('🧊 ICE connection state:', pc.iceConnectionState);
        };
        
        return pc;
    }, [socket, rtcConfig]);

    // Get user media
    const getUserMedia = async (constraints) => {
        try {
            console.log('🎥 Getting user media:', constraints);
            let stream;
            
            if (constraints.screen) {
                // Screen sharing
                stream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        cursor: 'always',
                        width: { ideal: 1920, max: 1920 },
                        height: { ideal: 1080, max: 1080 },
                        frameRate: { ideal: 30, max: 60 }
                    },
                    audio: true
                });
            } else {
                // Camera/microphone
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    },
                    video: constraints.video ? {
                        width: { ideal: 1280, max: 1920 },
                        height: { ideal: 720, max: 1080 },
                        frameRate: { ideal: 30, max: 60 }
                    } : false
                });
            }
            
            console.log('✅ Media obtained:', {
                id: stream.id,
                audio: stream.getAudioTracks().length,
                video: stream.getVideoTracks().length
            });
            
            setLocalStream(stream);
            localStreamRef.current = stream;
            return stream;
        } catch (error) {
            console.error('❌ Error getting media:', error);
            throw error;
        }
    };

    // Start a call
    const startCall = async (conversationId, type, targetUserId) => {
        try {
            console.log('🚀 Starting call:', { type, targetUserId });
            setIsConnecting(true);
            setCallType(type);
            setInCall(true);
            
            callId.current = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            targetUser.current = targetUserId;
            
            // Get media constraints
            const constraints = {
                audio: true,
                video: type === 'video',
                screen: type === 'screen'
            };
            
            // Get user media
            const stream = await getUserMedia(constraints);
            
            // Create peer connection
            const pc = createPeerConnection();
            peerConnection.current = pc;
            
            // Add tracks to peer connection
            stream.getTracks().forEach(track => {
                console.log('➕ Adding track:', track.kind, track.label);
                pc.addTrack(track, stream);
            });
            
            // Create offer
            console.log('📝 Creating offer...');
            const offer = await pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: type === 'video' || type === 'screen'
            });
            
            await pc.setLocalDescription(offer);
            console.log('✅ Local description set (offer)');
            
            // Send call initiation
            socket.emit('webrtc:call-start', {
                callId: callId.current,
                callerId: user.uid,
                targetUserId,
                conversationId,
                type,
                offer
            });
            
            console.log('📞 Call started, waiting for answer...');
            
        } catch (error) {
            console.error('❌ Error starting call:', error);
            endCall();
            throw error;
        }
    };

    // Answer incoming call
    const answerCall = async () => {
        if (!incomingCall) {
            console.error('❌ No incoming call to answer');
            return;
        }
        
        try {
            console.log('📞 Answering call:', incomingCall);
            setIsConnecting(true);
            setCallType(incomingCall.type);
            setInCall(true);
            
            callId.current = incomingCall.callId;
            targetUser.current = incomingCall.callerId;
            
            // Get media
            const constraints = {
                audio: true,
                video: incomingCall.type === 'video',
                screen: false // Cannot answer with screen share
            };
            
            const stream = await getUserMedia(constraints);
            
            // Create peer connection
            const pc = createPeerConnection();
            peerConnection.current = pc;
            
            // Add tracks
            stream.getTracks().forEach(track => {
                console.log('➕ Adding track for answer:', track.kind);
                pc.addTrack(track, stream);
            });
            
            // Set remote description (offer)
            console.log('📥 Setting remote description (offer)');
            await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
            
            // Add any pending ICE candidates
            for (const candidate of pendingCandidates.current) {
                console.log('🧊 Adding pending candidate');
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
            pendingCandidates.current = [];
            
            // Create answer
            console.log('📝 Creating answer...');
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            console.log('✅ Local description set (answer)');
            
            // Send answer
            socket.emit('webrtc:call-answer', {
                callId: callId.current,
                answer,
                targetUserId: incomingCall.callerId
            });
            
            setIncomingCall(null);
            console.log('✅ Call answered successfully');
            
        } catch (error) {
            console.error('❌ Error answering call:', error);
            endCall();
            throw error;
        }
    };

    // Decline incoming call
    const declineCall = () => {
        if (incomingCall) {
            console.log('❌ Declining call');
            socket.emit('webrtc:call-decline', {
                callId: incomingCall.callId,
                targetUserId: incomingCall.callerId
            });
            setIncomingCall(null);
        }
    };

    // End call
    const endCall = useCallback(() => {
        console.log('📞 Ending call');
        
        // Stop local stream
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                track.stop();
                console.log('🛑 Stopped track:', track.kind);
            });
            localStreamRef.current = null;
        }
        
        // Close peer connection
        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }
        
        // Notify remote user
        if (socket && callId.current && targetUser.current) {
            socket.emit('webrtc:call-end', {
                callId: callId.current,
                targetUserId: targetUser.current
            });
        }
        
        // Reset state
        setLocalStream(null);
        setRemoteStream(null);
        setInCall(false);
        setCallType(null);
        setIncomingCall(null);
        setIsConnecting(false);
        callId.current = null;
        targetUser.current = null;
        pendingCandidates.current = [];
        
    }, [socket]);

    // Socket event handlers
    useEffect(() => {
        if (!socket) return;
        
        const handleIncomingCall = (data) => {
            console.log('📞 Incoming call:', data);
            setIncomingCall(data);
        };
        
        const handleCallAnswer = async (data) => {
            console.log('✅ Call answered:', data);
            if (peerConnection.current && data.answer) {
                try {
                    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer));
                    console.log('✅ Remote description set (answer)');
                    
                    // Add any pending candidates
                    for (const candidate of pendingCandidates.current) {
                        console.log('🧊 Adding pending candidate after answer');
                        await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
                    }
                    pendingCandidates.current = [];
                } catch (error) {
                    console.error('❌ Error setting remote description:', error);
                }
            }
        };
        
        const handleIceCandidate = async (data) => {
            console.log('🧊 Received ICE candidate');
            if (peerConnection.current && peerConnection.current.remoteDescription) {
                try {
                    await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate));
                    console.log('✅ ICE candidate added');
                } catch (error) {
                    console.error('❌ Error adding ICE candidate:', error);
                }
            } else {
                console.log('⏳ Queuing ICE candidate (no remote description yet)');
                pendingCandidates.current.push(data.candidate);
            }
        };
        
        const handleCallDecline = () => {
            console.log('❌ Call declined');
            endCall();
        };
        
        const handleCallEnd = () => {
            console.log('📞 Call ended by remote user');
            endCall();
        };
        
        // Register event listeners
        socket.on('webrtc:incoming-call', handleIncomingCall);
        socket.on('webrtc:call-answer', handleCallAnswer);
        socket.on('webrtc:ice-candidate', handleIceCandidate);
        socket.on('webrtc:call-decline', handleCallDecline);
        socket.on('webrtc:call-end', handleCallEnd);
        
        return () => {
            socket.off('webrtc:incoming-call', handleIncomingCall);
            socket.off('webrtc:call-answer', handleCallAnswer);
            socket.off('webrtc:ice-candidate', handleIceCandidate);
            socket.off('webrtc:call-decline', handleCallDecline);
            socket.off('webrtc:call-end', handleCallEnd);
        };
    }, [socket, endCall]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            endCall();
        };
    }, [endCall]);

    return {
        localStream,
        remoteStream,
        inCall,
        callType,
        incomingCall,
        isConnecting,
        startCall,
        answerCall,
        declineCall,
        endCall
    };
};