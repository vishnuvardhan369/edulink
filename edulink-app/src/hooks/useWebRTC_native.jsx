import { useState, useEffect, useRef } from 'react';

export const useWebRTC = (socket) => {
    const [incomingCall, setIncomingCall] = useState(null);
    const [currentCall, setCurrentCall] = useState(null);
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [callAccepted, setCallAccepted] = useState(false);
    const [callEnded, setCallEnded] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    const peerConnectionRef = useRef(null);
    const localStreamRef = useRef(null);

    // ICE servers for STUN/TURN
    const servers = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    };

    useEffect(() => {
        if (!socket) return;

        // Listen for incoming calls
        socket.on('call:incoming', handleIncomingCall);
        socket.on('call:signal', handleCallSignal);
        socket.on('call:accepted', handleCallAccepted);
        socket.on('call:declined', handleCallDeclined);
        socket.on('call:ended', handleCallEnded);
        socket.on('call:user_offline', handleUserOffline);

        return () => {
            socket.off('call:incoming');
            socket.off('call:signal');
            socket.off('call:accepted');
            socket.off('call:declined');
            socket.off('call:ended');
            socket.off('call:user_offline');
        };
    }, [socket]);

    const handleIncomingCall = (callData) => {
        console.log('📞 Incoming call received:', callData);
        setIncomingCall(callData);
    };

    const handleCallSignal = async (data) => {
        console.log('📡 Received call signal:', data);
        
        if (!peerConnectionRef.current) return;

        try {
            if (data.signal.type === 'answer') {
                await peerConnectionRef.current.setRemoteDescription(data.signal);
                console.log('✅ Answer signal processed');
            } else if (data.signal.type === 'ice-candidate') {
                await peerConnectionRef.current.addIceCandidate(data.signal.candidate);
                console.log('✅ ICE candidate added');
            }
        } catch (error) {
            console.error('❌ Error handling call signal:', error);
        }
    };

    const handleCallAccepted = () => {
        console.log('✅ Call accepted');
        setCallAccepted(true);
        setIncomingCall(null);
    };

    const handleCallDeclined = () => {
        console.log('❌ Call declined');
        setIncomingCall(null);
        cleanupCall();
    };

    const handleCallEnded = () => {
        console.log('📞 Call ended');
        setCallEnded(true);
        cleanupCall();
    };

    const handleUserOffline = (data) => {
        console.log('📴 User offline:', data);
        alert('The user you are trying to call is currently offline.');
        cleanupCall();
    };

    const getUserMedia = async (constraints) => {
        try {
            console.log('🎥 Getting user media:', constraints);
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            setLocalStream(stream);
            localStreamRef.current = stream;
            return stream;
        } catch (error) {
            console.error('❌ Error accessing media devices:', error);
            
            // Provide more specific error messages
            if (error.name === 'NotAllowedError') {
                throw new Error('Camera/microphone access denied. Please allow access and refresh the page.');
            } else if (error.name === 'NotFoundError') {
                throw new Error('Camera/microphone not found. Please check your devices.');
            } else if (error.name === 'NotReadableError') {
                throw new Error('Camera/microphone is already in use by another application.');
            }
            throw error;
        }
    };

    const createPeerConnection = () => {
        const pc = new RTCPeerConnection(servers);
        
        // Handle remote stream
        pc.ontrack = (event) => {
            console.log('🎥 Received remote stream');
            setRemoteStream(event.streams[0]);
            setCallAccepted(true);
        };

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate && currentCall) {
                console.log('📡 Sending ICE candidate');
                socket.emit('call:signal', {
                    conversationId: currentCall.conversationId,
                    targetUserId: currentCall.targetUserId,
                    signal: {
                        type: 'ice-candidate',
                        candidate: event.candidate
                    }
                });
            }
        };

        // Handle connection state changes
        pc.onconnectionstatechange = () => {
            console.log('🔄 Connection state:', pc.connectionState);
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                endCall();
            }
        };

        return pc;
    };

    const startCall = async (conversationId, callType, targetUserId) => {
        try {
            console.log('🎵 Starting call:', { conversationId, callType, targetUserId });
            
            // Clean up any existing call
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
                peerConnectionRef.current = null;
            }

            let constraints = {
                video: callType === 'video',
                audio: true
            };

            // For screen sharing, get screen stream instead of camera
            if (callType === 'screen') {
                try {
                    const screenStream = await navigator.mediaDevices.getDisplayMedia({
                        video: true,
                        audio: true
                    });
                    setLocalStream(screenStream);
                    localStreamRef.current = screenStream;
                    setIsScreenSharing(true);
                } catch (screenError) {
                    console.error('❌ Screen sharing denied:', screenError);
                    alert('Screen sharing was denied. Please allow screen sharing and try again.');
                    return;
                }
            } else {
                try {
                    await getUserMedia(constraints);
                } catch (mediaError) {
                    alert(mediaError.message);
                    return;
                }
            }

            // Create peer connection
            const pc = createPeerConnection();
            peerConnectionRef.current = pc;

            // Set current call before creating offer
            setCurrentCall({
                conversationId,
                callType,
                targetUserId,
                isInitiator: true
            });

            // Add local stream to peer connection
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => {
                    pc.addTrack(track, localStreamRef.current);
                });
            }

            // Create and send offer
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            console.log('📡 Sending call start signal');
            socket.emit('call:start', {
                conversationId,
                callType,
                targetUserId,
                signal: offer
            });

            setCallEnded(false);

        } catch (error) {
            console.error('❌ Error starting call:', error);
            alert(`Failed to start call: ${error.message}`);
        }
    };

    const answerCall = async (accept) => {
        if (!accept || !incomingCall) {
            console.log('📞 Declining call');
            socket.emit('call:decline', {
                conversationId: incomingCall?.conversationId,
                callerId: incomingCall?.callerId
            });
            setIncomingCall(null);
            return;
        }

        try {
            console.log('📞 Answering call:', incomingCall);
            
            // Clean up any existing call
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
                peerConnectionRef.current = null;
            }

            let constraints = {
                video: incomingCall.callType === 'video',
                audio: true
            };

            try {
                await getUserMedia(constraints);
            } catch (mediaError) {
                alert(mediaError.message);
                setIncomingCall(null);
                return;
            }

            // Create peer connection
            const pc = createPeerConnection();
            peerConnectionRef.current = pc;

            // Set current call before handling signals
            setCurrentCall({
                conversationId: incomingCall.conversationId,
                callType: incomingCall.callType,
                targetUserId: incomingCall.callerId,
                isInitiator: false
            });

            // Add local stream to peer connection
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => {
                    pc.addTrack(track, localStreamRef.current);
                });
            }

            // Set remote description from incoming call
            await pc.setRemoteDescription(incomingCall.signal);

            // Create and send answer
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            console.log('📡 Sending answer signal');
            socket.emit('call:answer', {
                conversationId: incomingCall.conversationId,
                callerId: incomingCall.callerId,
                signal: answer
            });

            setIncomingCall(null);
            setCallEnded(false);

        } catch (error) {
            console.error('❌ Error answering call:', error);
            alert(`Failed to answer call: ${error.message}`);
            setIncomingCall(null);
        }
    };

    const declineCall = () => {
        if (incomingCall) {
            console.log('❌ Declining call');
            socket.emit('call:decline', {
                conversationId: incomingCall.conversationId,
                callerId: incomingCall.callerId
            });
            setIncomingCall(null);
        }
    };

    const endCall = () => {
        console.log('📞 Ending call');
        
        if (currentCall) {
            socket.emit('call:end', {
                conversationId: currentCall.conversationId,
                targetUserId: currentCall.targetUserId
            });
        }

        cleanupCall();
    };

    const cleanupCall = () => {
        console.log('🧹 Cleaning up call');
        
        // Close peer connection
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }

        // Stop local stream
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }

        // Reset states
        setLocalStream(null);
        setRemoteStream(null);
        setCurrentCall(null);
        setCallAccepted(false);
        setCallEnded(true);
        setIsScreenSharing(false);
    };

    return {
        incomingCall,
        currentCall,
        localStream,
        remoteStream,
        callAccepted,
        callEnded,
        isScreenSharing,
        startCall,
        answerCall,
        declineCall,
        endCall
    };
};