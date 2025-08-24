import React from 'react';
import { sendEmailVerification, signOut } from 'firebase/auth';
import { auth } from '../App';

export default function EmailVerificationPage({ user }) {
    const [message, setMessage] = React.useState('');
    const [loading, setLoading] = React.useState(false);

    const handleResend = async () => {
        setLoading(true);
        try {
            await sendEmailVerification(user);
            setMessage('A new verification email has been sent to your inbox.');
        } catch (error) {
            setMessage('Error sending verification email. Please try again later.');
        }
        setLoading(false);
    };
    
    return (
        <div>
            <h2>Verify Your Email</h2>
            <p>A verification link has been sent to <strong>{user.email}</strong>. Please check your inbox (and spam folder) to continue.</p>
            <p>After verifying, please refresh this page.</p>
            <button onClick={handleResend} disabled={loading}>
                {loading ? 'Sending...' : 'Resend Verification Email'}
            </button>
            {message && <p style={{color: 'green'}}>{message}</p>}
            <br />
            <button onClick={() => signOut(auth)}>Use a different account</button>
        </div>
    );
};
