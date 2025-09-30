import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import CallModal from './components/Calls/CallModal';

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

// --- Main App Component ---
export default function App() {
    const [user, setUser] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [userData, setUserData] = React.useState(null);
    const [currentPage, setCurrentPage] = React.useState({ page: 'home', profileId: null });
    const [incomingCall, setIncomingCall] = React.useState(null);
    
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
            
            // Listen for incoming calls
            socket.on('call:incoming', (callData) => {
                console.log('🔔 Incoming call received:', callData);
                setIncomingCall(callData);
            });
            
            // Listen for call status updates
            socket.on('call:answered', (data) => {
                console.log('📞 Call answered:', data);
                setIncomingCall(null);
            });
            
            socket.on('call:declined', (data) => {
                console.log('📞 Call declined:', data);
                setIncomingCall(null);
            });
            
            socket.on('call:ended', (data) => {
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
                    socket.off('call:incoming');
                    socket.off('call:answered');
                    socket.off('call:declined');
                    socket.off('call:ended');
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
            
            // Emit call answer event with proper data
            socket.emit('call:answer', { 
                callId: currentCall.callId,
                conversationId: currentCall.conversationId,
                callerId: currentCall.callerId,
                answererId: user.uid,
                signal: null // WebRTC signal will be handled by useWebRTC hook
            });
            
            // Navigate to chat page for the call
            setCurrentPage({ 
                page: 'chat', 
                conversationId: currentCall.conversationId 
            });
            
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
            
            socket.emit('call:decline', { 
                callId: currentCall.callId,
                conversationId: currentCall.conversationId,
                callerId: currentCall.callerId,
                userId: user.uid 
            });
            
        } else {
            console.error('❌ Cannot decline call - socket not connected or missing call data');
        }
    };

    const handleSignOut = async () => {
        if (socket) {
            socket.disconnect();
        }
        await signOut(auth);
        setCurrentPage({ page: 'home', profileId: null });
    };    
    // --- NAVIGATION FUNCTIONS ---
    const navigateToProfile = (profileId) => setCurrentPage({ page: 'profile', profileId: profileId });
    const navigateToHome = () => setCurrentPage({ page: 'home', profileId: null });
    const navigateToSearch = () => setCurrentPage({ page: 'search', profileId: null });
    const navigateToNotifications = () => setCurrentPage({ page: 'notifications', profileId: null });
    const navigateToChat = () => setCurrentPage({ page: 'chat', profileId: null });
    const navigateToChatList = () => setCurrentPage({ page: 'chat-list', profileId: null });

const renderPage = () => {
    switch (currentPage.page) {
        case 'search':
            return <SearchPage navigateToProfile={navigateToProfile} navigateToHome={navigateToHome} />;
        case 'profile':
            return <ProfilePage
                viewingProfileId={currentPage.profileId}
                currentUserData={userData}
                navigateToHome={navigateToHome}
                onProfileUpdate={() => fetchCurrentUserData(user)}
            />;
        case 'notifications':
            return <NotificationsPage
                currentUserData={userData}
                navigateToProfile={navigateToProfile}
                navigateToHome={navigateToHome}
                onUpdate={() => fetchCurrentUserData(user)}
            />;
        case 'chat':
            return <ChatPage conversationId={currentPage.conversationId} />;
        case 'chat-list':
            return <ChatListPage 
                navigateToChat={(conversationId) => {
                    setCurrentPage({ page: 'chat', conversationId });
                }}
                navigateToHome={navigateToHome}
            />;
        default:
            return (
                <div style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: "100vh"
                }}>
                    <HomePage
                        userData={userData}
                        onSignOut={handleSignOut}
                        navigateToProfile={navigateToProfile}
                        navigateToSearch={navigateToSearch}
                        navigateToNotifications={navigateToNotifications}
                        navigateToChat={navigateToChatList}
                    />
                    
                    {/* WebRTC Test Component - Add this for testing */}
                </div>
            );
    }
};


    // --- MAIN RENDER LOGIC ---
    if (loading) return <div>Loading...</div>;
    if (!user) return <AuthPage />;
    if (!user.emailVerified) return <EmailVerificationPage user={user} />;
    if (!userData) return <UsernameSelectionPage user={user} onUsernameSet={() => fetchCurrentUserData(user)} />;
    
    return (
        <AuthProvider>
            <Router>
                {renderPage()}
            </Router>
            {/* Global Call Notification Modal */}
            {incomingCall && (
                <CallModal 
                    call={incomingCall}
                    onAnswer={handleAnswerCall}
                    onDecline={handleDeclineCall}
                />
            )}
        </AuthProvider>
    );
}
