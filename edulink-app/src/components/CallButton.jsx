import React, { useState } from 'react';
import CallInterface from './Calls/CallInterface';
import './CallButton.css';

const CallButton = () => {
    const [isCallInterfaceOpen, setIsCallInterfaceOpen] = useState(false);

    return (
        <>
            <button 
                className="call-button-fab"
                onClick={() => setIsCallInterfaceOpen(true)}
                title="Start Audio/Video Call"
            >
                📞
            </button>

            <CallInterface 
                isOpen={isCallInterfaceOpen}
                onClose={() => setIsCallInterfaceOpen(false)}
            />
        </>
    );
};

export default CallButton;