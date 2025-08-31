import React from 'react';

export default function ChatPage({ chatId, navigateToChatList }) {
    return (
        <div style={{ padding: '20px', maxWidth: '700px', margin: 'auto', textAlign: 'center' }}>
            <button onClick={navigateToChatList}>&larr; Back to Messages</button>
            
            <div style={{ marginTop: '50px' }}>
                <h2>💬 Chat Feature</h2>
                <p style={{ fontSize: '18px', color: '#666', marginTop: '20px' }}>
                    Chat functionality is coming soon!
                </p>
                <p style={{ color: '#888' }}>
                    We're working on bringing you real-time messaging features.
                </p>
            </div>
        </div>
    );
}
