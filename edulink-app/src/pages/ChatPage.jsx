import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { useSocket } from '../hooks/useSocket.jsx';
import { useWebRTCSimple } from '../hooks/useWebRTCSimple.jsx';
import { apiCall } from '../config/api.js';
import ChatSidebar from '../components/Chat/ChatSidebar';
import ChatWindow from '../components/Chat/ChatWindow';
import CallModal from '../components/Calls/CallModal';
import VideoCallWindow from '../components/Calls/VideoCallWindow';
import './ChatPage.css';

const ChatPage = () => {
    const { conversationId } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { socket, isConnected } = useSocket();
    
    // Check for pending call from App.jsx
    const [pendingCall, setPendingCall] = useState(null);
    
    useEffect(() => {
        const pendingCallStr = sessionStorage.getItem('pendingCall');
        if (pendingCallStr) {
            try {
                const call = JSON.parse(pendingCallStr);
                console.log('📞 ChatPage found pending call:', call);
                setPendingCall(call);
                sessionStorage.removeItem('pendingCall');
            } catch (error) {
                console.error('❌ Error parsing pending call:', error);
                sessionStorage.removeItem('pendingCall');
            }
        }
    }, []);
    
    const { 
        incomingCall, 
        currentCall, 
        localStream, 
        remoteStream, 
        answerCall, 
        declineCall, 
        endCall,
        startCall,
        isScreenSharing
    } = useWebRTCSimple(user, pendingCall);

    const [conversations, setConversations] = useState([]);
    const [activeConversation, setActiveConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showNewChat, setShowNewChat] = useState(false);
    
    // Handle Meet calls from RandomMeet component
    useEffect(() => {
        if (!socket || !user) return;
        
        const state = location.state;
        if (state?.startMeetCall && state?.meetData) {
            const meetData = state.meetData;
            console.log('🎲 Starting Meet call:', meetData);
            
            // Start the call as initiator
            startCall(meetData.roomId, meetData.callType, meetData.partnerId, true);
            
            // Clear the location state
            navigate(location.pathname, { replace: true, state: {} });
        } else if (state?.acceptMeetCall && state?.meetData) {
            const meetData = state.meetData;
            console.log('🎲 Accepting Meet call:', meetData);
            
            // Join the call as receiver
            startCall(meetData.roomId, meetData.callType, meetData.partnerId, false);
            
            // Clear the location state
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, socket, user, startCall, navigate, location.pathname]);

    useEffect(() => {
        if (!user) {
            navigate('/auth');
            return;
        }

        if (socket && isConnected) {
            // Join socket with user info
            socket.emit('user:join', {
                userId: user.id,
                username: user.username
            });

            // Socket event listeners
            socket.on('message:receive', handleNewMessage);
            socket.on('user:status_changed', handleUserStatusChange);
            socket.on('typing:user_start', handleTypingStart);
            socket.on('typing:user_stop', handleTypingStop);
            socket.on('message:reaction_updated', handleReactionUpdate);

            loadConversations();
        }

        return () => {
            if (socket) {
                socket.off('message:receive');
                socket.off('user:status_changed');
                socket.off('typing:user_start');
                socket.off('typing:user_stop');
                socket.off('message:reaction_updated');
            }
        };
    }, [user, socket, isConnected, navigate]);

    // Auto-select conversation if conversationId is provided
    useEffect(() => {
        if (conversationId && conversations.length > 0) {
            const conversation = conversations.find(c => c.conversation_id === conversationId);
            if (conversation) {
                selectConversation(conversation);
            }
        }
    }, [conversationId, conversations]);

    // Auto-answer pending call when conversation is loaded
    useEffect(() => {
        if (pendingCall && activeConversation && incomingCall) {
            console.log('📞 Auto-answering pending call');
            console.log('- pendingCall:', pendingCall);
            console.log('- activeConversation:', activeConversation.conversation_id);
            console.log('- incomingCall:', incomingCall);
            
            if (pendingCall.conversationId === activeConversation.conversation_id) {
                // Small delay to ensure everything is ready
                setTimeout(() => {
                    console.log('✅ Calling answerCall()');
                    answerCall();
                }, 500);
            }
        }
    }, [pendingCall, activeConversation, incomingCall, answerCall]);

    const loadConversations = async () => {
        try {
            const response = await apiCall(`/api/chats?userId=${user.id}`);
            if (response.ok) {
                const data = await response.json();
                setConversations(data);
            }
        } catch (error) {
            console.error('Error loading conversations:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadMessages = async (conversationId) => {
        try {
            const response = await apiCall(
                `/api/chats/${conversationId}/messages?userId=${user.id}&limit=50`
            );
            if (response.ok) {
                const data = await response.json();
                setMessages(data);
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    };

    const handleNewMessage = (message) => {
        if (activeConversation && message.conversation_id === activeConversation.conversation_id) {
            // Check for duplicates before adding
            setMessages(prev => {
                const exists = prev.some(msg => msg.message_id === message.message_id);
                if (exists) {
                    console.log('Duplicate message detected, skipping:', message.message_id);
                    return prev;
                }
                return [...prev, message];
            });
        }
        
        // Update conversation list with latest message
        setConversations(prev => 
            prev.map(conv => 
                conv.conversation_id === message.conversation_id
                    ? { ...conv, last_message: message, updated_at: new Date() }
                    : conv
            )
        );
    };

    const handleUserStatusChange = (statusData) => {
        // Update user status in conversations
        setConversations(prev =>
            prev.map(conv => ({
                ...conv,
                participants: conv.participants?.map(p =>
                    p.user_id === statusData.userId
                        ? { ...p, status: statusData.status, lastSeen: statusData.lastSeen }
                        : p
                )
            }))
        );
    };

    const handleTypingStart = (data) => {
        // Handle typing indicators
        console.log(`${data.username} is typing...`);
    };

    const handleTypingStop = (data) => {
        // Handle typing stop
        console.log(`${data.username} stopped typing`);
    };

    const handleReactionUpdate = (data) => {
        setMessages(prev =>
            prev.map(msg =>
                msg.message_id === data.messageId
                    ? { ...msg, reactions: data.reactions }
                    : msg
            )
        );
    };

    const sendMessage = (messageText, messageType = 'text', fileUrl = null, fileName = null) => {
        if (!activeConversation || !socket) return;

        const messageData = {
            conversationId: activeConversation.conversation_id,
            messageText,
            messageType,
            fileUrl,
            fileName
        };

        socket.emit('message:send', messageData);
    };

    const selectConversation = (conversation) => {
        setActiveConversation(conversation);
        loadMessages(conversation.conversation_id);
        
        // Mark messages as read
        markMessagesAsRead(conversation.conversation_id);
    };

    const markMessagesAsRead = async (conversationId) => {
        try {
            const response = await apiCall(`/api/chats/${conversationId}/read`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId: user.id,
                    lastReadMessageId: messages[messages.length - 1]?.message_id
                })
            });

            if (response.ok) {
                // Update unread count in conversations list
                setConversations(prev =>
                    prev.map(conv =>
                        conv.conversation_id === conversationId
                            ? { ...conv, unread_count: 0 }
                            : conv
                    )
                );
            }
        } catch (error) {
            console.error('Error marking messages as read:', error);
        }
    };

    const createNewConversation = async (participants, type = 'direct', name = null) => {
        try {
            const response = await apiCall('/api/chats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    createdBy: user.id,
                    type,
                    name,
                    participants
                })
            });

            if (response.ok) {
                const newConversation = await response.json();
                setConversations(prev => [newConversation, ...prev]);
                setActiveConversation(newConversation);
                setMessages([]);
                setShowNewChat(false);
            }
        } catch (error) {
            console.error('Error creating conversation:', error);
        }
    };

    const initiateCall = (callType) => {
        if (!activeConversation || !socket) return;

        const targetUser = activeConversation.participants.find(p => p.user_id !== user.id);
        if (targetUser) {
            console.log(`📞 Initiating ${callType} call to ${targetUser.user_id}`);
            
            // First, caller joins the room and starts their media
            startCall(activeConversation.conversation_id, callType, targetUser.user_id);
            
            // Then notify the target user about incoming call
            socket.emit('webrtc:initiate-call', {
                conversationId: activeConversation.conversation_id,
                targetUserId: targetUser.user_id,
                callType: callType,
                callerName: user.displayName || user.username
            });
        }
    };

    if (loading) {
        return (
            <div className="chat-loading">
                <div className="loading-spinner"></div>
                <p>Loading conversations...</p>
            </div>
        );
    }

    return (
        <div className="chat-page">
            <div className="chat-container">
                <ChatSidebar
                    conversations={conversations}
                    activeConversation={activeConversation}
                    onSelectConversation={selectConversation}
                    onNewChat={() => setShowNewChat(true)}
                    user={user}
                />
                
                <ChatWindow
                    conversation={activeConversation}
                    messages={messages}
                    onSendMessage={sendMessage}
                    onInitiateCall={initiateCall}
                    user={user}
                    socket={socket}
                />
            </div>

            {/* Call Modals */}
            {incomingCall && (
                <CallModal
                    call={incomingCall}
                    onAnswer={() => answerCall(true)}
                    onDecline={() => declineCall()}
                />
            )}

            {currentCall && (localStream || remoteStream) && (
                <VideoCallWindow
                    call={currentCall}
                    localStream={localStream}
                    remoteStream={remoteStream}
                    onEndCall={endCall}
                    user={user}
                    socket={socket}
                />
            )}

            {/* Connection status */}
            {!isConnected && (
                <div className="connection-status offline">
                    <span>🔴 Disconnected</span>
                </div>
            )}
        </div>
    );
};

export default ChatPage;
