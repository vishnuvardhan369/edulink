import React from 'react';
import CreatePost from '../components/CreatePost';
import Post from '../components/Post';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../App';

// New component to show connection requests
function ConnectionRequests({ requests, navigateToProfile }) {
    const [requestingUsers, setRequestingUsers] = React.useState([]);

    React.useEffect(() => {
        const fetchUsers = async () => {
            if (!requests || requests.length === 0) {
                setRequestingUsers([]);
                return;
            }
            const userPromises = requests.map(uid => getDoc(doc(db, 'users', uid)));
            const userDocs = await Promise.all(userPromises);
            setRequestingUsers(userDocs.filter(doc => doc.exists()).map(doc => ({ id: doc.id, ...doc.data() })));
        };
        fetchUsers();
    }, [requests]);

    if (!requests || requests.length === 0) return null;

    return (
        <div style={{ border: '1px solid #ccc', padding: '15px', marginBottom: '20px', background: 'white', borderRadius: '8px' }}>
            <h4>Connection Requests</h4>
            {requestingUsers.map(user => (
                <div key={user.id} onClick={() => navigateToProfile(user.id)} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '5px 0' }}>
                    <img src={user.profilePictureUrl} alt={user.displayName} style={{ width: 40, height: 40, borderRadius: '50%' }} />
                    <span>{user.displayName} wants to connect.</span>
                </div>
            ))}
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
            const response = await fetch('https://edulink-g0gqgxhhezfjbzg4.southindia-01.azurewebsites.net/api/posts');
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
        <div style={{ padding: '20px', maxWidth: '700px', margin: 'auto', background: '#f0f2f5' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1>Home Feed</h1>
                <div>
                    <button onClick={navigateToNotifications} style={{ marginRight: '10px', position: 'relative' }}>
                        Notifications
                        {notificationCount > 0 && 
                            <span style={{
                                position: 'absolute', top: '-5px', right: '-5px', background: 'red', color: 'white',
                                borderRadius: '50%', width: '18px', height: '18px', fontSize: '12px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                {notificationCount}
                            </span>
                        }
                    </button>
                    <button onClick={navigateToSearch} style={{ marginRight: '10px' }}>Search</button>
                    <button onClick={() => navigateToProfile(userData.uid)} style={{ marginRight: '10px' }}>My Profile</button>
                    <button onClick={onSignOut}>Sign Out</button>
                </div>
            </div>
            
            <CreatePost onPostCreated={fetchPosts} />
            
            <hr style={{border: 'none', borderTop: '1px solid #ddd', margin: '30px 0'}}/>

            {loading && <p>Loading posts...</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}
            
            <div>
                {posts.map(post => (
                    <Post 
                        key={post.id} 
                        post={post} 
                        onPostUpdate={handlePostUpdate}
                        onPostDelete={handlePostDelete}
                        // **NEW**: Pass the navigation function down
                        navigateToProfile={navigateToProfile}
                    />
                ))}
            </div>
        </div>
    );
};
