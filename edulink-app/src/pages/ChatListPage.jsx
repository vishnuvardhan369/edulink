import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { apiCall } from '../config/api';
import './ChatListPage.css';

const ChatListPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [conversations, setConversations] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [searchLoading, setSearchLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('chats'); // 'chats' or 'search'

    useEffect(() => {
        if (user) {
            loadConversations();
        }
    }, [user]);

    useEffect(() => {
        if (searchTerm.trim() && activeTab === 'search') {
            searchUsers();
        } else {
            setSearchResults([]);
        }
    }, [searchTerm, activeTab]);

    const loadConversations = async () => {
        try {
            if (!user || !user.id) {
                console.warn('⚠️ Cannot load conversations - user not available');
                setLoading(false);
                return;
            }
            
            console.log('📥 Loading conversations for user:', user.id);
            const response = await apiCall(`/api/chats?userId=${user.id}`);
            console.log('📡 API Response status:', response.status, response.ok);
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Loaded conversations:', data.length, 'conversations');
                console.log('📋 Conversations data:', data);
                setConversations(data || []);
            } else {
                const errorText = await response.text();
                console.error('❌ Failed to load conversations:', response.status, errorText);
                setConversations([]);
            }
        } catch (error) {
            console.error('💥 Error loading conversations:', error);
            setConversations([]);
        } finally {
            setLoading(false);
        }
    };



    const searchUsers = async () => {
        if (!searchTerm.trim()) return;
        
        setSearchLoading(true);
        try {
            // Search for users by username or display name
            const response = await apiCall(`/api/users/search?query=${encodeURIComponent(searchTerm.trim())}`);
            if (response.ok) {
                const users = await response.json();
                // Filter out current user from results
                const filteredUsers = users.filter(u => u.id !== user.id);
                setSearchResults(filteredUsers);
            } else {
                setSearchResults([]);
            }
        } catch (error) {
            console.error('Error searching users:', error);
            setSearchResults([]);
        } finally {
            setSearchLoading(false);
        }
    };

    const startConversation = async (targetUser) => {
        try {
            // Check if conversation already exists
            const existingConv = conversations.find(conv => 
                conv.type === 'direct' && 
                conv.participants.some(p => p.user_id === targetUser.id)
            );

            if (existingConv) {
                // Navigate to existing conversation
                navigate(`/chat/${existingConv.conversation_id}`);
                return;
            }

            // Create new conversation
            const response = await apiCall('/api/chats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    createdBy: user.id,
                    type: 'direct',
                    participants: [user.id, targetUser.id]
                })
            });

            if (response.ok) {
                const newConversation = await response.json();
                navigate(`/chat/${newConversation.conversation_id}`);
                // Refresh conversations list
                loadConversations();
            }
        } catch (error) {
            console.error('Error starting conversation:', error);
        }
    };

    const getConversationName = (conversation) => {
        if (conversation.name) return conversation.name;
        
        // Handle null or undefined participants
        if (!conversation.participants || !Array.isArray(conversation.participants)) {
            console.warn('⚠️ Conversation missing participants array:', {
                id: conversation.conversation_id,
                participants: conversation.participants
            });
            return 'Unknown User';
        }
        
        // Handle empty participants array
        if (conversation.participants.length === 0) {
            console.warn('⚠️ Empty participants array:', conversation.conversation_id);
            return 'Unknown User';
        }
        
        const otherParticipant = conversation.participants.find(p => p.user_id !== user.id);
        
        if (!otherParticipant) {
            console.warn('⚠️ No other participant found:', {
                id: conversation.conversation_id,
                participants: conversation.participants.map(p => ({ id: p.user_id, name: p.username })),
                currentUser: user.id
            });
            return 'Unknown User';
        }
        
        return otherParticipant.display_name || otherParticipant.full_name || otherParticipant.username || 'Unknown User';
    };

    const getLastMessagePreview = (conversation) => {
        if (!conversation.last_message) return 'No messages yet';
        
        const message = conversation.last_message;
        const prefix = message.sender_id === user.id ? 'You: ' : '';
        
        if (message.message_type === 'text') {
            return prefix + message.message_text.substring(0, 50) + (message.message_text.length > 50 ? '...' : '');
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

    return (
        <div className="chat-list-page">
            <div className="chat-list-header">
                <button onClick={() => navigate('/')} className="back-button">
                    ← Back to Home
                </button>
                <h2>Messages</h2>
            </div>

            <div className="chat-tabs">
                <button
                    className={`tab-button ${activeTab === 'chats' ? 'active' : ''}`}
                    onClick={() => setActiveTab('chats')}
                >
                    Recent Chats
                </button>
                <button
                    className={`tab-button ${activeTab === 'search' ? 'active' : ''}`}
                    onClick={() => setActiveTab('search')}
                >
                    Find Users
                </button>
            </div>            <div className="search-container">
                <input
                    type="text"
                    placeholder={activeTab === 'search' ? "Search users by name..." : "Search conversations..."}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                />
            </div>

            <div className="chat-content">
                {activeTab === 'chats' && (
                    <div className="conversations-section">
                        {loading ? (
                            <div className="loading-state">Loading conversations...</div>
                        ) : conversations.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">💬</div>
                                <h3>No conversations yet</h3>
                                <p>Search for users to start chatting!</p>
                                <button 
                                    className="start-chat-button"
                                    onClick={() => setActiveTab('search')}
                                >
                                    Find Users
                                </button>
                            </div>
                        ) : (
                            <div className="conversations-list">
                                    {(() => {
                                        const filteredConvs = conversations.filter(conv => {
                                            if (!searchTerm) return true;
                                            const name = getConversationName(conv);
                                            const matches = name.toLowerCase().includes(searchTerm.toLowerCase());
                                            if (!matches) {
                                                console.log('🚫 Filtered out:', conv.conversation_id, 'name:', name, 'searchTerm:', searchTerm);
                                            }
                                            return matches;
                                        });
                                        console.log('🎯 Rendering conversations:', {
                                            total: conversations.length,
                                            filtered: filteredConvs.length,
                                            searchTerm,
                                            activeTab,
                                            conversationIds: filteredConvs.map(c => c.conversation_id)
                                        });
                                        
                                        if (filteredConvs.length === 0 && conversations.length > 0) {
                                            console.warn('⚠️ All conversations filtered out! Check getConversationName function');
                                        }
                                        
                                        return filteredConvs;
                                    })().map((conversation, index) => {
                                        const convName = getConversationName(conversation);
                                        console.log(`📋 Rendering conversation ${index + 1}:`, {
                                            id: conversation.conversation_id,
                                            name: convName,
                                            participants: conversation.participants
                                        });
                                        
                                        return (
                                            <div
                                                key={conversation.conversation_id}
                                                className="conversation-item"
                                                onClick={() => navigate(`/chat/${conversation.conversation_id}`)}
                                            >
                                                <div className="conversation-avatar">
                                                    <div className="avatar-circle">
                                                        {conversation.type === 'group' ? '👥' : '👤'}
                                                    </div>
                                                    {conversation.type === 'direct' && (
                                                        <div className="online-indicator"></div>
                                                    )}
                                                </div>
                                                <div className="conversation-content">
                                                    <div className="conversation-header">
                                                        <span className="conversation-name">
                                                            {convName}
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
                                }
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'search' && (
                    <div className="search-section">
                        {searchLoading ? (
                            <div className="loading-state">Searching users...</div>
                        ) : searchTerm.trim() === '' ? (
                            <div className="search-prompt">
                                <div className="search-icon">🔍</div>
                                <p>Type a username or name to search for users</p>
                            </div>
                        ) : searchResults.length === 0 ? (
                            <div className="no-results">
                                <div className="search-icon">😔</div>
                                <p>No users found for "{searchTerm}"</p>
                                <small>Try searching by username or display name</small>
                            </div>
                        ) : (
                            <div className="search-results">
                                {searchResults.map(searchUser => (
                                    <div
                                        key={searchUser.id}
                                        className="user-item"
                                        onClick={() => startConversation(searchUser)}
                                    >
                                        <div className="user-avatar">
                                            <div className="avatar-circle">👤</div>
                                        </div>
                                        <div className="user-info">
                                            <div className="user-name">
                                                {searchUser.displayName || searchUser.full_name}
                                            </div>
                                            <div className="user-username">
                                                @{searchUser.username}
                                            </div>
                                        </div>
                                        <div className="chat-action">
                                            <span className="chat-icon">💬</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
};

export default ChatListPage;
