import React from 'react';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../App';

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
            const usernameDocRef = doc(db, 'usernames', debouncedUsername);
            const usernameDocSnap = await getDoc(usernameDocRef);
            setFeedback(usernameDocSnap.exists() ? 'Username is already taken.' : 'Username is available!');
            setIsValid(!usernameDocSnap.exists());
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
            const userDocRef = doc(db, 'users', user.uid);
            const usernameDocRef = doc(db, 'usernames', username);
            const batch = writeBatch(db);
            
            const displayName = user.displayName || username;

            const newUserData = {
                username: username, // already lowercase
                displayName: displayName,
                // **NEW**: Add the lowercase version for searching
                displayName_lowercase: displayName.toLowerCase(),
                email: user.email,
                uid: user.uid,
                createdAt: new Date(),
                profilePictureUrl: user.photoURL || `https://placehold.co/400x400/EBF4FF/76A9FA?text=${username.charAt(0).toUpperCase()}`,
                headline: '',
                bio: '',
                location: '',
                skills: [],
                socialLinks: { linkedin: '', github: '' },
                followers: [],
                following: [],
                connectionRequestsSent: [],
                connectionRequestsReceived: []
            };
            
            batch.set(userDocRef, newUserData);
            batch.set(usernameDocRef, { uid: user.uid });
            await batch.commit();
            onUsernameSet();
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
