import React from 'react';
import './CallControls.css';

const CallControls = ({ 
    isAudioEnabled, 
    isVideoEnabled, 
    isScreenSharing, 
    callType,
    onToggleAudio, 
    onToggleVideo, 
    onToggleScreenShare, 
    onEndCall,
    isProcessing = false 
}) => {
    const getCallTypeIcon = () => {
        switch (callType) {
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

    return (
        <div className="call-controls">
            <div className="call-type-indicator">
                <span className="call-type-icon">{getCallTypeIcon()}</span>
                <span className="call-type-text">
                    {callType === 'audio' && 'Audio Call'}
                    {callType === 'video' && 'Video Call'}
                    {callType === 'screen' && 'Screen Share'}
                </span>
            </div>

            <div className="control-buttons">
                {/* Audio Toggle */}
                <button
                    className={`control-button audio ${!isAudioEnabled ? 'muted' : ''} ${isProcessing ? 'disabled' : ''}`}
                    onClick={onToggleAudio}
                    disabled={isProcessing}
                    title={isAudioEnabled ? 'Mute Audio' : 'Unmute Audio'}
                >
                    <span className="button-icon">
                        {isAudioEnabled ? '🔊' : '🔇'}
                    </span>
                    <span className="button-text">
                        {isAudioEnabled ? 'Mute' : 'Unmute'}
                    </span>
                </button>

                {/* Video Toggle (only for video and screen calls) */}
                {(callType === 'video' || callType === 'screen') && (
                    <button
                        className={`control-button video ${!isVideoEnabled ? 'disabled-video' : ''} ${isProcessing ? 'disabled' : ''}`}
                        onClick={onToggleVideo}
                        disabled={isProcessing || isScreenSharing}
                        title={isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
                    >
                        <span className="button-icon">
                            {isVideoEnabled ? '📹' : '📷'}
                        </span>
                        <span className="button-text">
                            {isVideoEnabled ? 'Camera Off' : 'Camera On'}
                        </span>
                    </button>
                )}

                {/* Screen Share Toggle (only for video calls) */}
                {callType === 'video' && (
                    <button
                        className={`control-button screen-share ${isScreenSharing ? 'sharing' : ''} ${isProcessing ? 'disabled' : ''}`}
                        onClick={onToggleScreenShare}
                        disabled={isProcessing}
                        title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
                    >
                        <span className="button-icon">
                            {isScreenSharing ? '🛑' : '🖥️'}
                        </span>
                        <span className="button-text">
                            {isScreenSharing ? 'Stop Share' : 'Share Screen'}
                        </span>
                    </button>
                )}
            </div>

            {/* End Call Button */}
            <button
                className="end-call-button"
                onClick={onEndCall}
                title="End Call"
            >
                <span className="button-icon">📞</span>
                <span className="button-text">End Call</span>
            </button>
        </div>
    );
};

export default CallControls;