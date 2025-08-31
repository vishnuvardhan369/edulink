import React from 'react';
import CreatePost from '../components/CreatePost';
import Post from '../components/Post';
import { apiCall } from '../config/api';
import { auth } from '../App';

// New component to show connection requests
function ConnectionRequests({ requests, navigateToProfile }) {
    const [requestingUsers, setRequestingUsers] = React.useState([]);

    React.useEffect(() => {
        const fetchUsers = async () => {
            if (!requests || requests.length === 0) {
                setRequestingUsers([]);
                return;
            }
            try {
                const response = await apiCall('/api/users/notifications', {
                    method: 'POST',
                    body: JSON.stringify({ userIds: requests })
                });
                if (response.ok) {
                    const users = await response.json();
                    setRequestingUsers(users);
                }
            } catch (error) {
                console.error('Error fetching requesting users:', error);
            }
        };
        fetchUsers();
    }, [requests]);

    if (!requests || requests.length === 0) return null;

    return (
        <div className="card fade-in">
            <div className="card-header">
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
                    🤝 Connection Requests
                </h3>
            </div>
            <div className="card-body">
                {requestingUsers.map(user => (
                    <div key={user.id} 
                         onClick={() => navigateToProfile(user.id)} 
                         className="d-flex align-items-center gap-3 mb-2"
                         style={{ 
                             cursor: 'pointer', 
                             padding: 'var(--spacing-sm)', 
                             borderRadius: 'var(--border-radius)',
                             transition: 'all 0.2s ease'
                         }}
                         onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--bg-hover)'}
                         onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}>
                        <div className="avatar">
                            <img src={user.profilePictureUrl} alt={user.displayName} className="avatar-img" />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-primary)' }}>
                                {user.displayName}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                                wants to connect
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function HomePage({ userData, onSignOut, navigateToProfile, navigateToSearch, navigateToNotifications }) {
    const [posts, setPosts] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');

    const fetchPosts = async () => {
        if (posts.length === 0) setLoading(true); 
        try {
            const response = await apiCall('/api/posts');
            if (!response.ok) throw new Error('Failed to fetch posts from server.');
            const data = await response.json();
            setPosts(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };
    
    const handlePostUpdate = (updatedPost) => {
        setPosts(currentPosts => 
            currentPosts.map(p => p.id === updatedPost.id ? updatedPost : p)
        );
    };

    const handlePostDelete = (deletedPostId) => {
        setPosts(currentPosts => 
            currentPosts.filter(p => p.id !== deletedPostId)
        );
    };

    React.useEffect(() => {
        fetchPosts();
    }, []);

    const notificationCount = (userData.connectionRequestsReceived || []).length;


    return (
        <div className="edulink-app">
            {/* Modern Navigation Bar */}
            <nav className="navbar">
                <div className="navbar-content">
                    <a href="#" className="navbar-brand">EduLink</a>
                    <div className="navbar-nav">
                        <button 
                            onClick={navigateToNotifications} 
                            className="btn btn-secondary notification-button"
                        >
                            🔔 Notifications
                            {notificationCount > 0 && 
                                <span className="notification-badge">
                                    {notificationCount}
                                </span>
                            }
                        </button>
                        <button onClick={navigateToSearch} className="btn btn-secondary">
                            🔍 Search
                        </button>
                        <button onClick={() => navigateToProfile(auth.currentUser.uid)} className="btn btn-secondary">
                            👤 My Profile
                        </button>
                        <button onClick={onSignOut} className="btn btn-outline">
                            🚪 Sign Out
                        </button>
                    </div>
                </div>
            </nav>

            {/* Main Content Area */}
            <div className="content-area" style={{ padding: 'var(--spacing-lg)', maxWidth: '680px', margin: '0 auto' }}>
                {/* Connection Requests */}
                <ConnectionRequests 
                    requests={userData.connectionRequestsReceived || []} 
                    navigateToProfile={navigateToProfile}
                />
                
                {/* Create Post Section */}
                <div className="card fade-in" style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <div className="card-body">
                        <CreatePost onPostCreated={fetchPosts} />
                    </div>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="loading">
                        <div className="spinner"></div>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="card" style={{ background: 'var(--error-color)', color: 'white', marginBottom: 'var(--spacing-lg)' }}>
                        <div className="card-body">
                            <strong>Error:</strong> {error}
                        </div>
                    </div>
                )}
                
                {/* Posts Feed */}
                <div className="posts-feed">
                    {posts.map((post, index) => (
                        <div key={post.id} className="fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                            <Post 
                                post={post} 
                                onPostUpdate={handlePostUpdate}
                                onPostDelete={handlePostDelete}
                                navigateToProfile={navigateToProfile}
                            />
                        </div>
                    ))}
                    
                    {posts.length === 0 && !loading && (
                        <div className="card text-center">
                            <div className="card-body">
                                <h3 style={{ color: 'var(--text-secondary)', margin: 0 }}>
                                    📝 No posts yet
                                </h3>
                                <p style={{ color: 'var(--text-secondary)', margin: 'var(--spacing-sm) 0 0 0' }}>
                                    Be the first to share something!
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
