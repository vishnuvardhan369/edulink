import React from 'react';
import { 
    GoogleAuthProvider,
    signInWithPopup,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification,
    sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '../App';

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

export default function AuthPage() {
    const [isLogin, setIsLogin] = React.useState(true);
    
    const handleGoogleSignIn = async () => {
        const provider = new GoogleAuthProvider();
        try { 
            await signInWithPopup(auth, provider); 
        } catch (error) { 
            alert(getFriendlyErrorMessage(error.code)); 
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, var(--primary-50) 0%, var(--secondary-50) 100%)',
            padding: 'var(--space-4)'
        }}>
            <div className="card fade-in" style={{
                width: '100%',
                maxWidth: '420px',
                animation: 'slideUp 0.5s ease-out'
            }}>
                <div className="card-header" style={{ textAlign: 'center' }}>
                    <h1 style={{
                        fontSize: 'var(--text-4xl)',
                        fontWeight: 'var(--font-bold)',
                        background: 'linear-gradient(135deg, var(--primary-600), var(--secondary-600))',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        marginBottom: 'var(--space-2)'
                    }}>
                        EduLink
                    </h1>
                    <p className="text-secondary text-lg">
                        Connect, Learn, Grow Together
                    </p>
                </div>
                
                <div className="card-body">
                    {/* Google Sign-In Button */}
                    <button 
                        className="btn"
                        onClick={handleGoogleSignIn}
                        style={{ 
                            width: '100%',
                            marginBottom: 'var(--space-4)',
                            padding: 'var(--space-3) var(--space-4)',
                            border: '2px solid var(--border-light)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 'var(--space-3)',
                            fontSize: 'var(--text-base)',
                            fontWeight: '500',
                            transition: 'all 0.2s ease',
                            backgroundColor: 'white',
                            color: '#374151',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        Continue with Google
                    </button>

                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 'var(--space-3)', 
                        margin: 'var(--space-4) 0',
                        color: 'var(--text-secondary)'
                    }}>
                        <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }}></div>
                        <span className="text-sm">or</span>
                        <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }}></div>
                    </div>

                    {isLogin ? <LoginForm /> : <SignUpForm />}
                    
                    <button 
                        className="btn btn-ghost"
                        style={{ width: '100%', marginTop: 'var(--space-4)' }}
                        onClick={() => setIsLogin(!isLogin)}
                    >
                        {isLogin ? "Need an account? Sign Up" : "Already have an account? Login"}
                    </button>
                </div>
            </div>
        </div>
    );
}

const LoginForm = () => {
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [showPassword, setShowPassword] = React.useState(false);
    const [error, setError] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [showForgotPassword, setShowForgotPassword] = React.useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            setError(getFriendlyErrorMessage(err.code));
            setLoading(false);
        }
    };
    
    if (showForgotPassword) {
        return <ForgotPasswordForm onBack={() => setShowForgotPassword(false)} />;
    }

    return (
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
                <label className="text-sm font-medium text-primary" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
                    Email Address
                </label>
                <input 
                    className="input"
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="Enter your email" 
                    required 
                />
            </div>

            <div>
                <label className="text-sm font-medium text-primary" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
                    Password
                </label>
                <div style={{ position: 'relative' }}>
                    <input 
                        className="input"
                        style={{ paddingRight: 'var(--space-12)' }}
                        type={showPassword ? "text" : "password"} 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        placeholder="Enter your password" 
                        required 
                    />
                    <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                            position: 'absolute',
                            right: 'var(--space-3)',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-tertiary)',
                            cursor: 'pointer',
                            fontSize: 'var(--text-sm)',
                            padding: 'var(--space-2)',
                            borderRadius: 'var(--radius-md)'
                        }}
                    >
                        {showPassword ? 'Hide' : 'Show'}
                    </button>
                </div>
            </div>

            {error && (
                <div style={{
                    background: 'var(--error-50)',
                    color: 'var(--error-600)',
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: 'var(--text-sm)',
                    border: '1px solid var(--error-200)'
                }}>
                    {error}
                </div>
            )}

            <button 
                className="btn btn-primary"
                type="submit" 
                disabled={loading}
                style={{ width: '100%' }}
            >
                {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <button 
                type="button" 
                onClick={() => setShowForgotPassword(true)}
                style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary-600)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--font-medium)',
                    padding: 'var(--space-2)',
                    borderRadius: 'var(--radius-md)',
                    textAlign: 'center'
                }}
            >
                Forgot your password?
            </button>
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
        e.preventDefault();
        setError('');
        
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        
        if (password.length < 8 || !/\d/.test(password)) {
            setError("Password must be 8+ characters and include a number.");
            return;
        }
        
        setLoading(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await sendEmailVerification(userCredential.user);
        } catch (err) {
            setError(getFriendlyErrorMessage(err.code));
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
                <label className="text-sm font-medium text-primary" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
                    Email Address
                </label>
                <input 
                    className="input"
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="Enter your email" 
                    required 
                />
            </div>

            <div>
                <label className="text-sm font-medium text-primary" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
                    Password
                </label>
                <div style={{ position: 'relative' }}>
                    <input 
                        className="input"
                        style={{ paddingRight: 'var(--space-12)' }}
                        type={showPassword ? "text" : "password"} 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        placeholder="Create a password" 
                        required 
                    />
                    <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                            position: 'absolute',
                            right: 'var(--space-3)',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            fontSize: 'var(--text-sm)',
                            cursor: 'pointer',
                            padding: 'var(--space-1)'
                        }}
                    >
                        {showPassword ? 'Hide' : 'Show'}
                    </button>
                </div>
                {password && password.length > 0 && (password.length < 8 || !/\d/.test(password)) && (
                    <p style={{
                        fontSize: 'var(--text-sm)',
                        color: 'var(--error-600)',
                        marginTop: 'var(--space-1)',
                        marginBottom: '0'
                    }}>
                        Password must be 8+ characters and include a number.
                    </p>
                )}
            </div>

            <div>
                <label className="text-sm font-medium text-primary" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
                    Confirm Password
                </label>
                <div style={{ position: 'relative' }}>
                    <input 
                        className="input"
                        style={{ paddingRight: 'var(--space-12)' }}
                        type={showPassword ? "text" : "password"} 
                        value={confirmPassword} 
                        onChange={(e) => setConfirmPassword(e.target.value)} 
                        placeholder="Confirm your password" 
                        required 
                    />
                    <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                            position: 'absolute',
                            right: 'var(--space-3)',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            fontSize: 'var(--text-sm)',
                            cursor: 'pointer',
                            padding: 'var(--space-1)'
                        }}
                    >
                        {showPassword ? 'Hide' : 'Show'}
                    </button>
                </div>
                {confirmPassword && confirmPassword.length > 0 && password !== confirmPassword && (
                    <p style={{
                        fontSize: 'var(--text-sm)',
                        color: 'var(--error-600)',
                        marginTop: 'var(--space-1)',
                        marginBottom: '0'
                    }}>
                        Passwords do not match.
                    </p>
                )}
            </div>

            {error && (
                <div style={{
                    background: 'var(--error-50)',
                    color: 'var(--error-600)',
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: 'var(--text-sm)',
                    border: '1px solid var(--error-200)'
                }}>
                    {error}
                </div>
            )}

            <button 
                className="btn btn-primary"
                type="submit" 
                disabled={loading}
                style={{ width: '100%' }}
            >
                {loading ? 'Creating account...' : 'Create Account'}
            </button>
        </form>
    );
};

const ForgotPasswordForm = ({ onBack }) => {
    const [email, setEmail] = React.useState('');
    const [message, setMessage] = React.useState('');
    const [error, setError] = React.useState('');
    const [loading, setLoading] = React.useState(false);

    const handleReset = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');
        
        try {
            await sendPasswordResetEmail(auth, email);
            setMessage('Password reset email sent! Check your inbox.');
        } catch (err) {
            setError(getFriendlyErrorMessage(err.code));
        }
        setLoading(false);
    };

    return (
        <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
                <label className="text-sm font-medium text-primary" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
                    Email Address
                </label>
                <input 
                    className="input"
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="Enter your email" 
                    required 
                />
            </div>

            <div style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                padding: 'var(--space-3)',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-light)'
            }}>
                We'll send you a link to reset your password.
            </div>

            {message && (
                <div style={{
                    background: 'var(--success-50)',
                    color: 'var(--success-600)',
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: 'var(--text-sm)',
                    border: '1px solid var(--success-200)'
                }}>
                    {message}
                </div>
            )}

            {error && (
                <div style={{
                    background: 'var(--error-50)',
                    color: 'var(--error-600)',
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: 'var(--text-sm)',
                    border: '1px solid var(--error-200)'
                }}>
                    {error}
                </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <button 
                    type="button" 
                    onClick={onBack}
                    className="btn btn-ghost"
                    style={{ flex: 1 }}
                >
                    Back to Login
                </button>
                <button 
                    className="btn btn-primary"
                    type="submit" 
                    disabled={loading}
                    style={{ flex: 1 }}
                >
                    {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
            </div>
        </form>
    );
};
