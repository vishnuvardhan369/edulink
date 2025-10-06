import { useState, useEffect, useRef, useCallback } from 'react';
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
    const hasAutoSelected = useRef(false);
    useEffect(() => {
        if (conversationId && conversations.length > 0 && !hasAutoSelected.current) {
            const conversation = conversations.find(c => c.conversation_id === conversationId);
            if (conversation && (!activeConversation || activeConversation.conversation_id !== conversationId)) {
                hasAutoSelected.current = true;
                selectConversation(conversation);
            }
        }
    }, [conversationId, conversations, activeConversation]);

    // Reset auto-select ref when conversationId changes
    useEffect(() => {
        hasAutoSelected.current = false;
    }, [conversationId]);

    // Auto-answer pending call when conversation is loaded
    useEffect(() => {
        if (pendingCall && activeConversation && incomingCall) {
            console.log('📞 Auto-answering pending call');
            console.log('- pendingCall:', pendingCall);
            console.log('- activeConversation:', activeConversation.conversation_id);
            console.log('- incomingCall:', incomingCall);
            
            if (pendingCall.conversationId === activeConversation.conversation_id) {
                // Answer immediately without delay
                console.log('✅ Calling answerCall() immediately');
                answerCall();
            }
        }
    }, [pendingCall, activeConversation, incomingCall, answerCall]);

    const loadConversations = useCallback(async () => {
        if (!user || !user.id) {
            console.warn('⚠️ Cannot load conversations - user not available');
            setLoading(false);
            return;
        }
        try {
            console.log('📥 Loading conversations for user:', user.id);
            const response = await apiCall(`/api/chats?userId=${user.id}`);
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Loaded conversations:', data.length);
                console.log('📋 Conversations data:', data);
                setConversations(data || []);
            } else {
                const errorText = await response.text();
                console.error('❌ Failed to load conversations, status:', response.status, errorText);
                setConversations([]);
            }
        } catch (error) {
            console.error('❌ Error loading conversations:', error);
            setConversations([]);
        } finally {
            setLoading(false);
        }
    }, [user]);

    const loadMessages = useCallback(async (conversationId) => {
        if (!conversationId || !user) return;
        try {
            console.log('📩 Loading messages for conversation:', conversationId);
            const response = await apiCall(
                `/api/chats/${conversationId}/messages?userId=${user.id}&limit=50`
            );
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Messages loaded:', data.length, 'messages');
                setMessages(data);
            } else {
                console.error('❌ Failed to load messages, status:', response.status);
                setMessages([]);
            }
        } catch (error) {
            console.error('❌ Error loading messages:', error);
            setMessages([]);
        }
    }, [user]);

    const handleNewMessage = (message) => {
        console.log('📨 Received new message:', message);
        
        if (activeConversation && message.conversation_id === activeConversation.conversation_id) {
            setMessages(prev => {
                // Check for duplicates
                const exists = prev.some(msg => msg.message_id === message.message_id);
                if (exists) {
                    console.log('⚠️ Duplicate message detected, skipping:', message.message_id);
                    return prev;
                }
                
                // Remove any temporary message from the same sender with similar text
                const withoutTemp = prev.filter(msg => {
                    if (msg.is_temp && msg.sender_id === message.sender_id) {
                        // Check if the message text matches (temp message being replaced by real one)
                        const timeDiff = new Date(message.created_at) - new Date(msg.created_at);
                        if (msg.message_text === message.message_text && timeDiff < 5000) {
                            console.log('🔄 Replacing temp message with real one');
                            return false;
                        }
                    }
                    return true;
                });
                
                return [...withoutTemp, message];
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

        console.log('📤 Sending message:', messageData);
        
        // Optimistically add message to UI immediately
        const tempMessage = {
            message_id: `temp-${Date.now()}`,
            conversation_id: activeConversation.conversation_id,
            sender_id: user.id,
            sender_username: user.username,
            sender_display_name: user.displayName || user.username,
            message_text: messageText,
            message_type: messageType,
            file_url: fileUrl,
            file_name: fileName,
            created_at: new Date().toISOString(),
            is_temp: true // Mark as temporary
        };
        
        setMessages(prev => [...prev, tempMessage]);
        
        socket.emit('message:send', messageData);
    };

    const selectConversation = async (conversation) => {
        // Mark current messages as read before switching
        if (activeConversation) {
            await markMessagesAsRead(activeConversation.conversation_id);
            // Leave previous conversation room
            if (socket) {
                socket.emit('conversation:leave', activeConversation.conversation_id);
            }
        }
        
        // Clear messages and set new conversation
        setMessages([]);
        setActiveConversation(conversation);
        
        // Join new conversation room
        if (socket) {
            console.log('🚪 Joining conversation room:', conversation.conversation_id);
            socket.emit('conversation:join', conversation.conversation_id);
        }
        
        // Load new messages
        await loadMessages(conversation.conversation_id);
    };

    const markMessagesAsRead = async (conversationId) => {
        try {
            // Get the last message ID from current messages state
            const lastMessageId = messages.length > 0 ? messages[messages.length - 1]?.message_id : null;
            
            const response = await apiCall(`/api/chats/${conversationId}/read`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId: user.id,
                    lastReadMessageId: lastMessageId
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
