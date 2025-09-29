import { useState, useEffect, useContext, createContext } from 'react';
import { auth } from '../App';
import { apiCall } from '../config/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
            if (firebaseUser) {
                // Get user data from backend
                try {
                    const response = await apiCall(`/api/users/${firebaseUser.uid}`);
                    if (response.ok) {
                        const userData = await response.json();
                        setUser({
                            id: firebaseUser.uid,
                            email: firebaseUser.email,
                            username: userData.username,
                            full_name: userData.displayName,
                            ...userData
                        });
                    } else {
                        setUser(null);
                    }
                } catch (error) {
                    console.error('Error fetching user data:', error);
                    setUser(null);
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const login = async (email, password) => {
        // This will use Firebase auth which is already handled in AuthPage
        return { success: true };
    };

    const logout = async () => {
        await auth.signOut();
        setUser(null);
    };

    const value = {
        user,
        loading,
        login,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};