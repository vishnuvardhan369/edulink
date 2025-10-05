import React from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../App';
import { apiCall } from '../config/api';

export default function NotificationsPage({ currentUserData, onUpdate }) {
    const navigate = useNavigate();
    const [notifications, setNotifications] = React.useState([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const response = await apiCall(`/api/notifications/${auth.currentUser.uid}`, {
                    method: 'GET',
                    credentials: 'include'
                });
                
                if (response.ok) {
                    const data = await response.json();
                    setNotifications(data);
                } else {
                    console.error("Failed to fetch notifications");
                }
            } catch (error) {
                console.error("Failed to fetch notifications", error);
            } finally {
                setLoading(false);
            }
        };
        
        if (auth.currentUser) {
            fetchNotifications();
        }
    }, [currentUserData]);

    const handleConnection = async (action, senderId) => {
        try {
            const response = await apiCall(`/api/users/${senderId}/${action}`, {
                method: 'POST',
                credentials: 'include',
                body: JSON.stringify({ currentUserId: auth.currentUser.uid })
            });
            if (!response.ok) throw new Error(`Failed to ${action} request.`);
            
            // Refresh notifications and user data
            const notificationsResponse = await apiCall(`/api/notifications/${auth.currentUser.uid}`, {
                method: 'GET',
                credentials: 'include'
            });
            
            if (notificationsResponse.ok) {
                const data = await notificationsResponse.json();
                setNotifications(data);
            }
            
            onUpdate();

        } catch (error) {
            alert(error.message);
        }
    };

    const markAsRead = async (notificationId) => {
        try {
            await apiCall(`/api/notifications/${notificationId}/read`, {
                method: 'PATCH',
                credentials: 'include',
                body: JSON.stringify({ userId: auth.currentUser.uid })
            });
            
            // Update local state
            setNotifications(prev => 
                prev.map(notif => 
                    notif.notification_id === notificationId 
                        ? { ...notif, is_read: true }
                        : notif
                )
            );
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '700px', margin: 'auto' }}>
            <button onClick={() => navigate('/')}>&larr; Back to Home</button>
            <h2 style={{marginTop: '20px'}}>Notifications</h2>
            
            {loading && <p>Loading notifications...</p>}
            
            {!loading && notifications.length === 0 && <p>You have no new notifications.</p>}

            <div>
                {notifications.map(notification => (
                    <div 
                        key={notification.notification_id} 
                        style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            padding: '15px', 
                            borderBottom: '1px solid #eee',
                            backgroundColor: notification.is_read ? 'transparent' : '#f8f9fa',
                            borderLeft: notification.is_read ? 'none' : '4px solid #007bff'
                        }}
                    >
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                                {notification.fromUserProfilePicture && (
                                    <img 
                                        src={notification.fromUserProfilePicture} 
                                        alt={notification.fromUserName}
                                        style={{ width: 40, height: 40, borderRadius: '50%' }}
                                    />
                                )}
                                <div>
                                    <strong>{notification.title}</strong>
                                    <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                                        {notification.message}
                                    </p>
                                    <small style={{ color: '#999' }}>
                                        {new Date(notification.created_at).toLocaleString()}
                                    </small>
                                </div>
                            </div>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            {notification.type === 'connection_request' && (
                                <>
                                    <button 
                                        onClick={() => handleConnection('accept-connect', notification.related_user_id)}
                                        style={{ padding: '8px 12px', background: '#e7f3ff', color: '#1877f2', border: 'none', borderRadius: '4px' }}
                                    >
                                        Accept
                                    </button>
                                    <button 
                                        onClick={() => handleConnection('reject-request', notification.related_user_id)}
                                        style={{ padding: '8px 12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px' }}
                                    >
                                        Reject
                                    </button>
                                </>
                            )}
                            
                            {!notification.is_read && (
                                <button 
                                    onClick={() => markAsRead(notification.notification_id)}
                                    style={{ 
                                        padding: '3px 8px', 
                                        backgroundColor: '#6c757d', 
                                        color: 'white', 
                                        border: 'none', 
                                        borderRadius: '4px',
                                        fontSize: '12px'
                                    }}
                                >
                                    Mark Read
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
