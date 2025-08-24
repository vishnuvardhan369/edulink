import React from 'react';
import { 
    GoogleAuthProvider,
    signInWithPopup,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification,
    sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '../App'; // Import auth from our main App.jsx

function getFriendlyErrorMessage(errorCode) {
    switch (errorCode) {
        case 'auth/invalid-email': return 'The email address is not valid.';
        case 'auth/user-disabled': return 'This user account has been disabled.';
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential': return 'Invalid email or password. Please try again.';
        case 'auth/email-already-in-use': return 'An account already exists with this email address.';
        case 'auth/weak-password': return 'The password is too weak. Please use at least 6 characters.';
        default: return `An unexpected error occurred. (Code: ${errorCode})`;
    }
}

// Main component for this file
export default function AuthPage() {
    const [isLogin, setIsLogin] = React.useState(true);
    const handleGoogleSignIn = async () => {
        const provider = new GoogleAuthProvider();
        try { await signInWithPopup(auth, provider); } 
        catch (error) { alert(getFriendlyErrorMessage(error.code)); }
    };
    return (
        <div>
            <h1>Welcome to EduLink</h1>
            {isLogin ? <LoginForm /> : <SignUpForm />}
            <button onClick={() => setIsLogin(!isLogin)}>
                {isLogin ? "Need an account? Sign Up" : "Already have an account? Login"}
            </button>
            <hr />
            <button onClick={handleGoogleSignIn}>Sign in with Google</button>
        </div>
    );
};

// Internal components for this page
const LoginForm = () => {
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [showPassword, setShowPassword] = React.useState(false);
    const [error, setError] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [showForgotPassword, setShowForgotPassword] = React.useState(false);

    const handleLogin = async (e) => {
        e.preventDefault(); setLoading(true); setError('');
        try { await signInWithEmailAndPassword(auth, email, password); } 
        catch (err) { setError(getFriendlyErrorMessage(err.code)); setLoading(false); }
    };
    
    if (showForgotPassword) return <ForgotPasswordForm onBack={() => setShowForgotPassword(false)} />;
    return (
        <form onSubmit={handleLogin}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required /><br />
            <div>
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)}>Show</button>
            </div>
            {error && <p style={{color: 'red'}}>{error}</p>}
            <button type="submit" disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button><br />
            <button type="button" onClick={() => setShowForgotPassword(true)}>Forgot Password?</button>
        </form>
    );
};

const SignUpForm = () => {
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [confirmPassword, setConfirmPassword] = React.useState('');
    const [showPassword, setShowPassword] = React.useState(false);
    const [error, setError] = React.useState('');
    const [loading, setLoading] = React.useState(false);

    const handleSignUp = async (e) => {
        e.preventDefault(); setError('');
        if (password !== confirmPassword) { setError("Passwords do not match."); return; }
        if (password.length < 8 || !/\d/.test(password)) { setError("Password must be 8+ characters and include a number."); return; }
        setLoading(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await sendEmailVerification(userCredential.user);
        } catch (err) { setError(getFriendlyErrorMessage(err.code)); setLoading(false); }
    };

    return (
        <form onSubmit={handleSignUp}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required /><br />
            <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required /><br />
            <input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm Password" required /><br />
            <button type="button" onClick={() => setShowPassword(!showPassword)}>Show</button>
            <p style={{fontSize: '12px'}}>Password must be 8+ characters and include a number.</p>
            {error && <p style={{color: 'red'}}>{error}</p>}
            <button type="submit" disabled={loading}>{loading ? 'Signing Up...' : 'Sign Up'}</button>
        </form>
    );
};

const ForgotPasswordForm = ({ onBack }) => {
    const [email, setEmail] = React.useState('');
    const [message, setMessage] = React.useState('');
    const [error, setError] = React.useState('');
    const [loading, setLoading] = React.useState(false);

    const handleReset = async (e) => {
        e.preventDefault(); setLoading(true); setError(''); setMessage('');
        try {
            await sendPasswordResetEmail(auth, email);
            setMessage('Password reset email sent! Check your inbox.');
        } catch (err) { setError(getFriendlyErrorMessage(err.code)); }
        setLoading(false);
    };

    return (
        <div>
            <h3>Reset Password</h3>
            <form onSubmit={handleReset}>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" required /><br/>
                {message && <p style={{color: 'green'}}>{message}</p>}
                {error && <p style={{color: 'red'}}>{error}</p>}
                <button type="submit" disabled={loading}>{loading ? 'Sending...' : 'Send Reset Link'}</button>
            </form>
            <button onClick={onBack}>&larr; Back to Login</button>
        </div>
    );
};
