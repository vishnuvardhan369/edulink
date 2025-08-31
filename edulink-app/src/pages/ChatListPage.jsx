import React from 'react';
import { auth } from '../App';
import { apiCall } from '../config/api';

// Helper component to display a single chat conversation in the list
function ChatListItem({ chat, navigateToChat }) {
    const [otherUser, setOtherUser] = React.useState(null);
    const currentUser = auth.currentUser;

    React.useEffect(() => {
        const otherUserId = chat.participants.find(uid => uid !== currentUser.uid);
        if (otherUserId) {
            const fetchOtherUser = async () => {
                try {
                    const response = await apiCall(`/api/users/${otherUserId}`);
                    if (response.ok) {
                        const userData = await response.json();
                        setOtherUser(userData);
                    }
                } catch (error) {
                    console.error('Error fetching user:', error);
                }
            };
            fetchOtherUser();
        }
    }, [chat, currentUser.uid]);

    if (!otherUser) return <div>Loading conversation...</div>;

    const lastMessage = chat.messages[chat.messages.length - 1];

    return (
        <div onClick={() => navigateToChat(chat._id)} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '10px', cursor: 'pointer', borderBottom: '1px solid #eee' }}>
            <img src={otherUser.profilePictureUrl} alt={otherUser.displayName} style={{ width: 50, height: 50, borderRadius: '50%' }} />
            <div>
                <p style={{ margin: 0, fontWeight: 'bold' }}>{otherUser.displayName}</p>
                <p style={{ margin: 0, color: '#555', fontSize: '14px' }}>
                    {lastMessage ? `${lastMessage.text.substring(0, 30)}...` : 'No messages yet'}
                </p>
            </div>
        </div>
    );
}

export default function ChatListPage({ navigateToChat, navigateToHome }) {
    const [chats, setChats] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const currentUser = auth.currentUser;

    React.useEffect(() => {
        const fetchChats = async () => {
            try {
                const response = await apiCall(`/api/users/${currentUser.uid}/chats`);
                const data = await response.json();
                setChats(data);
            } catch (error) {
                console.error("Failed to fetch chats", error);
            } finally {
                setLoading(false);
            }
        };
        fetchChats();
    }, [currentUser.uid]);

    return (
        <div style={{ padding: '20px', maxWidth: '700px', margin: 'auto' }}>
            <button onClick={navigateToHome}>&larr; Back to Home</button>
            <h2 style={{marginTop: '20px'}}>Messages</h2>
            
            {loading && <p>Loading conversations...</p>}
            
            {!loading && chats.length === 0 && <p>You have no conversations. Find a user and send them a message!</p>}

            <div>
                {chats.map(chat => (
                    <ChatListItem key={chat._id} chat={chat} navigateToChat={navigateToChat} />
                ))}
            </div>
        </div>
    );
}
