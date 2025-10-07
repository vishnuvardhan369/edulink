import React from 'react';
import { auth } from '../App';
import { apiCall } from '../config/api';

export default function CreatePost({ onPostCreated }) {
    const [description, setDescription] = React.useState('');
    const [imageFiles, setImageFiles] = React.useState([]);
    const [uploading, setUploading] = React.useState(false);
    const [error, setError] = React.useState('');
    const fileInputRef = React.useRef(null);
    
    const AZURE_STORAGE_ACCOUNT_NAME = "edulinkdata";

    const handleImageChange = (e) => {
        const newFiles = Array.from(e.target.files);
        if (newFiles.length === 0) return;

        if (imageFiles.length + newFiles.length > 5) {
            alert("You can only upload a maximum of 5 images per post.");
            return;
        }

        setImageFiles(prevFiles => [...prevFiles, ...newFiles]);
    };
    
    const removeImage = (indexToRemove) => {
        setImageFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!description.trim()) {
            setError('Post description cannot be empty.');
            return;
        }
        setUploading(true);
        setError('');

        try {
            let uploadedImageUrls = [];

            if (imageFiles.length > 0) {
                const uploadPromises = imageFiles.map(async (file) => {
                    const urlResponse = await apiCall('/api/generate-post-upload-url', {
                        method: 'POST',
                        credentials: 'include',
                        body: JSON.stringify({ fileName: file.name, fileType: file.type })
                    });
                    if (!urlResponse.ok) throw new Error(`Failed to get upload URL for ${file.name}.`);
                    const { uploadUrl, blobName } = await urlResponse.json();

                    const uploadResponse = await fetch(uploadUrl, {
                        method: 'PUT',
                        headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': file.type },
                        body: file
                    });
                    if (!uploadResponse.ok) throw new Error(`Failed to upload ${file.name}.`);
                    
                    return `https://${AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/post-images/${blobName}`;
                });
                
                uploadedImageUrls = await Promise.all(uploadPromises);
            }

            const postData = {
                userId: auth.currentUser.uid,
                description: description,
                imageUrls: uploadedImageUrls
            };

            const postResponse = await apiCall('/api/posts', {
                method: 'POST',
                credentials: 'include',
                body: JSON.stringify(postData)
            });
            if (!postResponse.ok) throw new Error('Failed to create post on server.');

            setDescription('');
            setImageFiles([]);
            fileInputRef.current.value = null;
            onPostCreated();

        } catch (err) {
            console.error("Post creation failed:", err);
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div>
            <div className="d-flex align-items-center gap-3 mb-3">
                <div className="avatar">
                    <img 
                        src={auth.currentUser?.photoURL || 'https://via.placeholder.com/40'} 
                        alt="Your profile" 
                        className="avatar-img" 
                    />
                </div>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
                    ✨ Create a Post
                </h3>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="What's on your mind? Share your thoughts, insights, or updates..."
                        rows="4"
                        className="form-control textarea"
                        style={{ resize: 'vertical', minHeight: '100px', color: 'var(--text-primary)', backgroundColor: 'var(--bg-primary)' }}
                    />
                </div>
                
                <div className="d-flex align-items-center gap-3 mb-3">
                    <label htmlFor="image-upload" className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                        📷 Add Images ({imageFiles.length}/5)
                    </label>
                    <input 
                        id="image-upload"
                        type="file" 
                        accept="image/*" 
                        multiple
                        onChange={handleImageChange}
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                    />
                    {imageFiles.length > 0 && (
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                            {imageFiles.length} image{imageFiles.length !== 1 ? 's' : ''} selected
                        </span>
                    )}
                </div>
                
                {imageFiles.length > 0 && (
                    <div className="mb-3">
                        <div style={{ 
                            background: 'var(--bg-secondary)', 
                            borderRadius: 'var(--border-radius)', 
                            padding: 'var(--spacing-sm)' 
                        }}>
                            <p style={{ 
                                margin: '0 0 var(--spacing-xs) 0', 
                                fontSize: 'var(--font-size-sm)', 
                                fontWeight: 'var(--font-weight-medium)' 
                            }}>
                                📁 Selected Images:
                            </p>
                            <div className="d-flex flex-wrap gap-2">
                                {imageFiles.map((file, index) => (
                                    <div key={index} 
                                         className="d-flex align-items-center gap-2"
                                         style={{
                                             background: 'var(--bg-card)',
                                             padding: 'var(--spacing-xs) var(--spacing-sm)',
                                             borderRadius: 'var(--border-radius)',
                                             border: '1px solid var(--border-color)',
                                             fontSize: 'var(--font-size-xs)'
                                         }}>
                                        <span>{file.name}</span>
                                        <button 
                                            type="button" 
                                            onClick={() => removeImage(index)}
                                            className="btn btn-sm"
                                            style={{ 
                                                background: 'none', 
                                                border: 'none', 
                                                color: 'var(--error-color)', 
                                                cursor: 'pointer',
                                                padding: '2px',
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                            onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--error-color)'}
                                            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                
                {error && (
                    <div className="mb-3" style={{ 
                        background: 'var(--error-color)', 
                        color: 'white', 
                        padding: 'var(--spacing-sm) var(--spacing-md)', 
                        borderRadius: 'var(--border-radius)', 
                        fontSize: 'var(--font-size-sm)' 
                    }}>
                        <strong>Error:</strong> {error}
                    </div>
                )}

                <div className="d-flex justify-content-between align-items-center">
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                        {description.length}/500 characters
                    </div>
                    <button 
                        type="submit" 
                        disabled={uploading || !description.trim()} 
                        className={`btn ${uploading ? 'btn-secondary' : 'btn-primary'} btn-lg`}
                    >
                        {uploading ? (
                            <>
                                <div className="spinner" style={{ width: '16px', height: '16px', marginRight: '8px' }}></div>
                                Posting...
                            </>
                        ) : (
                            <>
                                🚀 Share Post
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
