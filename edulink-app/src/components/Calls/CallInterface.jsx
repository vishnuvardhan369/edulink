import React, { useState, useRef, useEffect } from 'react';
import { useWebRTCCall } from '../../hooks/useWebRTCCall';
import { useAuth } from '../../hooks/useAuth';
import './CallInterface.css';

const CallInterface = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const [roomIdInput, setRoomIdInput] = useState('');
    const [callStatus, setCallStatus] = useState('Not connected');
    
    const {
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
    } = useWebRTCCall();

    const localVideoRef = useRef(null);
    const remoteVideoRefs = useRef(new Map());

    // Update local video
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    // Update remote videos
    useEffect(() => {
        remoteStreams.forEach((stream, userId) => {
            const videoElement = remoteVideoRefs.current.get(userId);
            if (videoElement) {
                videoElement.srcObject = stream;
            }
        });
    }, [remoteStreams]);

    // Update call status
    useEffect(() => {
        if (isInCall && roomId) {
            const remoteUserCount = remoteStreams.size;
            setCallStatus(`Connected to room: ${roomId} (${remoteUserCount} other user${remoteUserCount !== 1 ? 's' : ''})`);
        } else {
            setCallStatus('Not connected');
        }
    }, [isInCall, roomId, remoteStreams.size]);

    const handleJoinCall = async (callType = 'audio') => {
        if (!roomIdInput.trim()) {
            alert('Please enter a room ID');
            return;
        }

        try {
            const enableVideo = callType === 'video' || callType === 'screen';
            await joinCall(roomIdInput.trim(), enableVideo, true);
        } catch (error) {
            console.error('Error joining call:', error);
            alert('Could not join call. Please check your camera/microphone permissions.');
        }
    };

    const handleLeaveCall = () => {
        leaveCall();
        setRoomIdInput('');
    };

    const handleScreenShare = async () => {
        try {
            await toggleScreenShare();
        } catch (error) {
            console.error('Error toggling screen share:', error);
            alert('Could not start screen sharing');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="call-interface-overlay">
            <div className="call-interface">
                <div className="call-header">
                    <h2>📞 EduLink Calls</h2>
                    <button className="close-button" onClick={onClose}>✕</button>
                </div>

                {!isInCall ? (
                    <div className="call-setup">
                        <div className="room-input">
                            <input
                                type="text"
                                value={roomIdInput}
                                onChange={(e) => setRoomIdInput(e.target.value)}
                                placeholder="Enter Room ID"
                                className="room-id-input"
                            />
                        </div>

                        <div className="call-type-buttons">
                            <button 
                                className="call-button audio"
                                onClick={() => handleJoinCall('audio')}
                                disabled={!roomIdInput.trim()}
                            >
                                🎵 Audio Call
                            </button>
                            
                            <button 
                                className="call-button video"
                                onClick={() => handleJoinCall('video')}
                                disabled={!roomIdInput.trim()}
                            >
                                📹 Video Call
                            </button>
                        </div>

                        <div className="call-status">
                            <p>{callStatus}</p>
                        </div>
                    </div>
                ) : (
                    <div className="call-active">
                        <div className="call-info">
                            <p className="room-info">Room: {roomId}</p>
                            <p className="status-info">{callStatus}</p>
                        </div>

                        <div className="video-container">
                            {/* Local video */}
                            <div className="video-wrapper local">
                                {isVideoEnabled || isScreenSharing ? (
                                    <video
                                        ref={localVideoRef}
                                        autoPlay
                                        muted
                                        playsInline
                                        className="video-element"
                                    />
                                ) : (
                                    <div className="audio-placeholder">
                                        <div className="avatar">👤</div>
                                        <span>You</span>
                                    </div>
                                )}
                                <label className="video-label">
                                    You {isScreenSharing && '(Sharing Screen)'}
                                </label>
                            </div>

                            {/* Remote videos */}
                            {Array.from(remoteStreams.entries()).map(([userId, stream]) => (
                                <div key={userId} className="video-wrapper remote">
                                    <video
                                        ref={(el) => {
                                            if (el) {
                                                remoteVideoRefs.current.set(userId, el);
                                                el.srcObject = stream;
                                            }
                                        }}
                                        autoPlay
                                        playsInline
                                        className="video-element"
                                    />
                                    <label className="video-label">User {userId.slice(-4)}</label>
                                </div>
                            ))}

                            {remoteStreams.size === 0 && (
                                <div className="video-wrapper remote waiting">
                                    <div className="audio-placeholder">
                                        <div className="avatar">⏳</div>
                                        <span>Waiting for others...</span>
                                    </div>
                                    <label className="video-label">No other users</label>
                                </div>
                            )}
                        </div>

                        <div className="call-controls">
                            <div className="media-controls">
                                <button
                                    className={`control-btn ${!isAudioEnabled ? 'muted' : ''}`}
                                    onClick={toggleAudio}
                                    title={isAudioEnabled ? 'Mute Audio' : 'Unmute Audio'}
                                >
                                    {isAudioEnabled ? '🔊' : '🔇'}
                                </button>

                                <button
                                    className={`control-btn ${!isVideoEnabled ? 'disabled' : ''}`}
                                    onClick={toggleVideo}
                                    title={isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
                                    disabled={isScreenSharing}
                                >
                                    {isVideoEnabled ? '📹' : '📷'}
                                </button>

                                <button
                                    className={`control-btn screen-share ${isScreenSharing ? 'active' : ''}`}
                                    onClick={handleScreenShare}
                                    title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
                                >
                                    {isScreenSharing ? '🛑' : '🖥️'}
                                </button>
                            </div>

                            <button
                                className="end-call-btn"
                                onClick={handleLeaveCall}
                                title="Leave Call"
                            >
                                📞 End Call
                            </button>
                        </div>
                    </div>
                )}

                <div className="call-footer">
                    <p className="help-text">
                        💡 Share the same Room ID with others to join the call
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CallInterface;