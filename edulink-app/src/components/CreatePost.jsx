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

        // **FIX**: Enforce 5-image limit
        if (imageFiles.length + newFiles.length > 5) {
            alert("You can only upload a maximum of 5 images per post.");
            return;
        }

        // **FIX**: Append new files to the existing list
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
        <div style={{ border: '1px solid #ccc', padding: '15px', marginBottom: '20px', background: 'white', borderRadius: '8px' }}>
            <h3>Create a New Post</h3>
            <form onSubmit={handleSubmit}>
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What's on your mind?"
                    rows="4"
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
                <input 
                    type="file" 
                    accept="image/*" 
                    multiple
                    onChange={handleImageChange}
                    ref={fileInputRef}
                    style={{ margin: '10px 0' }}
                />
                
                {/* Display list of selected files */}
                {imageFiles.length > 0 && (
                    <div style={{marginBottom: '10px'}}>
                        <p>Selected files ({imageFiles.length}/5):</p>
                        <ul style={{listStyle: 'none', padding: 0}}>
                            {imageFiles.map((file, index) => (
                                <li key={index} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', padding: '2px 0'}}>
                                    <span>{file.name}</span>
                                    <button type="button" onClick={() => removeImage(index)} style={{background: 'none', border: 'none', color: 'red', cursor: 'pointer'}}>X</button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                
                {error && <p style={{ color: 'red' }}>{error}</p>}

                <button type="submit" disabled={uploading} style={{ padding: '10px 20px' }}>
                    {uploading ? 'Posting...' : 'Post'}
                </button>
            </form>
        </div>
    );
}
