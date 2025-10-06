import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { apiCall } from './config/api';
import { AuthProvider } from './hooks/useAuth.jsx';
import { useSocket } from './hooks/useSocket.jsx';
import './App.css';

// Import our page components
import AuthPage from './pages/AuthPage';
import EmailVerificationPage from './pages/EmailVerificationPage';
import UsernameSelectionPage from './pages/UsernameSelectionPage';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import SearchPage from './pages/SearchPage';
import NotificationsPage from './pages/NotificationsPage';
import ChatPage from './pages/ChatPage';
import ChatListPage from './pages/ChatListPage';
import PostPage from './pages/PostPage';
import PollPage from './pages/PollPage';
import MeetCallPage from './pages/MeetCallPage';
import RoadmapPage from './pages/RoadmapPage';
import CallModal from './components/Calls/CallModal';
import RandomMeet from './components/RandomMeet';
import BuyMeCoffee from './components/BuyMeCoffee';

// --- Firebase Config ---
const firebaseConfig = {
  apiKey: "AIzaSyBDAWGeBWmftYwQLBO37lCfyvgRqMwcU6Q",
  authDomain: "edulink321.firebaseapp.com",
  projectId: "edulink321",
  storageBucket: "edulink321.firebasestorage.app",
  messagingSenderId: "184027362493",
  appId: "1:184027362493:web:35f6c2d116da62c9dfb3d4",
  measurementId: "G-KK3E6Y82GS"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Main App Component with Router Logic
function AppContent() {
    const [user, setUser] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [userData, setUserData] = React.useState(null);
    const [incomingCall, setIncomingCall] = React.useState(null);
    const navigate = useNavigate();
    const location = useLocation();
    
    // App-level socket connection
    const { socket, isConnected } = useSocket();

    const fetchCurrentUserData = async (currentUser) => {
        if (currentUser) {
            try {
                // First try to fetch existing user data
                const response = await apiCall(`/api/users/${currentUser.uid}`);
                if (response.ok) {
                    const userData = await response.json();
                    setUserData(userData);
                } else if (response.status === 404) {
                    // User doesn't exist in database, create them
                    console.log('👤 User not found in database, creating new user...');
                    const createResponse = await apiCall('/api/users', {
                        method: 'POST',
                        body: JSON.stringify({
                            userId: currentUser.uid,
                            username: currentUser.email?.split('@')[0] || 'user',
                            email: currentUser.email,
                            displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
                            profilePictureUrl: currentUser.photoURL || null,
                            bio: ''
                        })
                    });
                    
                    if (createResponse.ok) {
                        const newUserData = await createResponse.json();
                        console.log('✅ User created successfully:', newUserData);
                        setUserData(newUserData);
                    } else {
                        console.error('❌ Failed to create user');
                        setUserData(null);
                    }
                } else {
                    console.error('❌ Failed to fetch user data:', response.status, response.statusText);
                    setUserData(null);
                }
            } catch (error) {
                console.error('❌ Error in fetchCurrentUserData:', error);
                setUserData(null);
            }
        } else {
            setUserData(null);
        }
    };

    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            await fetchCurrentUserData(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Socket connection and call notifications
    React.useEffect(() => {
        if (user && socket && isConnected) {
            console.log('🔌 Setting up app-level socket listeners for user:', user.uid);
            
            // Join user's room for notifications
            socket.emit('user:join', user.uid);
            
            // Listen for successful join confirmation
            socket.on('user:joined', (data) => {
                console.log('✅ Successfully joined notifications:', data);
            });
            
            // Listen for incoming calls (WebRTC event)
            socket.on('webrtc:incoming-call', (callData) => {
                console.log('🔔 Incoming call received (App.jsx):', callData);
                setIncomingCall(callData);
            });
            
            // Listen for call status updates
            socket.on('webrtc:call-decline', (data) => {
                console.log('📞 Call declined:', data);
                setIncomingCall(null);
            });
            
            socket.on('webrtc:call-ended', (data) => {
                console.log('📞 Call ended:', data);
                setIncomingCall(null);
            });
            
            // Listen for errors
            socket.on('error', (error) => {
                console.error('🚨 Socket error:', error);
            });
            
            // Listen for test notifications
            socket.on('test:received', (data) => {
                console.log('🧪 TEST NOTIFICATION RECEIVED:', data);
                alert(`Test notification from ${data.from}: ${data.message}`);
            });
            
            return () => {
                if (socket) {
                    socket.off('user:joined');
                    socket.off('webrtc:incoming-call');
                    socket.off('webrtc:call-decline');
                    socket.off('webrtc:call-ended');
                    socket.off('error');
                    socket.off('test:received');
                }
            };
        }
    }, [user, socket, isConnected]);

    // Test function
    const sendTestNotification = (targetUserId) => {
        if (socket && user) {
            console.log(`🧪 Sending test notification to: ${targetUserId}`);
            socket.emit('test:notification', {
                targetUserId,
                message: `Hello from ${user.uid}!`
            });
        }
    };

    // Expose test function globally for console testing
    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            window.testNotification = sendTestNotification;
            window.currentUserId = user?.uid;
            console.log('🧪 Test functions available:');
            console.log('- window.testNotification(targetUserId) - send test notification');
            console.log('- window.currentUserId - your user ID:', user?.uid);
        }
    }, [socket, user]);

    const handleAnswerCall = () => {
        if (incomingCall && socket && socket.connected) {
            console.log('📞 Answering call:', incomingCall);
            
            // Store call reference to prevent duplicate answers
            const currentCall = { ...incomingCall };
            
            // Clear incoming call immediately to prevent duplicate answers
            setIncomingCall(null);
            
            // Navigate to chat page - the ChatPage will handle accepting the call
            // Store the call data in sessionStorage so ChatPage can pick it up
            sessionStorage.setItem('pendingCall', JSON.stringify(currentCall));
            navigate(`/chat/${currentCall.conversationId}`);
            
        } else {
            console.error('❌ Cannot answer call - socket not connected or missing call data');
        }
    };

    const handleDeclineCall = () => {
        if (incomingCall && socket && socket.connected) {
            console.log('📞 Declining call:', incomingCall);
            
            // Store call reference to prevent issues
            const currentCall = { ...incomingCall };
            
            // Clear incoming call immediately
            setIncomingCall(null);
            
            socket.emit('webrtc:call-decline', { 
                callId: currentCall.callId,
                conversationId: currentCall.conversationId,
                targetUserId: currentCall.callerId,
                userId: user.uid
            });
            
            console.log('✅ Decline event sent with callId:', currentCall.callId);
            
        } else {
            console.error('❌ Cannot decline call - socket not connected or missing call data');
        }
    };

    const handleSignOut = async () => {
        if (socket) {
            socket.disconnect();
        }
        await signOut(auth);
        navigate('/');
    };

    // --- MAIN RENDER LOGIC ---
    if (loading) return <div>Loading...</div>;
    
    return (
        <>
            <Routes>
                {/* Public Routes - accessible without authentication */}
                <Route path="/post/:postId" element={<PostPage />} />
                <Route path="/poll/:pollId" element={<PollPage />} />
                
                {/* Protected Routes - require authentication */}
                {!user ? (
                    <Route path="*" element={<AuthPage />} />
                ) : !user.emailVerified ? (
                    <Route path="*" element={<EmailVerificationPage user={user} />} />
                ) : !userData ? (
                    <Route path="*" element={<UsernameSelectionPage user={user} onUsernameSet={() => fetchCurrentUserData(user)} />} />
                ) : (
                    <>
                        <Route path="/" element={
                            <HomePage
                                userData={userData}
                                onSignOut={handleSignOut}
                            />
                        } />
                        <Route path="/profile/:userId?" element={
                            <ProfilePage
                                currentUserData={userData}
                                onProfileUpdate={() => fetchCurrentUserData(user)}
                            />
                        } />
                        <Route path="/search" element={<SearchPage />} />
                        <Route path="/notifications" element={
                            <NotificationsPage
                                currentUserData={userData}
                                onUpdate={() => fetchCurrentUserData(user)}
                            />
                        } />
                        <Route path="/chat" element={<ChatListPage />} />
                        <Route path="/chat/:conversationId" element={<ChatPage />} />
                        <Route path="/meet" element={<RandomMeet />} />
                        <Route path="/meet-call" element={<MeetCallPage />} />
                        <Route path="/roadmap" element={<RoadmapPage />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </>
                )}
            </Routes>
            
            {/* Global Call Notification Modal */}
            {incomingCall && (
                <CallModal 
                    call={incomingCall}
                    onAnswer={handleAnswerCall}
                    onDecline={handleDeclineCall}
                />
            )}
            
            {/* Buy Me a Coffee - Always visible */}
            {user && <BuyMeCoffee />}
        </>
    );
}

// Main App wrapper with Router
export default function App() {
    return (
        <AuthProvider>
            <Router>
                <AppContent />
            </Router>
        </AuthProvider>
    );
}
