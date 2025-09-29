import { useState, useRef } from 'react';
import './ChatInput.css';
import { apiCall } from '../../config/api.js';

const ChatInput = ({ onSendMessage, onFocus, onBlur, onChange, disabled }) => {
    const [message, setMessage] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!message.trim() || disabled) return;

        onSendMessage(message.trim(), 'text');
        setMessage('');
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    const handleInputChange = (e) => {
        setMessage(e.target.value);
        onChange?.();
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('messageType', file.type.startsWith('image/') ? 'image' : 'file');

            const response = await apiCall('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const { fileUrl, fileName } = await response.json();
                const messageType = file.type.startsWith('image/') ? 'image' : 'file';
                
                onSendMessage('', messageType, fileUrl, fileName);
            } else {
                console.error('File upload failed');
                alert('Failed to upload file. Please try again.');
            }
        } catch (error) {
            console.error('File upload error:', error);
            alert('Failed to upload file. Please try again.');
        } finally {
            setIsUploading(false);
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    return (
        <div className="chat-input-container">
            <form onSubmit={handleSubmit} className="chat-input-form">
                <div className="input-actions">
                    <button
                        type="button"
                        className="attach-button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={disabled || isUploading}
                        title="Attach file"
                    >
                        {isUploading ? '⏳' : '📎'}
                    </button>
                    
                    <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileSelect}
                        style={{ display: 'none' }}
                        accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt,.zip,.rar"
                    />
                </div>

                <div className="input-wrapper">
                    <textarea
                        value={message}
                        onChange={handleInputChange}
                        onKeyPress={handleKeyPress}
                        onFocus={onFocus}
                        onBlur={onBlur}
                        placeholder={disabled ? "Select a conversation to start messaging" : "Type a message..."}
                        disabled={disabled}
                        className="message-input"
                        rows={1}
                        style={{
                            minHeight: '20px',
                            maxHeight: '100px',
                            resize: 'none',
                            overflow: 'hidden'
                        }}
                        onInput={(e) => {
                            // Auto-resize textarea
                            e.target.style.height = '20px';
                            e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                    />
                </div>

                <div className="send-actions">
                    <button
                        type="submit"
                        className="send-button"
                        disabled={!message.trim() || disabled || isUploading}
                        title="Send message"
                    >
                        {isUploading ? '⏳' : '➤'}
                    </button>
                </div>
            </form>

            {isUploading && (
                <div className="upload-progress">
                    Uploading file...
                </div>
            )}
        </div>
    );
};

export default ChatInput;