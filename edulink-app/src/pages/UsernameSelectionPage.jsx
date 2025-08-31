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
                    setFeedback(usernameExists ? 'Username is already taken.' : 'Username is available!');
                    setIsValid(!usernameExists);
                } else {
                    setFeedback('Error checking username availability.');
                    setIsValid(false);
                }
            } catch (error) {
                console.error('Error checking username:', error);
                setFeedback('Error checking username availability.');
                setIsValid(false);
            }
            setIsChecking(false);
        };
        if (/^[a-zA-Z0-9_]{3,15}$/.test(debouncedUsername)) checkUsername();
        else if (debouncedUsername.length > 0) setFeedback('Must be 3-15 characters (letters, numbers, _).');
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
        <div>
            <h2>Choose a unique username</h2>
            <form onSubmit={handleSubmit}>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="your_username" />
                <div>{isChecking ? <p>Checking...</p> : <p style={{color: isValid ? 'green' : 'red'}}>{feedback}</p>}</div>
                <button type="submit" disabled={!isValid || isSubmitting}>{isSubmitting ? 'Saving...' : 'Complete Registration'}</button>
            </form>
        </div>
    );
};
