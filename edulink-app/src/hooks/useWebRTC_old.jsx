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
    const getWebRTCConfig = (connectionType = 'relay') => {
        const baseConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ],
            // Force proper ICE candidate collection
            iceCandidatePoolSize: 10,
            // Bundle policy for better compatibility
            bundlePolicy: 'max-bundle',
            // RTC configuration for better connection reliability
            rtcpMuxPolicy: 'require'
        };

        // Add TURN server for private/relay connections
        if (connectionType === 'relay' || connectionType === 'private') {
            baseConfig.iceServers.push({
                urls: 'turn:relay1.expressturn.com:3480',
                username: '000000002074484908',
                credential: 'iaB6fUMYHcn1weCZ6t7s8e8h5gY='
            });
            console.log('🔒 Using ExpressTurn relay server for maximum compatibility');
        } else {
            console.log('🔓 Using direct WebRTC connection');
        }

        console.log('⚙️ WebRTC config:', baseConfig);
        return baseConfig;
    };

    // Default to relay connection for better testing compatibility
    const [connectionType, setConnectionType] = useState('relay');

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
        console.log('📡 Received call signal:', {
            signalType: data.signal?.type,
            senderId: data.senderId,
            hasCandidate: !!data.signal?.candidate
        });
        
        if (!peerConnectionRef.current) {
            console.log('❌ No peer connection available for signal, ignoring');
            return;
        }

        try {
            const { signal } = data;
            const pc = peerConnectionRef.current;
            
            if (signal.type === 'offer') {
                console.log('📥 Processing offer signal');
                await pc.setRemoteDescription(new RTCSessionDescription(signal));
                console.log('✅ Offer set as remote description');
                
            } else if (signal.type === 'answer') {
                console.log('📥 Processing answer signal');
                await pc.setRemoteDescription(new RTCSessionDescription(signal));
                console.log('✅ Answer set as remote description');
                
            } else if (signal.type === 'ice-candidate' && signal.candidate) {
                try {
                    console.log('📥 Adding ICE candidate');
                    await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                    console.log('✅ ICE candidate added successfully');
                } catch (iceError) {
                    // ICE candidate errors are often not critical
                    console.warn('⚠️ ICE candidate error (may be normal):', iceError.message);
                }
            } else {
                console.log('❓ Unknown signal type:', signal.type);
            }
        } catch (error) {
            console.error('❌ Error handling call signal:', error);
            // Don't end call on signal errors as they might be recoverable
        }
    };

    const handleCallAnswered = (data) => {
        console.log('✅ Call answered:', data);
        console.log('🔍 Call answered debug:', {
            hasSignal: !!data.signal,
            signalType: data.signal?.type,
            hasPeerConnection: !!peerConnectionRef.current,
            currentCallState: currentCall,
            answererId: data.answererId
        });
        
        setCallAccepted(true);
        setIncomingCall(null);
        
        // If there's a WebRTC signal in the response, handle it
        if (data.signal && peerConnectionRef.current) {
            console.log('📥 Processing answer signal from call:answered');
            handleCallSignal({ signal: data.signal });
        } else {
            console.log('⚠️ No signal in call:answered response or no peer connection');
            console.log('❓ This might cause connection issues');
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
            
            // Enhanced constraints for better quality and compatibility
            const enhancedConstraints = {
                audio: constraints.audio ? {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 44100
                } : false,
                video: constraints.video ? {
                    width: { ideal: 1280, max: 1920 },
                    height: { ideal: 720, max: 1080 },
                    frameRate: { ideal: 30, max: 60 },
                    facingMode: 'user'
                } : false
            };
            
            console.log('🔧 Enhanced constraints:', enhancedConstraints);
            
            const stream = await navigator.mediaDevices.getUserMedia(enhancedConstraints);
            
            console.log('✅ Media stream obtained:', {
                id: stream.id,
                audioTracks: stream.getAudioTracks().length,
                videoTracks: stream.getVideoTracks().length,
                active: stream.active
            });
            
            // Log track details
            stream.getTracks().forEach(track => {
                console.log(`🎧 Track: ${track.kind} - ${track.label} (enabled: ${track.enabled})`);
            });
            
            setLocalStream(stream);
            localStreamRef.current = stream;
            return stream;
            
        } catch (error) {
            console.error('❌ Error accessing media devices:', error);
            
            // Enhanced error handling with fallbacks
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
                            audio: {
                                echoCancellation: true,
                                noiseSuppression: true,
                                autoGainControl: true
                            }, 
                            video: false 
                        };
                        const audioStream = await navigator.mediaDevices.getUserMedia(audioOnlyConstraints);
                        setLocalStream(audioStream);
                        localStreamRef.current = audioStream;
                        alert('Video device is busy. Switched to audio-only call.');
                        return audioStream;
                    } catch (audioError) {
                        throw new Error('Camera/microphone is already in use. Please close other tabs or applications.');
                    }
                } else {
                    throw new Error('Microphone is already in use. Please close other applications using the microphone.');
                }
            } else if (error.name === 'OverconstrainedError') {
                console.log('🔄 Constraints too strict, trying with basic constraints...');
                try {
                    const basicConstraints = {
                        audio: constraints.audio,
                        video: constraints.video ? true : false
                    };
                    const stream = await navigator.mediaDevices.getUserMedia(basicConstraints);
                    setLocalStream(stream);
                    localStreamRef.current = stream;
                    return stream;
                } catch (basicError) {
                    throw new Error('Unable to access media devices with any settings.');
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
            console.log('🔍 Remote stream details:', {
                streamId: event.streams[0].id,
                trackCount: event.streams[0].getTracks().length,
                audioTracks: event.streams[0].getAudioTracks().length,
                videoTracks: event.streams[0].getVideoTracks().length
            });
            
            // Ensure remote stream has tracks
            if (event.streams[0].getTracks().length > 0) {
                setRemoteStream(event.streams[0]);
                setCallAccepted(true);
                console.log('✅ Remote stream set successfully');
            } else {
                console.log('⚠️ Remote stream has no tracks');
            }
        };

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate && currentCall) {
                console.log('📡 Sending ICE candidate:', {
                    candidate: event.candidate.candidate.substring(0, 50) + '...',
                    sdpMLineIndex: event.candidate.sdpMLineIndex,
                    type: event.candidate.candidate.includes('host') ? 'host' : 
                          event.candidate.candidate.includes('srflx') ? 'srflx' : 
                          event.candidate.candidate.includes('relay') ? 'relay' : 'unknown'
                });
                
                socket.emit('call:signal', {
                    conversationId: currentCall.conversationId,
                    targetUserId: currentCall.targetUserId,
                    signal: {
                        type: 'ice-candidate',
                        candidate: event.candidate
                    }
                });
            } else if (!event.candidate) {
                console.log('📡 ICE gathering complete');
            }
        };

        // Handle connection state changes
        pc.onconnectionstatechange = () => {
            console.log('� Connection state:', pc.connectionState);
            console.log('🔍 Connection details:', {
                connectionState: pc.connectionState,
                iceConnectionState: pc.iceConnectionState,
                iceGatheringState: pc.iceGatheringState,
                signalingState: pc.signalingState
            });
            
            if (pc.connectionState === 'connected') {
                console.log('🎉 WebRTC connection established successfully!');
                setCallAccepted(true);
            } else if (pc.connectionState === 'failed') {
                console.log('💔 WebRTC connection failed, ending call');
                setTimeout(() => {
                    if (pc.connectionState === 'failed') {
                        endCall();
                    }
                }, 5000); // Give 5 seconds for potential recovery
            }
        };

        // Handle ICE connection state changes
        pc.oniceconnectionstatechange = () => {
            console.log('🧊 ICE connection state:', pc.iceConnectionState);
            
            if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
                console.log('✅ ICE connection established!');
            } else if (pc.iceConnectionState === 'failed') {
                console.log('🔄 ICE connection failed, restarting ICE...');
                try {
                    pc.restartIce();
                } catch (error) {
                    console.error('Failed to restart ICE:', error);
                }
            } else if (pc.iceConnectionState === 'disconnected') {
                console.log('⚠️ ICE connection disconnected, waiting for reconnection...');
            }
        };

        // Handle signaling state changes
        pc.onsignalingstatechange = () => {
            console.log('📶 Signaling state:', pc.signalingState);
        };

        // Handle ICE gathering state changes
        pc.onicegatheringstatechange = () => {
            console.log('🧊 ICE gathering state:', pc.iceGatheringState);
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

            // Set current call BEFORE creating offer (needed for ICE candidates)
            setCurrentCall({
                conversationId,
                callType,
                targetUserId,
                isInitiator: true
            });

            // Add local stream to peer connection
            if (localStreamRef.current) {
                console.log('🎵 Adding local tracks to peer connection');
                localStreamRef.current.getTracks().forEach(track => {
                    pc.addTrack(track, localStreamRef.current);
                    console.log('➕ Added track:', track.kind);
                });
            }

            // Create and send offer
            console.log('🔄 Creating WebRTC offer...');
            const offer = await pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: callType === 'video' || callType === 'screen'
            });
            await pc.setLocalDescription(offer);

            console.log('📡 Sending call start signal with offer');
            console.log('🔍 Offer details:', {
                type: offer.type,
                hasSDp: !!offer.sdp,
                sdpLength: offer.sdp?.length
            });
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
            console.log('🔍 Incoming call signal details:', {
                hasSignal: !!incomingCall.signal,
                signalType: incomingCall.signal?.type,
                callType: incomingCall.callType
            });
            
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

            // Create peer connection BEFORE setting current call
            const pc = createPeerConnection();
            peerConnectionRef.current = pc;

            // Set current call BEFORE handling signals
            setCurrentCall({
                conversationId: incomingCall.conversationId,
                callType: incomingCall.callType,
                targetUserId: incomingCall.callerId,
                isInitiator: false
            });

            // Add local stream to peer connection
            if (localStreamRef.current) {
                console.log('🎵 Adding local tracks to peer connection');
                localStreamRef.current.getTracks().forEach(track => {
                    pc.addTrack(track, localStreamRef.current);
                    console.log('➕ Added track:', track.kind);
                });
            }

            // Process the incoming offer signal
            if (incomingCall.signal) {
                console.log('📥 Setting remote description from incoming call');
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
                    answererId: user?.id || user?.uid || 'anonymous',
                    signal: answer,
                    callId: incomingCall.callId
                });
            } else {
                console.error('❌ No signal in incoming call - this will cause issues!');
            }

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