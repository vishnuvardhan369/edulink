import { useState, useRef } from 'react';
import './MessageBubble.css';

const MessageBubble = ({ message, isOwn, user, socket }) => {
    const [showOptions, setShowOptions] = useState(false);
    const [reactions, setReactions] = useState(message.reactions || {});

    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    };

    const handleReaction = (emoji) => {
        if (!socket) return;

        socket.emit('message:react', {
            messageId: message.message_id,
            emoji,
            userId: user.id
        });

        // Optimistically update reactions
        setReactions(prev => {
            const newReactions = { ...prev };
            if (!newReactions[emoji]) {
                newReactions[emoji] = [];
            }
            
            const userIndex = newReactions[emoji].indexOf(user.id);
            if (userIndex > -1) {
                newReactions[emoji].splice(userIndex, 1);
                if (newReactions[emoji].length === 0) {
                    delete newReactions[emoji];
                }
            } else {
                newReactions[emoji].push(user.id);
            }
            
            return newReactions;
        });

        setShowOptions(false);
    };

    const renderMessageContent = () => {
        if (message.message_type === 'text') {
            return <div className="message-text">{message.message_text}</div>;
        } else if (message.message_type === 'image') {
            return (
                <div className="message-image">
                    <img 
                        src={message.file_url} 
                        alt="Shared image"
                        onLoad={() => {
                            // Scroll to bottom when image loads
                            const container = document.querySelector('.messages-container');
                            if (container) {
                                container.scrollTop = container.scrollHeight;
                            }
                        }}
                    />
                    {message.message_text && (
                        <div className="image-caption">{message.message_text}</div>
                    )}
                </div>
            );
        } else if (message.message_type === 'file') {
            return (
                <div className="message-file">
                    <div className="file-icon">📎</div>
                    <div className="file-info">
                        <a 
                            href={message.file_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="file-name"
                        >
                            {message.file_name}
                        </a>
                        {message.message_text && (
                            <div className="file-caption">{message.message_text}</div>
                        )}
                    </div>
                </div>
            );
        }
        
        return null;
    };

    const renderReactions = () => {
        if (Object.keys(reactions).length === 0) return null;

        return (
            <div className="message-reactions">
                {Object.entries(reactions).map(([emoji, userIds]) => (
                    <button
                        key={emoji}
                        className={`reaction ${userIds.includes(user.id) ? 'own-reaction' : ''}`}
                        onClick={() => handleReaction(emoji)}
                        title={`${userIds.length} reaction${userIds.length > 1 ? 's' : ''}`}
                    >
                        {emoji} {userIds.length > 1 && userIds.length}
                    </button>
                ))}
            </div>
        );
    };

    return (
        <div className={`message-bubble ${isOwn ? 'own-message' : 'other-message'}`}>
            <div className="message-content">
                {!isOwn && (
                    <div className="sender-name">{message.sender_name}</div>
                )}
                
                <div className="message-body">
                    {renderMessageContent()}
                    
                    <div className="message-meta">
                        <span className="message-time">{formatTime(message.created_at)}</span>
                        {isOwn && (
                            <span className="message-status">
                                {message.status === 'sent' && '✓'}
                                {message.status === 'delivered' && '✓✓'}
                                {message.status === 'read' && <span className="read-receipt">✓✓</span>}
                            </span>
                        )}
                    </div>
                </div>

                <button 
                    className="message-options-trigger"
                    onClick={() => setShowOptions(!showOptions)}
                >
                    ⋯
                </button>

                {showOptions && (
                    <div className="message-options">
                        <button onClick={() => handleReaction('👍')}>👍</button>
                        <button onClick={() => handleReaction('❤️')}>❤️</button>
                        <button onClick={() => handleReaction('😂')}>😂</button>
                        <button onClick={() => handleReaction('😮')}>😮</button>
                        <button onClick={() => handleReaction('😢')}>😢</button>
                        <button onClick={() => handleReaction('😡')}>😡</button>
                    </div>
                )}
            </div>

            {renderReactions()}
        </div>
    );
};

export default MessageBubble;