import React from 'react';
import { auth } from '../App';
import { apiCall } from '../config/api';

// This is a helper hook to fetch profile data for any user
function useProfileData(userId) {
    const [profileData, setProfileData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);

    const fetchUserData = async () => {
        if (!userId) {
            setLoading(false);
            return;
        };
        setLoading(true);
        try {
            const response = await apiCall(`/api/users/${userId}`);
            if (response.ok) {
                const userData = await response.json();
                setProfileData(userData);
            } else {
                setProfileData(null);
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
            setProfileData(null);
        }
        setLoading(false);
    };

    React.useEffect(() => {
        fetchUserData();
    }, [userId]);

    return { profileData, loading, refetch: fetchUserData };
}


export default function ProfilePage({ viewingProfileId, currentUserData, navigateToHome, onProfileUpdate }) {
    const { profileData: viewedUserData, loading: profileLoading, refetch } = useProfileData(viewingProfileId);
    const [isEditing, setIsEditing] = React.useState(false);
    const [editFormData, setEditFormData] = React.useState(null);
    const [uploading, setUploading] = React.useState(false);
    const fileInputRef = React.useRef(null);
    
    const currentUser = auth.currentUser;
    const AZURE_STORAGE_ACCOUNT_NAME = "edulinkdata";

    React.useEffect(() => {
        if (viewedUserData) {
            setEditFormData({
                ...viewedUserData,
                skills: viewedUserData.skills || [],
                socialLinks: viewedUserData.socialLinks || { linkedin: '', github: '' }
            });
        }
    }, [viewedUserData]);

    console.log('ProfilePage Debug:', {
        viewingProfileId,
        profileLoading,
        viewedUserData: !!viewedUserData,
        editFormData: !!editFormData,
        currentUser: currentUser?.uid
    });

    if (profileLoading) return <div>Loading profile...</div>;
    if (!viewedUserData) return <div>User not found.</div>;

    const isOwnProfile = currentUser.uid === viewingProfileId;
    const followers = viewedUserData.followers || [];
    const following = viewedUserData.following || [];
    const requestsSent = currentUserData.connectionRequestsSent || [];
    const isFollowingCurrentUser = followers.includes(currentUser.uid);
    const isConnected = isFollowingCurrentUser && (currentUserData.following || []).includes(viewingProfileId);
    const hasSentRequest = requestsSent.includes(viewingProfileId);
    const hasReceivedRequest = (currentUserData.connectionRequestsReceived || []).includes(viewingProfileId);

    const handleConnection = async (action) => {
        try {
            console.log(`Attempting to ${action} user ${viewingProfileId}`);
            const response = await apiCall(`/api/users/${viewingProfileId}/${action}`, {
                method: 'POST',
                body: JSON.stringify({ currentUserId: currentUser.uid })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to ${action} user.`);
            }
            
            console.log(`Successfully ${action} user`);
            
            // Refresh data after successful action
            await refetch();
            await onProfileUpdate();
        } catch (error) {
            console.error(`Error ${action} user:`, error);
            alert(`Failed to ${action}: ${error.message}`);
        }
    };
    
    const handlePictureUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        try {
            const response = await apiCall('/api/generate-upload-url', {
                method: 'POST',
                body: JSON.stringify({ fileName: file.name })
            });
            if (!response.ok) throw new Error('Failed to get upload URL');
            const { uploadUrl, blobName } = await response.json();
            const uploadResponse = await fetch(uploadUrl, {
                method: 'PUT',
                headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': file.type },
                body: file
            });
            if (!uploadResponse.ok) throw new Error('Failed to upload file');
            const permanentUrl = `https://${AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/profile-pictures/${blobName}`;
            const updateResponse = await apiCall(`/api/users/${currentUser.uid}`, {
                method: 'PUT',
                body: JSON.stringify({ profilePictureUrl: permanentUrl })
            });
            if (!updateResponse.ok) throw new Error('Failed to update profile picture');
            await refetch();
            await onProfileUpdate();
            alert('Profile picture updated!');
        } catch (error) {
            alert(error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setEditFormData(prev => ({ ...prev, [name]: value }));
    };
    const handleSkillsChange = (e) => {
        const skillsArray = e.target.value.split(',').map(skill => skill.trim()).filter(skill => skill);
        setEditFormData(prev => ({ ...prev, skills: skillsArray }));
    };
    const handleSocialChange = (e) => {
        const { name, value } = e.target;
        setEditFormData(prev => ({
            ...prev,
            socialLinks: { ...prev.socialLinks, [name]: value }
        }));
    };
    const handleSave = async () => {
        try {
            const dataToSave = {
                username: editFormData.username,
                displayName: editFormData.displayName,
                bio: editFormData.bio,
                headline: editFormData.headline,
                location: editFormData.location,
                skills: editFormData.skills,
                socialLinks: editFormData.socialLinks,
                profilePictureUrl: editFormData.profilePictureUrl
            };
            console.log('ProfilePage: Saving data:', dataToSave);
            const saveResponse = await apiCall(`/api/users/${auth.currentUser.uid}`, {
                method: 'PUT',
                body: JSON.stringify(dataToSave)
            });
            console.log('ProfilePage: Save response status:', saveResponse.status);
            if (!saveResponse.ok) {
                const errorText = await saveResponse.text();
                console.error('ProfilePage: Save error:', errorText);
                throw new Error('Failed to save profile');
            }
            await refetch();
            setIsEditing(false);
            alert('Profile updated successfully!');
        } catch (error) {
            alert('Failed to update profile.');
        }
    };

    if (isEditing && isOwnProfile) {
        // --- EDIT MODE ---
        return (
            <div style={{ padding: '20px', maxWidth: '600px', margin: 'auto' }}>
                <h2>Edit Profile</h2>
                <img src={editFormData.profilePictureUrl} alt={editFormData.displayName} style={{width: 100, height: 100, borderRadius: '50%'}} />
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handlePictureUpload} style={{ display: 'none' }} />
                <button onClick={() => fileInputRef.current.click()} disabled={uploading}>
                    {uploading ? 'Uploading...' : 'Change Picture'}
                </button>
                <hr style={{ margin: '20px 0' }}/>
                <label>Display Name:</label><br />
                <input type="text" name="displayName" value={editFormData.displayName || ''} onChange={handleInputChange} style={{width: '100%', padding: '8px'}}/><br /><br />
                <label>Headline:</label><br />
                <input type="text" name="headline" value={editFormData.headline || ''} onChange={handleInputChange} placeholder="e.g., Software Engineer" style={{width: '100%', padding: '8px'}}/><br /><br />
                <label>Bio:</label><br />
                <textarea name="bio" value={editFormData.bio || ''} onChange={handleInputChange} rows="4" style={{width: '100%', padding: '8px'}}></textarea><br /><br />
                <label>Location:</label><br />
                <input type="text" name="location" value={editFormData.location || ''} onChange={handleInputChange} placeholder="e.g., San Francisco, CA" style={{width: '100%', padding: '8px'}}/><br /><br />
                <label>Skills (comma-separated):</label><br />
                <input type="text" defaultValue={(editFormData.skills || []).join(', ')} onChange={handleSkillsChange} style={{width: '100%', padding: '8px'}}/><br /><br />
                <label>LinkedIn Profile URL:</label><br />
                <input type="text" name="linkedin" value={editFormData.socialLinks?.linkedin || ''} onChange={handleSocialChange} style={{width: '100%', padding: '8px'}}/><br /><br />
                <label>GitHub Profile URL:</label><br />
                <input type="text" name="github" value={editFormData.socialLinks?.github || ''} onChange={handleSocialChange} style={{width: '100%', padding: '8px'}}/><br /><br />
                <button onClick={handleSave} style={{padding: '10px 20px', marginRight: '10px'}}>Save Changes</button>
                <button onClick={() => setIsEditing(false)} style={{padding: '10px 20px'}}>Cancel</button>
            </div>
        );
    }

    // --- VIEW MODE ---
    const renderConnectionButtons = () => {
        if (isOwnProfile) {
            return (
                <button onClick={() => setIsEditing(true)} className="btn btn-primary">
                    ✏️ Edit Profile
                </button>
            );
        }
        
        if (isConnected) {
            return (
                <div className="d-flex gap-2">
                    <button disabled className="btn btn-success">
                        ✅ Connected
                    </button>
                    <button onClick={() => handleConnection('unfollow')} className="btn btn-outline">
                        Disconnect
                    </button>
                </div>
            );
        }
        
        if (hasReceivedRequest) {
            return (
                <div className="d-flex gap-2">
                    <button onClick={() => handleConnection('accept-connect')} className="btn btn-success">
                        ✅ Accept Request
                    </button>
                    <button onClick={() => handleConnection('reject-request')} className="btn btn-outline">
                        ❌ Decline
                    </button>
                </div>
            );
        }
        
        if (hasSentRequest) {
            return (
                <button onClick={() => handleConnection('cancel-request')} className="btn btn-secondary">
                    ⏳ Request Sent
                </button>
            );
        }

        return (
            <div className="d-flex gap-2">
                <button onClick={() => handleConnection('request-connect')} className="btn btn-primary">
                    🤝 Connect
                </button>
                {isFollowingCurrentUser ? (
                    <button onClick={() => handleConnection('unfollow')} className="btn btn-outline">
                        Unfollow
                    </button>
                ) : (
                    <button onClick={() => handleConnection('follow')} className="btn btn-secondary">
                        ➕ Follow
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className="edulink-app">
            {/* Navigation */}
            <nav className="navbar">
                <div className="navbar-content">
                    <button onClick={navigateToHome} className="btn btn-secondary">
                        ← Back to Home
                    </button>
                    <a href="#" className="navbar-brand">Profile</a>
                </div>
            </nav>

            {/* Profile Content - Full Width */}
            <div className="content-area" style={{ padding: 'var(--spacing-lg)', maxWidth: '100%', margin: '0' }}>
                <div className="card fade-in" style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    {/* Profile Header - Enhanced */}
                    <div className="profile-header" style={{ 
                        background: 'linear-gradient(135deg, var(--primary-50) 0%, var(--primary-100) 100%)',
                        padding: 'var(--spacing-xl)',
                        borderRadius: 'var(--border-radius-lg) var(--border-radius-lg) 0 0',
                        marginBottom: 'var(--spacing-lg)'
                    }}>
                        <div className="profile-info" style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 'var(--spacing-xl)',
                            flexWrap: 'wrap'
                        }}>
                            <div className="avatar avatar-xxl" style={{ flexShrink: 0 }}>
                                <img 
                                    src={viewedUserData.profilePictureUrl} 
                                    alt={viewedUserData.displayName} 
                                    className="avatar-img" 
                                    style={{ 
                                        width: '120px', 
                                        height: '120px',
                                        border: '4px solid white',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                                    }} 
                                />
                            </div>
                            <div className="profile-details" style={{ flex: 1, minWidth: '200px' }}>
                                <h1 style={{ 
                                    fontSize: '2.5rem', 
                                    fontWeight: 'var(--font-weight-bold)',
                                    margin: '0 0 var(--spacing-sm) 0',
                                    color: 'var(--text-primary)'
                                }}>
                                    {viewedUserData.displayName}
                                </h1>
                                <p className="username" style={{ 
                                    fontSize: 'var(--font-size-lg)', 
                                    opacity: 0.8,
                                    margin: '0 0 var(--spacing-md) 0'
                                }}>
                                    @{viewedUserData.username}
                                </p>
                                {viewedUserData.headline && (
                                    <p style={{ 
                                        fontSize: 'var(--font-size-lg)', 
                                        opacity: 0.9, 
                                        margin: '0 0 var(--spacing-md) 0',
                                        fontStyle: 'italic'
                                    }}>
                                        {viewedUserData.headline}
                                    </p>
                                )}
                                <div className="profile-stats" style={{ 
                                    display: 'flex', 
                                    gap: 'var(--spacing-lg)',
                                    marginTop: 'var(--spacing-md)'
                                }}>
                                    <div className="profile-stat" style={{ textAlign: 'center' }}>
                                        <span className="profile-stat-number" style={{ 
                                            display: 'block',
                                            fontSize: '1.5rem',
                                            fontWeight: 'var(--font-weight-bold)',
                                            color: 'var(--primary-600)'
                                        }}>
                                            {followers.length}
                                        </span>
                                        <span className="profile-stat-label" style={{ fontSize: 'var(--font-size-sm)' }}>
                                            Followers
                                        </span>
                                    </div>
                                    <div className="profile-stat" style={{ textAlign: 'center' }}>
                                        <span className="profile-stat-number" style={{ 
                                            display: 'block',
                                            fontSize: '1.5rem',
                                            fontWeight: 'var(--font-weight-bold)',
                                            color: 'var(--primary-600)'
                                        }}>
                                            {following.length}
                                        </span>
                                        <span className="profile-stat-label" style={{ fontSize: 'var(--font-size-sm)' }}>
                                            Following
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Profile Body - Enhanced Layout */}
                    <div className="card-body" style={{ padding: 'var(--spacing-xl)' }}>
                        {/* Connection Buttons */}
                        <div className="mb-3" style={{ 
                            textAlign: 'center', 
                            marginBottom: 'var(--spacing-xl)',
                            paddingBottom: 'var(--spacing-lg)',
                            borderBottom: '1px solid var(--border-color)'
                        }}>
                            {renderConnectionButtons()}
                        </div>

                        {/* Content Grid */}
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                            gap: 'var(--spacing-xl)'
                        }}>
                            {/* Left Column */}
                            <div>
                                {/* Bio */}
                                {viewedUserData.bio && (
                                    <div className="info-section" style={{ 
                                        marginBottom: 'var(--spacing-lg)',
                                        padding: 'var(--spacing-lg)',
                                        backgroundColor: 'var(--surface-secondary)',
                                        borderRadius: 'var(--border-radius-md)',
                                        border: '1px solid var(--border-color)'
                                    }}>
                                        <h3 style={{ 
                                            marginBottom: 'var(--spacing-md)',
                                            color: 'var(--text-primary)',
                                            fontSize: 'var(--font-size-lg)',
                                            fontWeight: 'var(--font-weight-semibold)'
                                        }}>
                                            📝 About
                                        </h3>
                                        <p style={{ 
                                            fontSize: 'var(--font-size-md)', 
                                            lineHeight: 1.6,
                                            margin: 0
                                        }}>
                                            {viewedUserData.bio}
                                        </p>
                                    </div>
                                )}
                                
                                {/* Location */}
                                {viewedUserData.location && (
                                    <div className="info-section" style={{ 
                                        marginBottom: 'var(--spacing-lg)',
                                        padding: 'var(--spacing-lg)',
                                        backgroundColor: 'var(--surface-secondary)',
                                        borderRadius: 'var(--border-radius-md)',
                                        border: '1px solid var(--border-color)'
                                    }}>
                                        <h3 style={{ 
                                            marginBottom: 'var(--spacing-md)',
                                            color: 'var(--text-primary)',
                                            fontSize: 'var(--font-size-lg)',
                                            fontWeight: 'var(--font-weight-semibold)'
                                        }}>
                                            📍 Location
                                        </h3>
                                        <p style={{ margin: 0, fontSize: 'var(--font-size-md)' }}>
                                            {viewedUserData.location}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Right Column */}
                            <div>
                                {/* Skills */}
                                {viewedUserData.skills && viewedUserData.skills.length > 0 && (
                                    <div className="info-section" style={{ 
                                        marginBottom: 'var(--spacing-lg)',
                                        padding: 'var(--spacing-lg)',
                                        backgroundColor: 'var(--surface-secondary)',
                                        borderRadius: 'var(--border-radius-md)',
                                        border: '1px solid var(--border-color)'
                                    }}>
                                        <h3 style={{ 
                                            marginBottom: 'var(--spacing-md)',
                                            color: 'var(--text-primary)',
                                            fontSize: 'var(--font-size-lg)',
                                            fontWeight: 'var(--font-weight-semibold)'
                                        }}>
                                            🛠️ Skills
                                        </h3>
                                        <div className="skills-container" style={{ 
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: 'var(--spacing-sm)'
                                        }}>
                                            {viewedUserData.skills.map((skill, index) => (
                                                <span key={index} className="skill-tag" style={{
                                                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                                                    backgroundColor: 'var(--primary-100)',
                                                    color: 'var(--primary-700)',
                                                    borderRadius: 'var(--border-radius-sm)',
                                                    fontSize: 'var(--font-size-sm)',
                                                    fontWeight: 'var(--font-weight-medium)',
                                                    border: '1px solid var(--primary-200)'
                                                }}>
                                                    {skill}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                {/* Social Links */}
                                {viewedUserData.socialLinks && (viewedUserData.socialLinks.linkedin || viewedUserData.socialLinks.github) && (
                                    <div className="info-section" style={{ 
                                        marginBottom: 'var(--spacing-lg)',
                                        padding: 'var(--spacing-lg)',
                                        backgroundColor: 'var(--surface-secondary)',
                                        borderRadius: 'var(--border-radius-md)',
                                        border: '1px solid var(--border-color)'
                                    }}>
                                        <h3 style={{ 
                                            marginBottom: 'var(--spacing-md)',
                                            color: 'var(--text-primary)',
                                            fontSize: 'var(--font-size-lg)',
                                            fontWeight: 'var(--font-weight-semibold)'
                                        }}>
                                            🌐 Social Links
                                        </h3>
                                        <div className="social-links" style={{ 
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 'var(--spacing-sm)'
                                        }}>
                                            {viewedUserData.socialLinks.linkedin && (
                                                <a 
                                                    href={viewedUserData.socialLinks.linkedin} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    className="social-link linkedin"
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 'var(--spacing-sm)',
                                                        padding: 'var(--spacing-sm) var(--spacing-md)',
                                                        backgroundColor: '#0077b5',
                                                        color: 'white',
                                                        textDecoration: 'none',
                                                        borderRadius: 'var(--border-radius-sm)',
                                                        fontSize: 'var(--font-size-sm)',
                                                        fontWeight: 'var(--font-weight-medium)',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                >
                                                    💼 LinkedIn
                                                </a>
                                            )}
                                            {viewedUserData.socialLinks.github && (
                                                <a 
                                                    href={viewedUserData.socialLinks.github} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    className="social-link github"
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 'var(--spacing-sm)',
                                                        padding: 'var(--spacing-sm) var(--spacing-md)',
                                                        backgroundColor: '#333',
                                                        color: 'white',
                                                        textDecoration: 'none',
                                                        borderRadius: 'var(--border-radius-sm)',
                                                        fontSize: 'var(--font-size-sm)',
                                                        fontWeight: 'var(--font-weight-medium)',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                >
                                                    💻 GitHub
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
