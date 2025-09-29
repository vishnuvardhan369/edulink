import { useState, useEffect, useRef } from 'react';

export const useWebRTC = (socket, user) => {
    const [incomingCall, setIncomingCall] = useState(null);
    const [currentCall, setCurrentCall] = useState(null);
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [callAccepted, setCallAccepted] = useState(false);
    const [callEnded, setCallEnded] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    const peerConnectionRef = useRef(null);
    const localStreamRef = useRef(null);

    // WebRTC Configuration function with ExpressTurn support
    const getWebRTCConfig = (connectionType = 'direct') => {
        const baseConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        // Add TURN server for private/relay connections
        if (connectionType === 'relay' || connectionType === 'private') {
            baseConfig.iceServers.push({
                urls: 'turn:relay1.expressturn.com:3480',
                username: '000000002074484908',
                credential: 'iaB6fUMYHcn1weCZ6t7s8e8h5gY='
            });
            console.log('🔒 Using ExpressTurn relay server for IP privacy');
        } else {
            console.log('🔓 Using direct WebRTC connection');
        }

        return baseConfig;
    };

    // Default to direct connection (can be changed per call)
    const [connectionType, setConnectionType] = useState('direct');

    useEffect(() => {
        if (!socket) return;

        // Listen for incoming calls
        socket.on('call:incoming', handleIncomingCall);
        socket.on('call:signal', handleCallSignal);
        socket.on('call:answered', handleCallAnswered);
        socket.on('call:declined', handleCallDeclined);
        socket.on('call:ended', handleCallEnded);
        socket.on('call:user_offline', handleUserOffline);

        return () => {
            socket.off('call:incoming');
            socket.off('call:signal');
            socket.off('call:answered');
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
        
        if (!peerConnectionRef.current) {
            console.log('❌ No peer connection available for signal');
            return;
        }

        try {
            const { signal } = data;
            
            if (signal.type === 'offer') {
                console.log('📥 Processing offer signal');
                await peerConnectionRef.current.setRemoteDescription(signal);
            } else if (signal.type === 'answer') {
                console.log('📥 Processing answer signal');
                await peerConnectionRef.current.setRemoteDescription(signal);
            } else if (signal.type === 'ice-candidate' && signal.candidate) {
                console.log('📥 Adding ICE candidate');
                await peerConnectionRef.current.addIceCandidate(signal.candidate);
            }
        } catch (error) {
            console.error('❌ Error handling call signal:', error);
        }
    };

    const handleCallAnswered = (data) => {
        console.log('✅ Call answered:', data);
        setCallAccepted(true);
        setIncomingCall(null);
        
        // If there's a WebRTC signal in the response, handle it
        if (data.signal && peerConnectionRef.current) {
            handleCallSignal({ signal: data.signal });
        }
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
            
            // For testing on same device, try to get different audio/video sources
            if (constraints.video) {
                // Try to use different camera sources for testing
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = devices.filter(device => device.kind === 'videoinput');
                const audioDevices = devices.filter(device => device.kind === 'audioinput');
                
                if (videoDevices.length > 0) {
                    constraints.video = {
                        deviceId: videoDevices[0].deviceId,
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    };
                }
                
                if (audioDevices.length > 0) {
                    constraints.audio = {
                        deviceId: audioDevices[0].deviceId,
                        echoCancellation: true,
                        noiseSuppression: true
                    };
                }
            }
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            setLocalStream(stream);
            localStreamRef.current = stream;
            return stream;
        } catch (error) {
            console.error('❌ Error accessing media devices:', error);
            
            // Enhanced error handling for testing scenarios
            if (error.name === 'NotAllowedError') {
                throw new Error('Camera/microphone access denied. Please allow access and refresh the page.');
            } else if (error.name === 'NotFoundError') {
                throw new Error('Camera/microphone not found. Please check your devices.');
            } else if (error.name === 'NotReadableError') {
                // For testing on same device - provide audio-only fallback
                if (constraints.video) {
                    console.log('🔄 Video device in use, trying audio-only...');
                    try {
                        const audioOnlyConstraints = { 
                            audio: true, 
                            video: false 
                        };
                        const audioStream = await navigator.mediaDevices.getUserMedia(audioOnlyConstraints);
                        setLocalStream(audioStream);
                        localStreamRef.current = audioStream;
                        alert('Video device is in use by another browser. Switching to audio-only call.');
                        return audioStream;
                    } catch (audioError) {
                        throw new Error('Camera/microphone is already in use by another application. Please close other browser tabs or applications using these devices.');
                    }
                } else {
                    throw new Error('Microphone is already in use by another application. Please close other browser tabs or applications using the microphone.');
                }
            }
            throw error;
        }
    };

    const createPeerConnection = () => {
        const config = getWebRTCConfig(connectionType);
        const pc = new RTCPeerConnection(config);
        console.log(`🔧 Created peer connection with ${connectionType} config:`, config);
        
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
                    console.log('🖥️ Starting screen share...');
                    const screenStream = await navigator.mediaDevices.getDisplayMedia({
                        video: { 
                            mediaSource: 'screen',
                            width: { ideal: 1920 },
                            height: { ideal: 1080 }
                        },
                        audio: true
                    });
                    setLocalStream(screenStream);
                    localStreamRef.current = screenStream;
                    setIsScreenSharing(true);
                    
                    // Handle screen share end
                    screenStream.getVideoTracks()[0].onended = () => {
                        console.log('🖥️ Screen sharing stopped');
                        setIsScreenSharing(false);
                        endCall();
                    };
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
            console.log('🔄 Creating WebRTC offer...');
            const offer = await pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: callType === 'video' || callType === 'screen'
            });
            await pc.setLocalDescription(offer);

            console.log('📡 Sending call start signal');
            socket.emit('call:start', {
                conversationId,
                callType,
                targetUserId,
                signal: offer,
                hasSignal: true
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
            console.log('🔄 Creating WebRTC answer...');
            const answer = await pc.createAnswer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: incomingCall.callType === 'video' || incomingCall.callType === 'screen'
            });
            await pc.setLocalDescription(answer);

            console.log('📡 Sending answer signal');
            socket.emit('call:answer', {
                conversationId: incomingCall.conversationId,
                callerId: incomingCall.callerId,
                answererId: user?.uid || 'anonymous', // Fallback for user ID
                signal: answer,
                callId: incomingCall.callId
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

    // Function to change connection type
    const setCallConnectionType = (type) => {
        console.log(`🔄 Switching connection type to: ${type}`);
        setConnectionType(type);
    };

    return {
        incomingCall,
        currentCall,
        localStream,
        remoteStream,
        callAccepted,
        callEnded,
        isScreenSharing,
        connectionType,
        setCallConnectionType,
        startCall,
        answerCall,
        declineCall,
        endCall
    };
};