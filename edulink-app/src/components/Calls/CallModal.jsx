import { useState, useEffect } from 'react';
import './CallModal.css';

const CallModal = ({ call, onAnswer, onDecline }) => {
    const [ringtone, setRingtone] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        // Play ringtone sound
        const audio = new Audio('/sounds/ringtone.mp3');
        audio.loop = true;
        audio.volume = 0.5;
        
        const playRingtone = async () => {
            try {
                await audio.play();
                setRingtone(audio);
            } catch (error) {
                console.log('Could not play ringtone:', error);
            }
        };

        playRingtone();

        return () => {
            if (ringtone) {
                ringtone.pause();
                ringtone.currentTime = 0;
            }
        };
    }, []);

    const handleAnswer = () => {
        if (isProcessing) return;
        
        setIsProcessing(true);
        if (ringtone) {
            ringtone.pause();
            ringtone.currentTime = 0;
        }
        onAnswer();
    };

    const handleDecline = () => {
        if (isProcessing) return;
        
        setIsProcessing(true);
        if (ringtone) {
            ringtone.pause();
            ringtone.currentTime = 0;
        }
        onDecline();
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

    const getCallTypeText = () => {
        switch (call.callType) {
            case 'audio':
                return 'Audio Call';
            case 'video':
                return 'Video Call';
            case 'screen':
                return 'Screen Share';
            default:
                return 'Call';
        }
    };

    return (
        <div className="call-modal-overlay">
            <div className="call-modal">
                <div className="call-header">
                    <div className="call-type">
                        <span className="call-icon">{getCallTypeIcon()}</span>
                        <span className="call-text">{getCallTypeText()}</span>
                    </div>
                </div>

                <div className="caller-info">
                    <div className="caller-avatar">
                        <div className="avatar-circle large">
                            👤
                        </div>
                        <div className="calling-animation">
                            <div className="pulse-ring"></div>
                            <div className="pulse-ring delay-1"></div>
                            <div className="pulse-ring delay-2"></div>
                        </div>
                    </div>
                    
                    <h2 className="caller-name">
                        {call.callerName || 'Unknown Caller'}
                    </h2>
                    <p className="call-status">Incoming {getCallTypeText().toLowerCase()}...</p>
                </div>

                <div className="call-actions">
                    <button 
                        className={`call-button decline ${isProcessing ? 'disabled' : ''}`}
                        onClick={handleDecline}
                        disabled={isProcessing}
                        title="Decline call"
                    >
                        <span className="button-icon">❌</span>
                        <span className="button-text">
                            {isProcessing ? 'Processing...' : 'Decline'}
                        </span>
                    </button>

                    <button 
                        className={`call-button answer ${isProcessing ? 'disabled' : ''}`}
                        onClick={handleAnswer}
                        disabled={isProcessing}
                        title="Answer call"
                    >
                        <span className="button-icon">✅</span>
                        <span className="button-text">
                            {isProcessing ? 'Processing...' : 'Answer'}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CallModal;