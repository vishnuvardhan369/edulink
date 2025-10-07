import React from 'react';
import { apiCall } from '../config/api';

function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = React.useState(value);
    React.useEffect(() => {
        const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
        return () => { clearTimeout(handler); };
    }, [value, delay]);
    return debouncedValue;
}

export default function UsernameSelectionPage({ user, onUsernameSet }) {
    const [username, setUsername] = React.useState('');
    const [isValid, setIsValid] = React.useState(false);
    const [isChecking, setIsChecking] = React.useState(false);
    const [feedback, setFeedback] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const debouncedUsername = useDebounce(username, 500);

    React.useEffect(() => {
        const checkUsername = async () => {
            if (debouncedUsername.length < 3) return;
            setIsChecking(true);
            try {
                // Check if username exists by searching for it
                const response = await apiCall(`/api/users/search?query=${debouncedUsername}`);
                if (response.ok) {
                    const users = await response.json();
                    const usernameExists = users.some(u => u.username.toLowerCase() === debouncedUsername.toLowerCase());
                    setFeedback(usernameExists ? '❌ Username is already taken. Try another one!' : '✅ Perfect! This username is available!');
                    setIsValid(!usernameExists);
                } else {
                    setFeedback('⚠️ Error checking username availability. Please try again.');
                    setIsValid(false);
                }
            } catch (error) {
                console.error('Error checking username:', error);
                setFeedback('⚠️ Error checking username availability. Please try again.');
                setIsValid(false);
            }
            setIsChecking(false);
        };
        
        // Validate username format
        if (debouncedUsername.length === 0) {
            setFeedback('');
            setIsValid(false);
        } else if (debouncedUsername.length < 3) {
            setFeedback('⚠️ Username must be at least 3 characters long.');
            setIsValid(false);
        } else if (debouncedUsername.length > 15) {
            setFeedback('⚠️ Username must be 15 characters or less.');
            setIsValid(false);
        } else if (!/^[a-zA-Z0-9_]+$/.test(debouncedUsername)) {
            setFeedback('⚠️ Only letters, numbers, and underscores are allowed.');
            setIsValid(false);
        } else if (/^[0-9_]/.test(debouncedUsername)) {
            setFeedback('⚠️ Username must start with a letter.');
            setIsValid(false);
        } else {
            // Username format is valid, check availability
            checkUsername();
        }
    }, [debouncedUsername]);

    const handleSubmit = async (e) => {
        e.preventDefault(); 
        if (!isValid) return; 
        setIsSubmitting(true);
        try {
            const displayName = user.displayName || username;

            const newUserData = {
                userId: user.uid,
                username: username,
                email: user.email,
                displayName: displayName,
                profilePictureUrl: user.photoURL || `https://placehold.co/400x400/EBF4FF/76A9FA?text=${username.charAt(0).toUpperCase()}`,
                bio: ''
            };
            
            const response = await apiCall('/api/users', {
                method: 'POST',
                body: JSON.stringify(newUserData)
            });
            
            if (response.ok) {
                onUsernameSet();
            } else {
                const errorData = await response.json();
                setFeedback(errorData.error || 'Could not save username.');
                setIsSubmitting(false);
            }
        } catch (error) { 
            console.error("Error setting username:", error);
            setFeedback('Could not save username.'); 
            setIsSubmitting(false); 
        }
    };

    return (
        <div className="edulink-app" style={{ 
            minHeight: '100vh', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%)',
            padding: 'var(--spacing-lg)'
        }}>
            <div className="card fade-in" style={{ 
                maxWidth: '500px', 
                width: '100%',
                padding: 'var(--spacing-xl)',
                boxShadow: 'var(--shadow-lg)',
                textAlign: 'center'
            }}>
                {/* Header */}
                <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                    <div style={{ 
                        width: '80px', 
                        height: '80px', 
                        margin: '0 auto var(--spacing-md)',
                        background: 'linear-gradient(135deg, var(--primary-color), var(--primary-light))',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2.5rem'
                    }}>
                        👤
                    </div>
                    <h1 style={{ 
                        fontSize: 'var(--font-size-xxl)', 
                        fontWeight: 'var(--font-weight-bold)',
                        color: 'var(--text-primary)',
                        marginBottom: 'var(--spacing-xs)'
                    }}>
                        Choose Your Username
                    </h1>
                    <p style={{ 
                        fontSize: 'var(--font-size-md)', 
                        color: 'var(--text-secondary)',
                        marginBottom: 0
                    }}>
                        Pick a unique username to complete your profile
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit}>
                    <div className="form-group" style={{ textAlign: 'left' }}>
                        <label className="form-label" style={{ 
                            color: 'var(--text-primary)', 
                            fontWeight: 'var(--font-weight-medium)',
                            marginBottom: 'var(--spacing-xs)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-xs)'
                        }}>
                            <span>Username</span>
                            {isChecking && (
                                <div className="spinner" style={{ 
                                    width: '14px', 
                                    height: '14px', 
                                    borderWidth: '2px' 
                                }}></div>
                            )}
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input 
                                type="text" 
                                value={username} 
                                onChange={(e) => setUsername(e.target.value.toLowerCase())} 
                                placeholder="your_username" 
                                className="form-control"
                                style={{ 
                                    paddingLeft: 'var(--spacing-lg)',
                                    fontSize: 'var(--font-size-lg)',
                                    fontWeight: 'var(--font-weight-medium)'
                                }}
                                autoFocus
                            />
                            <span style={{ 
                                position: 'absolute', 
                                left: 'var(--spacing-md)', 
                                top: '50%', 
                                transform: 'translateY(-50%)',
                                color: 'var(--text-secondary)',
                                fontSize: 'var(--font-size-lg)',
                                fontWeight: 'var(--font-weight-medium)'
                            }}>
                                @
                            </span>
                        </div>
                        
                        {/* Feedback Message */}
                        {feedback && (
                            <div style={{ 
                                marginTop: 'var(--spacing-sm)',
                                padding: 'var(--spacing-sm) var(--spacing-md)',
                                borderRadius: 'var(--border-radius)',
                                backgroundColor: isValid ? 'var(--success-color)' : 'var(--error-color)',
                                color: 'white',
                                fontSize: 'var(--font-size-sm)',
                                fontWeight: 'var(--font-weight-medium)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--spacing-xs)'
                            }}>
                                <span>{isValid ? '✓' : '✗'}</span>
                                <span>{feedback}</span>
                            </div>
                        )}
                        
                        {/* Requirements Info */}
                        <div style={{ 
                            marginTop: 'var(--spacing-md)',
                            padding: 'var(--spacing-md)',
                            backgroundColor: 'var(--bg-secondary)',
                            borderRadius: 'var(--border-radius)',
                            fontSize: 'var(--font-size-sm)',
                            color: 'var(--text-secondary)',
                            textAlign: 'left'
                        }}>
                            <p style={{ 
                                margin: '0 0 var(--spacing-xs) 0', 
                                fontWeight: 'var(--font-weight-semibold)',
                                color: 'var(--text-primary)'
                            }}>
                                Username Requirements:
                            </p>
                            <ul style={{ 
                                margin: 0, 
                                paddingLeft: 'var(--spacing-lg)',
                                lineHeight: 1.6
                            }}>
                                <li>3-15 characters long</li>
                                <li>Letters, numbers, and underscores only</li>
                                <li>Must be unique</li>
                                <li>No spaces allowed</li>
                            </ul>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button 
                        type="submit" 
                        disabled={!isValid || isSubmitting}
                        className="btn btn-primary btn-lg"
                        style={{ 
                            width: '100%',
                            marginTop: 'var(--spacing-lg)',
                            fontSize: 'var(--font-size-lg)',
                            padding: 'var(--spacing-md) var(--spacing-lg)'
                        }}
                    >
                        {isSubmitting ? (
                            <>
                                <div className="spinner" style={{ width: '20px', height: '20px', marginRight: 'var(--spacing-sm)' }}></div>
                                Creating Profile...
                            </>
                        ) : (
                            <>
                                ✨ Complete Registration
                            </>
                        )}
                    </button>
                </form>

                {/* Footer Note */}
                <p style={{ 
                    marginTop: 'var(--spacing-lg)',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--text-secondary)',
                    marginBottom: 0
                }}>
                    You can't change your username later, so choose wisely! 😊
                </p>
            </div>
        </div>
    );
};
