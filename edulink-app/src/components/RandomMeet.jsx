import React, { useState, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useWebRTCSimple } from '../hooks/useWebRTCSimple';
import VideoCallWindow from './Calls/VideoCallWindow';
import { auth } from '../App';
import './RandomMeet.css';

export default function RandomMeet() {
    const [isSearching, setIsSearching] = useState(false);
    const [socketReady, setSocketReady] = useState(false);
    const [meetData, setMeetData] = useState(null);
    const [callStarted, setCallStarted] = useState(false);
    const [user, setUser] = useState(null);
    const { socket, isConnected } = useSocket();
    const currentUser = auth.currentUser;

    const {
        currentCall,
        localStream,
        remoteStream,
        startCall,
        endCall
    } = useWebRTCSimple(user, null);

    // Set user info
    useEffect(() => {
        if (!currentUser) {
            setUser(null);
            return;
        }

        setUser({
            id: currentUser.uid,
            username: currentUser.displayName || currentUser.email,
            displayName: currentUser.displayName || currentUser.email,
            profilePictureUrl: currentUser.photoURL
        });
    }, [currentUser]);

    useEffect(() => {
        if (!socket || !currentUser || !isConnected) {
            setSocketReady(false);
            return;
        }

        console.log('🔌 RandomMeet: Socket connected, ensuring user is joined...');
        
        // Make sure user has joined the socket with full display information
        socket.emit('user:join', {
            userId: currentUser.uid,
            username: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
            displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
            profilePicture: currentUser.photoURL || null
        });

        socket.once('user:joined', (data) => {
            console.log('✅ RandomMeet: User joined successfully', data);
            setSocketReady(true);
        });

        // Listen for meet events
        socket.on('meet:searching', (data) => {
            console.log('🔍 Searching for match:', data);
            setIsSearching(true);
        });

        socket.on('meet:matched', (data) => {
            console.log('🎉 Match found!', data);
            setIsSearching(false);
            setMeetData(data);
            
            // Start the call immediately
            console.log('📞 Starting Meet call with params:');
            console.log('  - roomId:', data.roomId);
            console.log('  - callType:', data.callType || 'audio');
            console.log('  - partnerId:', data.partnerId);
            console.log('  - isInitiator:', data.isInitiator);
            
            if (!callStarted && user) {
                startCall(data.roomId, data.callType || 'audio', data.partnerId, data.isInitiator);
                setCallStarted(true);
            }
        });

        socket.on('meet:cancelled', (data) => {
            console.log('🚫 Search cancelled:', data);
            setIsSearching(false);
        });

        socket.on('meet:error', (data) => {
            console.error('❌ Meet error:', data);
            setIsSearching(false);
            alert(data.message || 'An error occurred. Please try again.');
        });

        return () => {
            socket.off('user:joined');
            socket.off('meet:searching');
            socket.off('meet:matched');
            socket.off('meet:cancelled');
            socket.off('meet:error');
        };
    }, [socket, currentUser, isConnected, user, callStarted, startCall]);

    const handleEndCall = () => {
        console.log('📞 Ending Meet call');
        endCall();
        setMeetData(null);
        setCallStarted(false);
    };

    const handleDiceClick = () => {
        console.log('🎲 Dice clicked', { socket: !!socket, currentUser: !!currentUser, socketReady, isSearching });
        
        if (!socket || !currentUser || !socketReady) {
            alert('Connecting... Please wait');
            return;
        }

        if (isSearching) {
            // Cancel search if already searching
            console.log('� Cancelling search');
            socket.emit('meet:cancel', {});
            setIsSearching(false);
        } else {
            // Start searching
            console.log('📤 Starting random meet search');
            setIsSearching(true);
            
            // Auto-enable and request match in one go
            socket.emit('meet:toggle', { enabled: true });
            socket.emit('meet:request', {});
        }
    };

    if (!currentUser) {
        return null; // Don't show if user is not logged in
    }

    return (
        <>
            {/* Simple Floating Dice Button */}
            <button
                className={`floating-dice-button ${isSearching ? 'searching' : ''}`}
                onClick={handleDiceClick}
                title={isSearching ? 'Cancel search' : 'Random audio call'}
                style={{ display: meetData ? 'none' : 'flex' }} // Hide when in call
            >
                {isSearching ? (
                    <div className="searching-spinner"></div>
                ) : (
                    <span className="dice-icon">🎲</span>
                )}
            </button>

            {/* Call Window Overlay - Shows on top of current page */}
            {meetData && currentCall && (
                <div className="meet-call-overlay">
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

                    <VideoCallWindow
                        call={{
                            ...currentCall,
                            participantName: meetData.partnerName,
                            callType: meetData.callType || 'audio'
                        }}
                        localStream={localStream}
                        remoteStream={remoteStream}
                        onEndCall={handleEndCall}
                    />
                </div>
            )}
        </>
    );
}
