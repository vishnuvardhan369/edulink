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

    if (profileLoading || !editFormData) return <div>Loading profile...</div>;
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
            const response = await apiCall(`/api/users/${viewingProfileId}/${action}`, {
                method: 'POST',
                body: JSON.stringify({ currentUserId: currentUser.uid })
            });
            if (!response.ok) throw new Error(`Failed to ${action} user.`);
            await refetch();
            await onProfileUpdate();
        } catch (error) {
            alert(error.message);
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
                profilePictureUrl: editFormData.profilePictureUrl,
                headline: editFormData.headline,
                location: editFormData.location,
                skills: editFormData.skills,
                socialLinks: editFormData.socialLinks
            };
            const saveResponse = await apiCall(`/api/users/${auth.currentUser.uid}`, {
                method: 'PUT',
                body: JSON.stringify(dataToSave)
            });
            if (!saveResponse.ok) throw new Error('Failed to save profile');
            
            // Refresh both the viewed profile data and current user data
            await refetch();
            await onProfileUpdate();
            setIsEditing(false);
            alert('Profile updated successfully!');
        } catch (error) {
            console.error('Error updating profile:', error);
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
        if (isOwnProfile) return <button onClick={() => setIsEditing(true)}>Edit Profile</button>;
        if (isConnected) return <button disabled>Connected</button>;
        if (hasReceivedRequest) return <button onClick={() => handleConnection('accept-connect')}>Accept Request</button>;
        if (hasSentRequest) return <button onClick={() => handleConnection('cancel-request')}>Request Sent</button>;

        return (
            <div style={{display: 'flex', gap: '10px'}}>
                <button onClick={() => handleConnection('request-connect')}>Connect</button>
                {isFollowingCurrentUser ? (
                    <button onClick={() => handleConnection('unfollow')}>Following</button>
                ) : (
                    <button onClick={() => handleConnection('follow')}>Follow</button>
                )}
            </div>
        );
    };

    return (
        <div style={{ padding: '20px', maxWidth: '700px', margin: 'auto', fontFamily: 'sans-serif' }}>
            <button onClick={navigateToHome} style={{marginBottom: '20px'}}>&larr; Back to Home</button>
            <div style={{display: 'flex', alignItems: 'center', gap: '20px'}}>
                <img src={viewedUserData.profilePictureUrl} alt={viewedUserData.displayName} style={{width: 120, height: 120, borderRadius: '50%', objectFit: 'cover'}} />
                <div>
                    <h1 style={{margin: 0}}>{viewedUserData.displayName}</h1>
                    <p style={{margin: 0, color: '#555'}}>@{viewedUserData.username}</p>
                    {viewedUserData.headline && <h3 style={{margin: '5px 0', fontWeight: 'normal'}}>{viewedUserData.headline}</h3>}
                    <div style={{display: 'flex', gap: '20px', marginTop: '10px'}}>
                        <span><strong>{followers.length}</strong> Followers</span>
                        <span><strong>{following.length}</strong> Following</span>
                    </div>
                </div>
            </div>
            <div style={{margin: '20px 0'}}>
                {renderConnectionButtons()}
            </div>
            {viewedUserData.bio && <p>{viewedUserData.bio}</p>}
            
            {/* Display Location */}
            {viewedUserData.location && (
                <div style={{marginTop: '15px'}}>
                    <strong>📍 Location:</strong> {viewedUserData.location}
                </div>
            )}
            
            {/* Display Skills */}
            {viewedUserData.skills && viewedUserData.skills.length > 0 && (
                <div style={{marginTop: '15px'}}>
                    <strong>🛠️ Skills:</strong>
                    <div style={{marginTop: '5px'}}>
                        {viewedUserData.skills.map((skill, index) => (
                            <span key={index} style={{
                                display: 'inline-block',
                                backgroundColor: '#e3f2fd',
                                color: '#1976d2',
                                padding: '4px 8px',
                                margin: '2px',
                                borderRadius: '4px',
                                fontSize: '14px'
                            }}>
                                {skill}
                            </span>
                        ))}
                    </div>
                </div>
            )}
            
            {/* Display Social Links */}
            {viewedUserData.socialLinks && (viewedUserData.socialLinks.linkedin || viewedUserData.socialLinks.github) && (
                <div style={{marginTop: '15px'}}>
                    <strong>🌐 Social Links:</strong>
                    <div style={{marginTop: '5px'}}>
                        {viewedUserData.socialLinks.linkedin && (
                            <a href={viewedUserData.socialLinks.linkedin} target="_blank" rel="noopener noreferrer" style={{
                                display: 'inline-block',
                                margin: '5px 10px 5px 0',
                                padding: '8px 12px',
                                backgroundColor: '#0077b5',
                                color: 'white',
                                textDecoration: 'none',
                                borderRadius: '4px',
                                fontSize: '14px'
                            }}>
                                LinkedIn
                            </a>
                        )}
                        {viewedUserData.socialLinks.github && (
                            <a href={viewedUserData.socialLinks.github} target="_blank" rel="noopener noreferrer" style={{
                                display: 'inline-block',
                                margin: '5px 10px 5px 0',
                                padding: '8px 12px',
                                backgroundColor: '#333',
                                color: 'white',
                                textDecoration: 'none',
                                borderRadius: '4px',
                                fontSize: '14px'
                            }}>
                                GitHub
                            </a>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
