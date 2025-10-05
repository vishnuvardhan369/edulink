import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../App';
import { apiCall } from '../config/api';
import Poll from '../components/Poll';

export default function PollPage() {
    const { pollId } = useParams();
    const navigate = useNavigate();
    const [user, setUser] = React.useState(null);
    const [poll, setPoll] = React.useState(null);
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
        const fetchPoll = async () => {
            try {
                setLoading(true);
                const response = await apiCall(`/api/polls/${pollId}`);
                if (response.ok) {
                    const pollData = await response.json();
                    setPoll(pollData);
                } else {
                    setError('Poll not found');
                }
            } catch (err) {
                console.error('Error fetching poll:', err);
                setError('Failed to load poll');
            } finally {
                setLoading(false);
            }
        };

        if (pollId) {
            fetchPoll();
        }
    }, [pollId]);

    const handlePollUpdate = (updatedPoll) => {
        setPoll(updatedPoll);
    };

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-primary)'
            }}>
                <div className="loading">
                    <div className="spinner"></div>
                    <p>Loading poll...</p>
                </div>
            </div>
        );
    }

    if (error || !poll) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-primary)',
                padding: 'var(--space-4)'
            }}>
                <div className="card" style={{ maxWidth: '500px', textAlign: 'center' }}>
                    <div className="card-body">
                        <h2 style={{ color: 'var(--error-600)', marginBottom: 'var(--space-4)' }}>
                            {error || 'Poll not found'}
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
                            The poll you're looking for doesn't exist or has been removed.
                        </p>
                        <button 
                            onClick={() => navigate('/')}
                            className="btn btn-primary"
                        >
                            Back to Home
                        </button>
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
                        style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}
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
                        <strong>Want to vote?</strong> Join EduLink to participate in polls and engage with the community!
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

            {/* Poll Content */}
            <div style={{ 
                maxWidth: '680px', 
                margin: '0 auto',
                padding: 'var(--space-6) var(--space-4)',
                minHeight: 'calc(100vh - 200px)'
            }}>
                {loading && (
                    <div style={{
                        background: 'white',
                        borderRadius: 'var(--radius-lg)',
                        padding: 'var(--space-8)',
                        textAlign: 'center',
                        boxShadow: 'var(--shadow-md)'
                    }}>
                        <div style={{
                            width: '50px',
                            height: '50px',
                            border: '4px solid var(--primary-100)',
                            borderTop: '4px solid var(--primary-600)',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                            margin: '0 auto var(--space-4)'
                        }} />
                        <p style={{ 
                            color: 'var(--text-secondary)', 
                            fontSize: 'var(--text-base)',
                            margin: 0 
                        }}>
                            Loading poll...
                        </p>
                    </div>
                )}

                {error && (
                    <div style={{
                        background: 'white',
                        borderRadius: 'var(--radius-lg)',
                        padding: 'var(--space-8)',
                        textAlign: 'center',
                        boxShadow: 'var(--shadow-md)'
                    }}>
                        <div style={{
                            fontSize: '48px',
                            marginBottom: 'var(--space-4)'
                        }}>
                            📊
                        </div>
                        <h2 style={{
                            fontSize: 'var(--text-2xl)',
                            fontWeight: 'var(--font-bold)',
                            color: 'var(--text-primary)',
                            marginBottom: 'var(--space-2)'
                        }}>
                            Poll Not Found
                        </h2>
                        <p style={{
                            color: 'var(--text-secondary)',
                            fontSize: 'var(--text-base)',
                            marginBottom: 'var(--space-6)',
                            lineHeight: '1.6'
                        }}>
                            {error}
                        </p>
                        <button 
                            onClick={() => navigate('/')}
                            className="btn btn-primary"
                        >
                            Browse Community Polls
                        </button>
                    </div>
                )}

                {!loading && !error && poll && (
                    <div style={{
                        background: 'white',
                        borderRadius: 'var(--radius-lg)',
                        padding: 'var(--space-4)',
                        boxShadow: 'var(--shadow-md)',
                        marginBottom: 'var(--space-6)'
                    }}>
                        <Poll 
                            poll={poll}
                            onPollUpdate={handlePollUpdate}
                            isPublicView={!user}
                        />
                    </div>
                )}

                {/* CTA Section for Non-Authenticated Users */}
                {!user && !loading && !error && poll && (
                    <div style={{
                        background: 'white',
                        borderRadius: 'var(--radius-lg)',
                        padding: 'var(--space-6)',
                        textAlign: 'center',
                        boxShadow: 'var(--shadow-md)',
                        border: '2px solid var(--primary-100)'
                    }}>
                        <h3 style={{
                            fontSize: 'var(--text-xl)',
                            fontWeight: 'var(--font-bold)',
                            color: 'var(--text-primary)',
                            marginBottom: 'var(--space-2)'
                        }}>
                            Join the Conversation
                        </h3>
                        <p style={{
                            color: 'var(--text-secondary)',
                            fontSize: 'var(--text-base)',
                            marginBottom: 'var(--space-4)',
                            lineHeight: '1.6'
                        }}>
                            Vote on polls, share your opinions, and connect with students and educators worldwide.
                        </p>
                        <button 
                            onClick={() => navigate('/')}
                            className="btn btn-primary"
                            style={{ fontSize: 'var(--text-base)' }}
                        >
                            Sign Up Free
                        </button>
                        <p style={{
                            marginTop: 'var(--space-3)',
                            fontSize: 'var(--text-sm)',
                            color: 'var(--text-tertiary)'
                        }}>
                            Already have an account? <a 
                                href="/" 
                                style={{ 
                                    color: 'var(--primary-600)', 
                                    textDecoration: 'none',
                                    fontWeight: 'var(--font-medium)'
                                }}
                            >
                                Sign in
                            </a>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}