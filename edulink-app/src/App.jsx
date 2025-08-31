import React from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { apiCall } from './config/api';
import './App.css';

// Import our page components
import AuthPage from './pages/AuthPage';
import EmailVerificationPage from './pages/EmailVerificationPage';
import UsernameSelectionPage from './pages/UsernameSelectionPage';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import SearchPage from './pages/SearchPage';
import NotificationsPage from './pages/NotificationsPage'; // New page

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

    const fetchCurrentUserData = async (currentUser) => {
        if (currentUser) {
            try {
                const response = await apiCall(`/api/users/${currentUser.uid}`);
                if (response.ok) {
                    const userData = await response.json();
                    setUserData(userData);
                } else {
                    setUserData(null);
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
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

    const handleSignOut = async () => {
        await signOut(auth);
        setCurrentPage({ page: 'home', profileId: null });
    };    
    // --- NAVIGATION FUNCTIONS ---
    const navigateToProfile = (profileId) => setCurrentPage({ page: 'profile', profileId: profileId });
    const navigateToHome = () => setCurrentPage({ page: 'home', profileId: null });
    const navigateToSearch = () => setCurrentPage({ page: 'search', profileId: null });
    const navigateToNotifications = () => setCurrentPage({ page: 'notifications', profileId: null });

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
                    />
                </div>
            );
    }
};


    // --- MAIN RENDER LOGIC ---
    if (loading) return <div>Loading...</div>;
    if (!user) return <AuthPage />;
    if (!user.emailVerified) return <EmailVerificationPage user={user} />;
    if (!userData) return <UsernameSelectionPage user={user} onUsernameSet={() => fetchCurrentUserData(user)} />;
    
    return renderPage();
}
