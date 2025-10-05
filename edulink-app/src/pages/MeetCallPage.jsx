import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { useWebRTCSimple } from '../hooks/useWebRTCSimple';
import { auth } from '../App';
import VideoCallWindow from '../components/Calls/VideoCallWindow';
import './MeetCallPage.css';

export default function MeetCallPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { socket } = useSocket();
    const [user, setUser] = useState(null);
    const [meetData, setMeetData] = useState(null);
    const [callStarted, setCallStarted] = useState(false);

    // ✅ FIXED: Pass user first, null second (same as ChatPage)
    const {
        currentCall,
        localStream,
        remoteStream,
        startCall,
        endCall
    } = useWebRTCSimple(user, null);

    // Get user info
    useEffect(() => {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            navigate('/auth');
            return;
        }

        setUser({
            id: currentUser.uid,
            username: currentUser.displayName || currentUser.email,
            displayName: currentUser.displayName || currentUser.email,
            profilePictureUrl: currentUser.photoURL
        });
    }, [navigate]);

    // Handle Meet call initialization
    useEffect(() => {
        if (!socket || !user) return;

        const state = location.state;
        if (!state?.meetData) {
            console.error('❌ No meet data provided');
            navigate('/');
            return;
        }

        const data = state.meetData;
        setMeetData(data);

        console.log('🎲 Initializing Meet call:', data);
        console.log('- Room ID:', data.roomId);
        console.log('- Call Type:', data.callType);
        console.log('- Partner:', data.partnerName);
        console.log('- Is Initiator:', data.isInitiator);

        // Start the call with Meet-specific parameters
        if (!callStarted) {
            console.log('📞 Starting Meet call with params:');
            console.log('  - roomId:', data.roomId);
            console.log('  - callType:', data.callType || 'video');
            console.log('  - partnerId:', data.partnerId);
            console.log('  - isInitiator:', data.isInitiator);
            
            // Pass roomId directly (already has 'meet_' prefix from backend)
            startCall(data.roomId, data.callType || 'video', data.partnerId, data.isInitiator);
            setCallStarted(true);
        }

    }, [socket, user, location.state, navigate, startCall, callStarted]);

    const handleEndCall = () => {
        console.log('📞 Ending Meet call');
        endCall();
        navigate('/');
    };

    if (!meetData || !user) {
        return (
            <div className="meet-call-page">
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>Connecting...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="meet-call-page">
            <div className="meet-call-header">
                <div className="partner-info">
                    <img 
                        src={meetData.partnerProfilePicture || 'https://via.placeholder.com/40'} 
                        alt={meetData.partnerName}
                        className="partner-avatar"
                    />
                    <div className="partner-details">
                        <h3>{meetData.partnerName}</h3>
                        <p>@{meetData.partnerUsername}</p>
                    </div>
                </div>
                <div className="meet-badge">
                    🎲 Random Meet • 📞 Audio Call
                </div>
            </div>

            {currentCall ? (
                <VideoCallWindow
                    call={{
                        ...currentCall,
                        participantName: meetData.partnerName,  // ✅ Add partner name from meetData
                        callType: meetData.callType || 'audio'  // ✅ Ensure callType is set
                    }}
                    localStream={localStream}
                    remoteStream={remoteStream}
                    onEndCall={handleEndCall}
                />
            ) : (
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>Connecting to {meetData.partnerName}...</p>
                </div>
            )}
        </div>
    );
}
