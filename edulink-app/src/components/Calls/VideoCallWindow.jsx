import { useState, useRef, useEffect } from 'react';
import './VideoCallWindow.css';

const VideoCallWindow = ({ call, localStream, remoteStream, onEndCall, user, socket }) => {
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(call?.callType === 'audio');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [callStarted, setCallStarted] = useState(false);
    
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const remoteAudioRef = useRef(null);  // For audio-only calls
    const callStartTime = useRef(null);
    const durationInterval = useRef(null);
    const processingTimeout = useRef(null);

    const isAudioCall = call?.callType === 'audio';

    useEffect(() => {
        // Set up video streams
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
        
        // For audio calls, use audio element; for video calls, use video element
        if (remoteStream) {
            if (isAudioCall && remoteAudioRef.current) {
                console.log('🔊 Setting remote audio stream for audio call');
                remoteAudioRef.current.srcObject = remoteStream;
                remoteAudioRef.current.play().catch(err => {
                    console.error('❌ Error playing remote audio:', err);
                });
            } else if (!isAudioCall && remoteVideoRef.current) {
                console.log('📹 Setting remote video stream for video call');
                remoteVideoRef.current.srcObject = remoteStream;
            }
        }
    }, [localStream, remoteStream, isAudioCall]);

    useEffect(() => {
        // Start timer only when remote stream is connected (call answered)
        if (remoteStream && !callStarted) {
            console.log('📞 Call answered, starting timer');
            setCallStarted(true);
            callStartTime.current = Date.now();
            
            durationInterval.current = setInterval(() => {
                setCallDuration(Math.floor((Date.now() - callStartTime.current) / 1000));
            }, 1000);
        }

        return () => {
            if (durationInterval.current) {
                clearInterval(durationInterval.current);
            }
            if (processingTimeout.current) {
                clearTimeout(processingTimeout.current);
            }
        };
    }, [remoteStream, callStarted]);

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const toggleMute = () => {
        if (isProcessing) return;
        
        setIsProcessing(true);
        
        if (localStream) {
            const audioTracks = localStream.getAudioTracks();
            audioTracks.forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsMuted(!audioTracks[0]?.enabled);
        }
        
        // Reset processing state after delay
        processingTimeout.current = setTimeout(() => {
            setIsProcessing(false);
        }, 300);
    };

    const toggleVideo = () => {
        if (isProcessing) return;
        
        setIsProcessing(true);
        
        if (localStream) {
            const videoTracks = localStream.getVideoTracks();
            videoTracks.forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsVideoOff(!videoTracks[0]?.enabled);
        }
        
        // Reset processing state after delay
        processingTimeout.current = setTimeout(() => {
            setIsProcessing(false);
        }, 300);
    };

    const toggleFullscreen = () => {
        if (isProcessing) return;
        
        setIsProcessing(true);
        
        const element = document.querySelector('.video-call-window');
        
        if (!isFullscreen) {
            if (element.requestFullscreen) {
                element.requestFullscreen();
            } else if (element.webkitRequestFullscreen) {
                element.webkitRequestFullscreen();
            } else if (element.mozRequestFullScreen) {
                element.mozRequestFullScreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            }
        }
        
        setIsFullscreen(!isFullscreen);
        
        // Reset processing state after delay
        processingTimeout.current = setTimeout(() => {
            setIsProcessing(false);
        }, 300);
    };

    const handleEndCall = () => {
        if (durationInterval.current) {
            clearInterval(durationInterval.current);
        }
        
        // Pass duration to onEndCall so it can send to backend via webrtc:leave-room
        console.log('📞 Ending call, duration:', callDuration, 'seconds');
        onEndCall(callDuration);
    };

    const getCallTypeIcon = () => {
        switch (call.callType) {
            case 'audio':
                return '📞';
            case 'video':
                return '📹';
            case 'screen':
                return '🖥️';
            default:
                return '📞';
        }
    };

    const isScreenShare = call.callType === 'screen';

    return (
        <div className={`video-call-window ${isFullscreen ? 'fullscreen' : ''}`}>
            <div className="call-header">
                <div className="call-info">
                    <span className="call-type-icon">{getCallTypeIcon()}</span>
                    <div className="call-details">
                        <span className="participant-name">
                            {call.participantName || 'Unknown User'}
                        </span>
                        <span className="call-duration">
                            {formatDuration(callDuration)}
                        </span>
                    </div>
                </div>
                
                <div className="call-header-actions">
                    {!isAudioCall && (
                        <button 
                            className="header-button"
                            onClick={toggleFullscreen}
                            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                        >
                            {isFullscreen ? '🗗' : '⛶'}
                        </button>
                    )}
                </div>
            </div>

            <div className="video-container">
                {/* Hidden audio element for audio-only calls */}
                {isAudioCall && (
                    <audio 
                        ref={remoteAudioRef} 
                        autoPlay 
                        playsInline
                        style={{ display: 'none' }}
                    />
                )}
                
                {/* Remote video/audio */}
                <div className="remote-video">
                    {/* Audio calls: Always show avatar with visualizer (no video) */}
                    {isAudioCall ? (
                        <div className="audio-call-avatar">
                            <div className="avatar-circle extra-large">
                                👤
                            </div>
                            <div className="audio-visualizer">
                                <div className="bar"></div>
                                <div className="bar"></div>
                                <div className="bar"></div>
                                <div className="bar"></div>
                                <div className="bar"></div>
                            </div>
                            {remoteStream && (
                                <p className="audio-connected">🔊 Connected</p>
                            )}
                        </div>
                    ) : (
                        /* Video calls: Show video stream */
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            className="remote-stream"
                        />
                    )}
                    
                    {!remoteStream && !isAudioCall && (
                        <div className="no-video-placeholder">
                            <div className="avatar-circle large">👤</div>
                            <p>Waiting for {call.participantName || 'participant'}...</p>
                        </div>
                    )}
                </div>

                {/* Local video (picture-in-picture) - ONLY for video/screen calls */}
                {!isAudioCall && localStream && (
                    <div className={`local-video ${isVideoOff ? 'video-off' : ''}`}>
                        {isVideoOff ? (
                            <div className="local-avatar">
                                <div className="avatar-circle medium">👤</div>
                            </div>
                        ) : (
                            <video
                                ref={localVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className="local-stream"
                            />
                        )}
                    </div>
                )}
            </div>

            <div className="call-controls">
                <div className="control-buttons">
                    <button
                        className={`control-button ${isProcessing ? 'disabled' : ''}`}
                        onClick={toggleMute}
                        disabled={isProcessing}
                        title={isMuted ? 'Unmute' : 'Mute'}
                    >
                        {isMuted ? '🔇' : '🔊'}
                    </button>

                    {/* Only show video toggle for video/screen calls, NOT for audio calls */}
                    {!isAudioCall && (
                        <button
                            className={`control-button ${isVideoOff ? 'active' : ''} ${isProcessing ? 'disabled' : ''}`}
                            onClick={toggleVideo}
                            disabled={isProcessing}
                            title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
                        >
                            {isVideoOff ? '📷' : '📹'}
                        </button>
                    )}

                    {call.callType === 'video' && (
                        <button
                            className={`control-button screen-share ${isProcessing ? 'disabled' : ''}`}
                            onClick={() => alert('Screen sharing: Use the screen share call type when starting a call')}
                            disabled={isProcessing}
                            title="Screen sharing available as call type"
                        >
                            🖥️
                        </button>
                    )}
                </div>

                <button
                    className="end-call-button"
                    onClick={handleEndCall}
                    title="End call"
                >
                    📞❌
                </button>
            </div>
        </div>
    );
};

export default VideoCallWindow;