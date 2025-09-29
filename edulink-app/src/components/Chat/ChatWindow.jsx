import { useState, useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import TypingIndicator from './TypingIndicator';
import './ChatWindow.css';

const ChatWindow = ({ 
    conversation, 
    messages, 
    onSendMessage, 
    onInitiateCall, 
    user, 
    socket 
}) => {
    const [typingUsers, setTypingUsers] = useState([]);
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (!socket || !conversation) return;

        socket.on('typing:user_start', handleTypingStart);
        socket.on('typing:user_stop', handleTypingStop);

        return () => {
            socket.off('typing:user_start');
            socket.off('typing:user_stop');
        };
    }, [socket, conversation]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleTypingStart = (data) => {
        if (data.conversationId === conversation.conversation_id && data.userId !== user.id) {
            setTypingUsers(prev => {
                if (!prev.find(u => u.userId === data.userId)) {
                    return [...prev, { userId: data.userId, username: data.username }];
                }
                return prev;
            });
        }
    };

    const handleTypingStop = (data) => {
        if (data.conversationId === conversation.conversation_id) {
            setTypingUsers(prev => prev.filter(u => u.userId !== data.userId));
        }
    };

    const handleInputFocus = () => {
        if (socket && conversation) {
            socket.emit('typing:start', {
                conversationId: conversation.conversation_id,
                userId: user.id,
                username: user.username
            });
        }
    };

    const handleInputBlur = () => {
        if (socket && conversation) {
            socket.emit('typing:stop', {
                conversationId: conversation.conversation_id,
                userId: user.id
            });
        }
    };

    const handleInputChange = () => {
        if (socket && conversation) {
            // Clear existing timeout
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }

            // Start typing
            socket.emit('typing:start', {
                conversationId: conversation.conversation_id,
                userId: user.id,
                username: user.username
            });

            // Stop typing after 3 seconds of no input
            typingTimeoutRef.current = setTimeout(() => {
                socket.emit('typing:stop', {
                    conversationId: conversation.conversation_id,
                    userId: user.id
                });
            }, 3000);
        }
    };

    const getConversationName = () => {
        if (!conversation) return '';
        
        if (conversation.name) {
            return conversation.name;
        }
        
        const otherParticipant = conversation.participants?.find(p => p.user_id !== user.id);
        return otherParticipant?.full_name || otherParticipant?.username || 'Unknown User';
    };

    const getOnlineStatus = () => {
        if (!conversation || conversation.type === 'group') return null;
        
        const otherParticipant = conversation.participants?.find(p => p.user_id !== user.id);
        return otherParticipant?.status || 'offline';
    };

    const getParticipantCount = () => {
        if (!conversation || conversation.type !== 'group') return null;
        return conversation.participants?.length || 0;
    };

    if (!conversation) {
        return (
            <div className="chat-window empty">
                <div className="empty-state">
                    <div className="empty-icon">💬</div>
                    <h3>Welcome to EduLink Chat</h3>
                    <p>Select a conversation to start messaging</p>
                </div>
            </div>
        );
    }

    return (
        <div className="chat-window">
            <div className="chat-header">
                <div className="chat-info">
                    <div className="chat-avatar">
                        <div className="avatar-circle">
                            {conversation.type === 'group' ? '👥' : '👤'}
                        </div>
                        {getOnlineStatus() === 'online' && (
                            <div className="online-indicator"></div>
                        )}
                    </div>
                    
                    <div className="chat-details">
                        <h3 className="chat-name">{getConversationName()}</h3>
                        <span className="chat-status">
                            {conversation.type === 'group' ? (
                                `${getParticipantCount()} participants`
                            ) : (
                                getOnlineStatus() === 'online' ? 'Online' : 'Offline'
                            )}
                        </span>
                    </div>
                </div>
                
                <div className="chat-actions">
                    <button 
                        className="action-button"
                        onClick={() => onInitiateCall('audio')}
                        title="Audio call"
                        disabled={conversation.type === 'group'}
                    >
                        📞
                    </button>
                    <button 
                        className="action-button"
                        onClick={() => onInitiateCall('video')}
                        title="Video call"
                        disabled={conversation.type === 'group'}
                    >
                        📹
                    </button>
                    <button 
                        className="action-button"
                        onClick={() => onInitiateCall('screen')}
                        title="Screen share"
                        disabled={conversation.type === 'group'}
                    >
                        🖥️
                    </button>
                </div>
            </div>
            
            <div className="messages-container">
                <div className="messages-list">
                    {messages.length === 0 ? (
                        <div className="no-messages">
                            <p>No messages yet. Start the conversation!</p>
                        </div>
                    ) : (
                        messages.map((message, index) => {
                            const showDate = index === 0 || 
                                new Date(messages[index - 1].created_at).toDateString() !== 
                                new Date(message.created_at).toDateString();
                                
                            return (
                                <div key={message.message_id}>
                                    {showDate && (
                                        <div className="date-separator">
                                            <span>{new Date(message.created_at).toLocaleDateString()}</span>
                                        </div>
                                    )}
                                    <MessageBubble
                                        message={message}
                                        isOwn={message.sender_id === user.id}
                                        user={user}
                                        socket={socket}
                                    />
                                </div>
                            );
                        })
                    )}
                    
                    {typingUsers.length > 0 && (
                        <TypingIndicator users={typingUsers} />
                    )}
                    
                    <div ref={messagesEndRef} />
                </div>
            </div>
            
            <ChatInput
                onSendMessage={onSendMessage}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                onChange={handleInputChange}
                disabled={!conversation}
            />
        </div>
    );
};

export default ChatWindow;