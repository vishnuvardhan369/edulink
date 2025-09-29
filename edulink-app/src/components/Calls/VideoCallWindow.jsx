import { useState, useRef, useEffect } from 'react';
import './VideoCallWindow.css';

const VideoCallWindow = ({ call, localStream, remoteStream, onEndCall, user }) => {
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const callStartTime = useRef(Date.now());
    const durationInterval = useRef(null);
    const processingTimeout = useRef(null);

    useEffect(() => {
        // Set up video streams
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
        
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [localStream, remoteStream]);

    useEffect(() => {
        // Start call duration timer
        durationInterval.current = setInterval(() => {
            setCallDuration(Math.floor((Date.now() - callStartTime.current) / 1000));
        }, 1000);

        return () => {
            if (durationInterval.current) {
                clearInterval(durationInterval.current);
            }
            if (processingTimeout.current) {
                clearTimeout(processingTimeout.current);
            }
        };
    }, []);

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
        onEndCall();
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

    const isAudioCall = call.callType === 'audio';
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
                {/* Remote video/audio */}
                <div className="remote-video">
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
                        </div>
                    ) : (
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

                {/* Local video (picture-in-picture) */}
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