import React from 'react';
import { io } from 'socket.io-client';
import { auth } from '../App';

// This should be a single, shared instance in a real app
const socket = io('http://localhost:4000');

export default function ChatPage({ chatId, navigateToChatList }) {
    const [messages, setMessages] = React.useState([]);
    const [newMessage, setNewMessage] = React.useState('');
    const [loading, setLoading] = React.useState(true);
    const currentUser = auth.currentUser;
    const messagesEndRef = React.useRef(null);

    // Effect for fetching initial message history
    React.useEffect(() => {
        const fetchMessages = async () => {
            try {
                const response = await fetch(`http://localhost:4000/api/chats/${chatId}/messages`);
                const data = await response.json();
                setMessages(data);
            } catch (error) {
                console.error("Failed to fetch messages", error);
            } finally {
                setLoading(false);
            }
        };
        fetchMessages();
    }, [chatId]);

    // Effect for handling real-time messages with Socket.IO
    React.useEffect(() => {
        // Join a room for this user to receive private messages
        socket.emit('join_room', currentUser.uid);

        const handleReceiveMessage = (message) => {
            // Only add the message if it belongs to the current chat
            if (message.chatId === chatId) {
                setMessages(prevMessages => [...prevMessages, message]);
            }
        };

        socket.on('receive_message', handleReceiveMessage);

        // Clean up the listener when the component unmounts
        return () => {
            socket.off('receive_message', handleReceiveMessage);
        };
    }, [chatId, currentUser.uid]);
    
    // Effect for auto-scrolling to the bottom
    React.useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        const chatParticipants = chatId.split('_');
        const recipientId = chatParticipants.find(id => id !== currentUser.uid);

        const messageData = {
            chatId: chatId,
            senderId: currentUser.uid,
            recipientId: recipientId,
            text: newMessage,
        };

        socket.emit('private_message', messageData);
        setNewMessage('');
    };

    return (
        <div style={{ padding: '20px', maxWidth: '700px', margin: 'auto', display: 'flex', flexDirection: 'column', height: '90vh' }}>
            <button onClick={navigateToChatList}>&larr; All Chats</button>
            <h3 style={{textAlign: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px'}}>Chat</h3>
            
            <div style={{ flexGrow: 1, overflowY: 'auto', marginBottom: '10px', padding: '10px' }}>
                {loading && <p>Loading messages...</p>}
                {messages.map((msg, index) => (
                    <div key={index} style={{
                        textAlign: msg.senderId === currentUser.uid ? 'right' : 'left',
                        marginBottom: '10px'
                    }}>
                        <p style={{
                            display: 'inline-block',
                            padding: '8px 12px',
                            borderRadius: '15px',
                            background: msg.senderId === currentUser.uid ? '#0084ff' : '#e4e6eb',
                            color: msg.senderId === currentUser.uid ? 'white' : 'black',
                            maxWidth: '70%'
                        }}>
                            {msg.text}
                        </p>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '10px' }}>
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    style={{ flexGrow: 1, padding: '10px', borderRadius: '20px', border: '1px solid #ccc' }}
                />
                <button type="submit" style={{ padding: '10px 20px', borderRadius: '20px' }}>Send</button>
            </form>
        </div>
    );
}
