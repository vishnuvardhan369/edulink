import { useState } from 'react';
import './ChatSidebar.css';

const ChatSidebar = ({ 
    conversations, 
    activeConversation, 
    onSelectConversation, 
    onNewChat, 
    user 
}) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredConversations = conversations.filter(conv => {
        if (!searchTerm) return true;
        
        const searchLower = searchTerm.toLowerCase();
        
        // Search by conversation name (for group chats)
        if (conv.name && conv.name.toLowerCase().includes(searchLower)) {
            return true;
        }
        
        // Search by participant names (for direct chats)
        return conv.participants?.some(participant => 
            participant.user_id !== user.id &&
            (participant.username?.toLowerCase().includes(searchLower) ||
             participant.full_name?.toLowerCase().includes(searchLower))
        );
    });

    const getConversationName = (conversation) => {
        if (conversation.name) {
            return conversation.name;
        }
        
        // For direct chats, show other participant's name
        const otherParticipant = conversation.participants?.find(p => p.user_id !== user.id);
        return otherParticipant?.full_name || otherParticipant?.username || 'Unknown User';
    };

    const getLastMessagePreview = (conversation) => {
        if (!conversation.last_message) return 'No messages yet';
        
        const message = conversation.last_message;
        const prefix = message.sender_id === user.id ? 'You: ' : '';
        
        if (message.message_type === 'text') {
            return prefix + message.message_text;
        } else if (message.message_type === 'image') {
            return prefix + '📷 Image';
        } else if (message.message_type === 'file') {
            return prefix + '📎 ' + (message.file_name || 'File');
        }
        
        return prefix + 'Message';
    };

    const formatLastMessageTime = (conversation) => {
        if (!conversation.updated_at) return '';
        
        const now = new Date();
        const messageTime = new Date(conversation.updated_at);
        const diffInHours = (now - messageTime) / (1000 * 60 * 60);
        
        if (diffInHours < 1) {
            const diffInMinutes = Math.floor(diffInHours * 60);
            return diffInMinutes < 1 ? 'Now' : `${diffInMinutes}m`;
        } else if (diffInHours < 24) {
            return `${Math.floor(diffInHours)}h`;
        } else {
            const diffInDays = Math.floor(diffInHours / 24);
            return diffInDays === 1 ? '1d' : `${diffInDays}d`;
        }
    };

    const getOnlineStatus = (conversation) => {
        if (conversation.type === 'group') return null;
        
        const otherParticipant = conversation.participants?.find(p => p.user_id !== user.id);
        return otherParticipant?.status || 'offline';
    };

    return (
        <div className="chat-sidebar">
            <div className="sidebar-header">
                <h2>Messages</h2>
                <button 
                    className="new-chat-button"
                    onClick={onNewChat}
                    title="Start new conversation"
                >
                    ✏️
                </button>
            </div>
            
            <div className="search-container">
                <input
                    type="text"
                    placeholder="Search conversations..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                />
            </div>
            
            <div className="conversations-list">
                {filteredConversations.length === 0 ? (
                    <div className="no-conversations">
                        {searchTerm ? 'No matching conversations' : 'No conversations yet'}
                        <button 
                            className="start-chat-button"
                            onClick={onNewChat}
                        >
                            Start a new chat
                        </button>
                    </div>
                ) : (
                    filteredConversations.map(conversation => {
                        const isActive = activeConversation?.conversation_id === conversation.conversation_id;
                        const onlineStatus = getOnlineStatus(conversation);
                        
                        return (
                            <div
                                key={conversation.conversation_id}
                                className={`conversation-item ${isActive ? 'active' : ''}`}
                                onClick={() => onSelectConversation(conversation)}
                            >
                                <div className="conversation-avatar">
                                    <div className="avatar-circle">
                                        {conversation.type === 'group' ? '👥' : '👤'}
                                    </div>
                                    {onlineStatus === 'online' && (
                                        <div className="online-indicator"></div>
                                    )}
                                </div>
                                
                                <div className="conversation-content">
                                    <div className="conversation-header">
                                        <span className="conversation-name">
                                            {getConversationName(conversation)}
                                        </span>
                                        <span className="last-message-time">
                                            {formatLastMessageTime(conversation)}
                                        </span>
                                    </div>
                                    
                                    <div className="conversation-preview">
                                        <span className="last-message">
                                            {getLastMessagePreview(conversation)}
                                        </span>
                                        {conversation.unread_count > 0 && (
                                            <span className="unread-badge">
                                                {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default ChatSidebar;