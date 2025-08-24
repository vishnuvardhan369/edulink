import React from 'react';
import { auth } from '../App';

export default function NotificationsPage({ currentUserData, navigateToProfile, navigateToHome, onUpdate }) {
    const [requests, setRequests] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const requestIds = currentUserData.connectionRequestsReceived || [];

    React.useEffect(() => {
        const fetchRequestingUsers = async () => {
            if (requestIds.length === 0) {
                setLoading(false);
                return;
            }
            try {
                const response = await fetch('https://edulink-g0gqgxhhezfjbzg4.southindia-01.azurewebsites.net/api/users/notifications', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userIds: requestIds })
                });
                const data = await response.json();
                setRequests(data);
            } catch (error) {
                console.error("Failed to fetch notifications", error);
            } finally {
                setLoading(false);
            }
        };
        fetchRequestingUsers();
    }, [currentUserData]); // Re-fetch when current user data changes

    const handleConnection = async (action, senderId) => {
        try {
            const response = await fetch(`https://edulink-g0gqgxhhezfjbzg4.southindia-01.azurewebsites.net/api/users/${senderId}/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentUserId: auth.currentUser.uid })
            });
            if (!response.ok) throw new Error(`Failed to ${action} request.`);
            
            // Refresh the current user's data to update the notification list
            onUpdate();

        } catch (error) {
            alert(error.message);
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '700px', margin: 'auto' }}>
            <button onClick={navigateToHome}>&larr; Back to Home</button>
            <h2 style={{marginTop: '20px'}}>Notifications</h2>
            
            {loading && <p>Loading notifications...</p>}
            
            {!loading && requests.length === 0 && <p>You have no new notifications.</p>}

            <div>
                {requests.map(user => (
                    <div key={user.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee' }}>
                        <div onClick={() => navigateToProfile(user.id)} style={{ display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer' }}>
                            <img src={user.profilePictureUrl} alt={user.displayName} style={{ width: 50, height: 50, borderRadius: '50%' }} />
                            <div>
                                <p style={{ margin: 0 }}><strong>{user.displayName}</strong> wants to connect with you.</p>
                            </div>
                        </div>
                        <div style={{display: 'flex', gap: '10px'}}>
                            <button onClick={() => handleConnection('accept-connect', user.id)} style={{padding: '8px 12px', background: '#e7f3ff', color: '#1877f2', border: 'none', borderRadius: '4px'}}>Accept</button>
                            <button onClick={() => handleConnection('cancel-request', user.id)} style={{padding: '8px 12px'}}>Decline</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
