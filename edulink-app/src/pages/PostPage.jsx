import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../App';
import { apiCall } from '../config/api';
import Post from '../components/Post';

export default function PostPage() {
    const { postId } = useParams();
    const navigate = useNavigate();
    const [user, setUser] = React.useState(null);
    const [post, setPost] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');

    // Listen for auth state changes
    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    React.useEffect(() => {
        const fetchPost = async () => {
            try {
                setLoading(true);
                const response = await apiCall(`/api/posts/${postId}`);
                if (response.ok) {
                    const postData = await response.json();
                    setPost(postData);
                    setError('');
                } else if (response.status === 404) {
                    setError('Post not found');
                } else {
                    setError('Failed to load post');
                }
            } catch (err) {
                console.error('Error fetching post:', err);
                setError('Network error - please try again');
            } finally {
                setLoading(false);
            }
        };

        if (postId) {
            fetchPost();
        }
    }, [postId]);

    const handlePostUpdate = (updatedPost) => {
        setPost(updatedPost);
    };

    const handlePostDelete = () => {
        navigate('/');
    };

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, var(--primary-50) 0%, var(--secondary-50) 100%)'
            }}>
                <div className="card" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                    <div className="spinner" style={{ margin: '0 auto var(--space-4) auto' }}></div>
                    <p style={{ color: 'var(--text-secondary)' }}>Loading post...</p>
                </div>
            </div>
        );
    }

    if (error || !post) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, var(--primary-50) 0%, var(--secondary-50) 100%)',
                padding: 'var(--space-4)'
            }}>
                <div className="card" style={{ maxWidth: '500px', textAlign: 'center' }}>
                    <div className="card-body">
                        <h2 style={{ 
                            color: 'var(--error-600)', 
                            marginBottom: 'var(--space-4)',
                            fontSize: 'var(--text-2xl)',
                            fontWeight: 'var(--font-bold)'
                        }}>
                            {error === 'Post not found' ? 'Post not found' : 'Unable to load post'}
                        </h2>
                        <p style={{ 
                            color: 'var(--text-secondary)', 
                            marginBottom: 'var(--space-6)',
                            fontSize: 'var(--text-base)'
                        }}>
                            {error === 'Post not found' 
                                ? "The post you're looking for doesn't exist or has been removed."
                                : "There was a problem loading this post. Please try again later."
                            }
                        </p>
                        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
                            <button 
                                onClick={() => navigate('/')}
                                className="btn btn-primary"
                            >
                                Go to Home
                            </button>
                            {error !== 'Post not found' && (
                                <button 
                                    onClick={() => window.location.reload()}
                                    className="btn btn-ghost"
                                >
                                    Try Again
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, var(--primary-50) 0%, var(--secondary-50) 100%)'
        }}>
            {/* Navigation Bar */}
            <nav style={{
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                borderBottom: '1px solid var(--border-light)',
                padding: 'var(--space-3) var(--space-4)',
                position: 'sticky',
                top: 0,
                zIndex: 1000
            }}>
                <div style={{
                    maxWidth: '1200px',
                    margin: '0 auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <button 
                        onClick={() => navigate('/')}
                        className="btn btn-ghost"
                        style={{ 
                            fontSize: 'var(--text-sm)',
                            fontWeight: 'var(--font-medium)'
                        }}
                    >
                        ← Back to EduLink
                    </button>
                    
                    <h1 style={{
                        fontSize: 'var(--text-xl)',
                        fontWeight: 'var(--font-bold)',
                        background: 'linear-gradient(135deg, var(--primary-600), var(--secondary-600))',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        margin: 0
                    }}>
                        EduLink
                    </h1>
                    
                    <div>
                        {user ? (
                            <button 
                                onClick={() => navigate('/')}
                                className="btn btn-primary"
                                style={{ fontSize: 'var(--text-sm)' }}
                            >
                                Go to Feed
                            </button>
                        ) : (
                            <button 
                                onClick={() => navigate('/')}
                                className="btn btn-primary"
                                style={{ fontSize: 'var(--text-sm)' }}
                            >
                                Join EduLink
                            </button>
                        )}
                    </div>
                </div>
            </nav>

            {/* Login Prompt for Non-Authenticated Users */}
            {!user && (
                <div style={{
                    background: 'var(--primary-600)',
                    color: 'white',
                    padding: 'var(--space-3)',
                    textAlign: 'center'
                }}>
                    <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>
                        <strong>Like this post?</strong> Join EduLink to like, comment, and connect with others!
                        <button 
                            onClick={() => navigate('/')}
                            style={{
                                marginLeft: 'var(--space-3)',
                                background: 'white',
                                color: 'var(--primary-600)',
                                border: 'none',
                                padding: 'var(--space-1) var(--space-3)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 'var(--text-sm)',
                                fontWeight: 'var(--font-medium)',
                                cursor: 'pointer'
                            }}
                        >
                            Sign Up Free
                        </button>
                    </p>
                </div>
            )}

            {/* Post Content */}
            <div style={{ 
                maxWidth: '680px', 
                margin: '0 auto',
                padding: 'var(--space-6) var(--space-4)'
            }}>
                <Post 
                    post={post}
                    onPostUpdate={handlePostUpdate}
                    onPostDelete={handlePostDelete}
                    isPublicView={!user}
                />
                
                {/* Call to Action for Non-Authenticated Users */}
                {!user && (
                    <div className="card" style={{ 
                        marginTop: 'var(--space-6)',
                        textAlign: 'center',
                        background: 'linear-gradient(135deg, var(--primary-50), var(--secondary-50))',
                        border: '2px solid var(--primary-200)'
                    }}>
                        <div className="card-body">
                            <h3 style={{ 
                                margin: '0 0 var(--space-3) 0',
                                color: 'var(--primary-700)',
                                fontSize: 'var(--text-xl)'
                            }}>
                                Join the conversation
                            </h3>
                            <p style={{ 
                                margin: '0 0 var(--space-4) 0',
                                color: 'var(--text-secondary)'
                            }}>
                                Connect with students, educators, and professionals in the EduLink community.
                            </p>
                            <button 
                                onClick={() => navigate('/')}
                                className="btn btn-primary"
                                style={{ fontSize: 'var(--text-base)' }}
                            >
                                Create Free Account
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}