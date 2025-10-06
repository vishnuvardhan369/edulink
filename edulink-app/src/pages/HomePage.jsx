import React from 'react';
import { useNavigate } from 'react-router-dom';
import CreateContent from '../components/CreateContent';
import Post from '../components/Post';
import Poll from '../components/Poll';
import RandomMeet from '../components/RandomMeet';
import { apiCall } from '../config/api';
import { auth } from '../App';

// New component to show connection requests
function ConnectionRequests({ requests }) {
    const [requestingUsers, setRequestingUsers] = React.useState([]);
    const navigate = useNavigate();

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
                    Connection Requests
                </h3>
            </div>
            <div className="card-body">
                {requestingUsers.map(user => (
                    <div key={user.id} 
                         onClick={() => navigate(`/profile/${user.id}`)} 
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

export default function HomePage({ userData, onSignOut }) {
    const navigate = useNavigate();
    const [feedItems, setFeedItems] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [feedFilter, setFeedFilter] = React.useState('all'); // 'all', 'posts', 'polls'

    const fetchFeed = async () => {
        if (feedItems.length === 0) setLoading(true); 
        try {
            const response = await apiCall(`/api/feed?type=${feedFilter}`);
            if (!response.ok) throw new Error('Failed to fetch feed from server.');
            const data = await response.json();
            setFeedItems(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };
    
    const handleContentUpdate = () => {
        fetchFeed();
    };

    const handlePostUpdate = (updatedPost) => {
        setFeedItems(currentItems => 
            currentItems.map(item => 
                item.type === 'post' && item.id === updatedPost.id ? updatedPost : item
            )
        );
    };

    const handlePostDelete = (deletedPostId) => {
        setFeedItems(currentItems => 
            currentItems.filter(item => 
                !(item.type === 'post' && item.id === deletedPostId)
            )
        );
    };

    const handlePollUpdate = () => {
        fetchFeed();
    };

    React.useEffect(() => {
        fetchFeed();
    }, [feedFilter]);

    const notificationCount = (userData.connectionRequestsReceived || []).length;

    return (
        <div className="edulink-app">
            {/* Modern Navigation Bar */}
            <nav className="navbar">
                <div className="navbar-content">
                    <a href="#" className="navbar-brand">EduLink</a>
                    <div className="navbar-nav">
                        <button 
                            onClick={() => navigate('/notifications')} 
                            className="btn btn-secondary notification-button"
                        >
                            Notifications
                            {notificationCount > 0 && 
                                <span className="notification-badge">
                                    {notificationCount}
                                </span>
                            }
                        </button>
                        <button onClick={() => navigate('/search')} className="btn btn-secondary">
                            Search
                        </button>
                        <button onClick={() => navigate('/roadmap')} className="btn btn-secondary">
                            🗺️ AI Roadmap
                        </button>
                        <button onClick={() => navigate('/chat')} className="btn btn-secondary">
                            💬 Messages
                        </button>
                        <button onClick={() => navigate(`/profile/${auth.currentUser.uid}`)} className="btn btn-secondary">
                            My Profile
                        </button>
                        <button onClick={onSignOut} className="btn btn-outline">
                            Sign Out
                        </button>
                    </div>
                </div>
            </nav>

            {/* Main Content Area */}
            <div className="content-area" style={{ padding: 'var(--spacing-lg)', maxWidth: '680px', margin: '0 auto' }}>
                {/* Connection Requests */}
                <ConnectionRequests 
                    requests={userData.connectionRequestsReceived || []} 
                />
                
                {/* Create Content Section */}
                <div className="card fade-in" style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <div className="card-body">
                        <CreateContent onContentCreated={handleContentUpdate} />
                    </div>
                </div>

                {/* Feed Filter */}
                <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <div className="card-body">
                        <div className="feed-filters" style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'center' }}>
                            <button 
                                className={`btn ${feedFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setFeedFilter('all')}
                                style={{ flex: 1 }}
                            >
                                All
                            </button>
                            <button 
                                className={`btn ${feedFilter === 'posts' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setFeedFilter('posts')}
                                style={{ flex: 1 }}
                            >
                                Posts
                            </button>
                            <button 
                                className={`btn ${feedFilter === 'polls' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setFeedFilter('polls')}
                                style={{ flex: 1 }}
                            >
                                Polls
                            </button>
                        </div>
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
                
                {/* Feed Items */}
                <div className="feed">
                    {feedItems.map((item, index) => (
                        <div key={`${item.type}-${item.id}`} className="fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                            {item.type === 'post' ? (
                                <Post 
                                    post={item} 
                                    onPostUpdate={handlePostUpdate}
                                    onPostDelete={handlePostDelete}
                                />
                            ) : (
                                <Poll 
                                    poll={item} 
                                    onPollUpdate={handlePollUpdate}
                                />
                            )}
                        </div>
                    ))}
                    
                    {feedItems.length === 0 && !loading && (
                        <div className="card text-center">
                            <div className="card-body">
                                <h3 style={{ color: 'var(--text-secondary)', margin: 0 }}>
                                    {feedFilter === 'all' ? 'No content yet' : 
                                     feedFilter === 'posts' ? 'No posts yet' : 'No polls yet'}
                                </h3>
                                <p style={{ color: 'var(--text-secondary)', margin: 'var(--spacing-sm) 0 0 0' }}>
                                    {feedFilter === 'all' ? 'Be the first to share something!' :
                                     feedFilter === 'posts' ? 'Create your first post!' : 'Create your first poll!'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Random Meet Dice Button - Fixed at bottom right */}
            <RandomMeet />
        </div>
    );
};
