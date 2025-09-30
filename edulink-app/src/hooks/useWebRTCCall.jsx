import { useState, useEffect, useRef } from 'react';
import { useSocket } from './useSocket';

// WebRTC configuration with STUN server
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

export const useWebRTCCall = () => {
    const [localStream, setLocalStream] = useState(null);
    const [remoteStreams, setRemoteStreams] = useState(new Map());
    const [isInCall, setIsInCall] = useState(false);
    const [roomId, setRoomId] = useState(null);
    const [isVideoEnabled, setIsVideoEnabled] = useState(false);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [originalVideoTrack, setOriginalVideoTrack] = useState(null);
    
    const { socket } = useSocket();
    const peerConnections = useRef(new Map()); // userId -> RTCPeerConnection

    // Initialize media stream
    const initializeMedia = async (video = false, audio = true) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio, 
                video 
            });
            setLocalStream(stream);
            setIsVideoEnabled(video);
            setIsAudioEnabled(audio);
            return stream;
        } catch (error) {
            console.error('Error accessing media devices:', error);
            throw error;
        }
    };

    // Create peer connection for a user
    const createPeerConnection = (userId) => {
        console.log(`🔗 Creating peer connection for user: ${userId}`);
        
        const pc = new RTCPeerConnection(configuration);
        
        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate && socket) {
                console.log(`📡 Sending ICE candidate to ${userId}`);
                socket.emit('ice-candidate', {
                    candidate: event.candidate,
                    target: userId
                });
            }
        };

        // Handle incoming tracks
        pc.ontrack = (event) => {
            console.log(`🎵 Received remote stream from ${userId}`);
            const [remoteStream] = event.streams;
            setRemoteStreams(prev => new Map(prev.set(userId, remoteStream)));
        };

        // Handle renegotiation
        pc.onnegotiationneeded = async () => {
            try {
                if (pc.signalingState !== 'stable') return;
                
                console.log(`🔄 Renegotiation needed for ${userId}`);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                
                socket.emit('offer', { offer, target: userId });
            } catch (error) {
                console.error('Renegotiation failed:', error);
            }
        };

        return pc;
    };

    // Join a call room
    const joinCall = async (callRoomId, enableVideo = false, enableAudio = true) => {
        try {
            console.log(`📞 Joining call room: ${callRoomId}`);
            
            // Initialize media first
            const stream = await initializeMedia(enableVideo, enableAudio);
            
            // Join the room
            setRoomId(callRoomId);
            setIsInCall(true);
            
            if (socket) {
                socket.emit('join-room', callRoomId);
            }
            
            return stream;
        } catch (error) {
            console.error('Error joining call:', error);
            throw error;
        }
    };

    // Leave the call
    const leaveCall = () => {
        console.log('📞 Leaving call');
        
        // Stop local stream
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
        }
        
        // Close all peer connections
        peerConnections.current.forEach(pc => pc.close());
        peerConnections.current.clear();
        
        // Clear remote streams
        setRemoteStreams(new Map());
        
        // Reset states
        setIsInCall(false);
        setRoomId(null);
        setIsVideoEnabled(false);
        setIsAudioEnabled(true);
        setIsScreenSharing(false);
        setOriginalVideoTrack(null);
    };

    // Toggle video
    const toggleVideo = async () => {
        if (!localStream) return;
        
        const newVideoState = !isVideoEnabled;
        setIsVideoEnabled(newVideoState);

        if (newVideoState) {
            try {
                const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
                const videoTrack = videoStream.getVideoTracks()[0];
                
                // Replace or add video track
                const sender = peerConnections.current.forEach((pc) => {
                    const videoSender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
                    if (videoSender) {
                        videoSender.replaceTrack(videoTrack);
                    } else {
                        pc.addTrack(videoTrack, localStream);
                    }
                });
                
                // Add to local stream
                localStream.addTrack(videoTrack);
                setLocalStream(new MediaStream(localStream.getTracks()));
                
            } catch (error) {
                console.error('Error enabling video:', error);
                setIsVideoEnabled(false);
            }
        } else {
            // Remove video track
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.stop();
                localStream.removeTrack(videoTrack);
                setLocalStream(new MediaStream(localStream.getTracks()));
                
                // Update peer connections
                peerConnections.current.forEach((pc) => {
                    const sender = pc.getSenders().find(s => s.track === videoTrack);
                    if (sender) {
                        sender.replaceTrack(null);
                    }
                });
            }
        }
    };

    // Toggle audio
    const toggleAudio = () => {
        if (!localStream) return;
        
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            setIsAudioEnabled(audioTrack.enabled);
        }
    };

    // Toggle screen share
    const toggleScreenShare = async () => {
        if (!isScreenSharing) {
            try {
                // Start screen sharing
                const screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: true
                });
                
                const screenTrack = screenStream.getVideoTracks()[0];
                
                // Store original video track
                const currentVideoTrack = localStream.getVideoTracks()[0];
                if (currentVideoTrack) {
                    setOriginalVideoTrack(currentVideoTrack);
                    currentVideoTrack.stop();
                    localStream.removeTrack(currentVideoTrack);
                }
                
                // Add screen track
                localStream.addTrack(screenTrack);
                setLocalStream(new MediaStream(localStream.getTracks()));
                
                // Update peer connections
                peerConnections.current.forEach(async (pc) => {
                    const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
                    if (sender) {
                        await sender.replaceTrack(screenTrack);
                    } else {
                        pc.addTrack(screenTrack, localStream);
                    }
                });
                
                setIsScreenSharing(true);
                
                // Handle when user stops sharing via browser UI
                screenTrack.onended = () => {
                    stopScreenShare();
                };
                
            } catch (error) {
                console.error('Error starting screen share:', error);
            }
        } else {
            stopScreenShare();
        }
    };

    // Stop screen sharing
    const stopScreenShare = async () => {
        if (!isScreenSharing) return;
        
        const screenTrack = localStream.getVideoTracks()[0];
        if (screenTrack) {
            screenTrack.stop();
            localStream.removeTrack(screenTrack);
        }
        
        // Restore original video track if it existed
        if (originalVideoTrack || isVideoEnabled) {
            try {
                const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
                const newVideoTrack = videoStream.getVideoTracks()[0];
                localStream.addTrack(newVideoTrack);
                
                // Update peer connections
                peerConnections.current.forEach(async (pc) => {
                    const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
                    if (sender) {
                        await sender.replaceTrack(newVideoTrack);
                    }
                });
                
            } catch (error) {
                console.error('Error restoring camera:', error);
                setIsVideoEnabled(false);
            }
        }
        
        setLocalStream(new MediaStream(localStream.getTracks()));
        setIsScreenSharing(false);
        setOriginalVideoTrack(null);
    };

    // Socket event handlers
    useEffect(() => {
        if (!socket) return;

        // Handle new user connected
        socket.on('user-connected', async (userId) => {
            console.log(`👤 User connected: ${userId}`);
            
            if (!localStream) return;
            
            // Create peer connection for new user
            const pc = createPeerConnection(userId);
            peerConnections.current.set(userId, pc);

            // Add local stream tracks
            localStream.getTracks().forEach(track => {
                pc.addTrack(track, localStream);
            });

            // Create and send offer
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit('offer', { offer, target: userId });
            } catch (error) {
                console.error('Error creating offer:', error);
            }
        });

        // Handle incoming offer
        socket.on('offer', async (data) => {
            const { offer, caller } = data;
            console.log(`📞 Received offer from: ${caller}`);
            
            if (!localStream) return;
            
            // Create peer connection for caller
            const pc = createPeerConnection(caller);
            peerConnections.current.set(caller, pc);

            // Add local stream tracks
            localStream.getTracks().forEach(track => {
                pc.addTrack(track, localStream);
            });

            try {
                // Set remote description and create answer
                await pc.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                
                socket.emit('answer', { answer, target: caller });
            } catch (error) {
                console.error('Error handling offer:', error);
            }
        });

        // Handle incoming answer
        socket.on('answer', async (data) => {
            const { answer, answerer } = data;
            console.log(`✅ Received answer from: ${answerer}`);
            
            const pc = peerConnections.current.get(answerer);
            if (pc) {
                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(answer));
                } catch (error) {
                    console.error('Error handling answer:', error);
                }
            }
        });

        // Handle ICE candidates
        socket.on('ice-candidate', async (data) => {
            const { candidate, from } = data;
            console.log(`📡 Received ICE candidate from: ${from}`);
            
            const pc = peerConnections.current.get(from);
            if (pc) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (error) {
                    console.error('Error adding ICE candidate:', error);
                }
            }
        });

        // Handle user disconnected
        socket.on('user-disconnected', (userId) => {
            console.log(`👋 User disconnected: ${userId}`);
            
            const pc = peerConnections.current.get(userId);
            if (pc) {
                pc.close();
                peerConnections.current.delete(userId);
            }
            
            setRemoteStreams(prev => {
                const newMap = new Map(prev);
                newMap.delete(userId);
                return newMap;
            });
        });

        return () => {
            socket.off('user-connected');
            socket.off('offer');
            socket.off('answer');
            socket.off('ice-candidate');
            socket.off('user-disconnected');
        };
    }, [socket, localStream]);

    return {
        localStream,
        remoteStreams,
        isInCall,
        roomId,
        isVideoEnabled,
        isAudioEnabled,
        isScreenSharing,
        joinCall,
        leaveCall,
        toggleVideo,
        toggleAudio,
        toggleScreenShare
    };
};