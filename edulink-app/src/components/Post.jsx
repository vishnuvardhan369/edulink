import React from 'react';
import { auth } from '../App';
import { apiCall } from '../config/api';

// Helper function to format the timestamp
function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

function PostHeader({ userId, timestamp, navigateToProfile }) {
    const [author, setAuthor] = React.useState(null);
    React.useEffect(() => {
        const fetchAuthor = async () => {
            if (!userId) return;
            try {
                const response = await apiCall(`/api/users/${userId}`);
                if (response.ok) {
                    const userData = await response.json();
                    setAuthor(userData);
                }
            } catch (error) {
                console.error('Error fetching user:', error);
            }
        };
        fetchAuthor();
    }, [userId]);

    if (!author) return <div className="loading" style={{height: '50px'}}></div>;
    
    return (
        <div onClick={() => navigateToProfile(userId)} 
             className="post-author-container" 
             style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
             onMouseEnter={(e) => e.target.style.opacity = '0.8'}
             onMouseLeave={(e) => e.target.style.opacity = '1'}>
            <div className="d-flex align-items-center gap-3">
                <div className="avatar">
                    <img src={author.profilePictureUrl} alt={author.displayName} className="avatar-img" />
                </div>
                <div className="post-author">
                    <div className="post-author-name">{author.displayName}</div>
                    <div className="post-author-handle">@{author.username} · {formatTimestamp(timestamp)}</div>
                </div>
            </div>
        </div>
    );
}

function Comment({ comment, navigateToProfile }) {
    return (
        <div className="comment" style={{
            fontSize: 'var(--font-size-sm)', 
            marginTop: 'var(--spacing-sm)', 
            borderTop: '1px solid var(--border-color)', 
            paddingTop: 'var(--spacing-sm)'
        }}>
            <PostHeader userId={comment.userId} timestamp={comment.createdAt} navigateToProfile={navigateToProfile} />
            <p style={{
                marginLeft: '50px', 
                marginTop: 'var(--spacing-xs)', 
                paddingBottom: 'var(--spacing-xs)', 
                color: 'var(--text-primary)',
                lineHeight: 1.4
            }}>
                {comment.text}
            </p>
        </div>
    );
}

export default function Post({ post, onPostUpdate, onPostDelete, navigateToProfile }) { // Added onPostDelete prop
    const [commentText, setCommentText] = React.useState('');
    const [showComments, setShowComments] = React.useState(false);
    const currentUser = auth.currentUser;

    const likes = post.likes || [];
    const comments = post.comments || [];
    const imageUrls = post.imageUrls || [];
    const hasLiked = currentUser ? likes.includes(currentUser.uid) : false;
    const isAuthor = currentUser ? currentUser.uid === post.userId : false;


    const handleLike = async () => {
        if (!currentUser) return;
        onPostUpdate({
            ...post,
            likes: hasLiked 
                ? likes.filter(uid => uid !== currentUser.uid)
                : [...likes, currentUser.uid]
        });
        try {
            await apiCall(`/api/posts/${post.id}/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ userId: currentUser.uid })
            });
        } catch (error) {
            console.error("Failed to update like status:", error);
        }
    };

    const handleCommentSubmit = async (e) => {
        e.preventDefault();
        if (!commentText.trim() || !currentUser) return;
        const textToSubmit = commentText;
        setCommentText('');
        try {
            const response = await apiCall(`/api/posts/${post.id}/comment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ userId: currentUser.uid, text: textToSubmit })
            });
            if (!response.ok) throw new Error("Failed to post comment");
            const updatedPost = await response.json();
            onPostUpdate(updatedPost);
        } catch (error) {
            alert('Failed to post comment.');
        }
    };
    
    const handleShare = async () => {
        const shareData = {
            title: `Check out this post on EduLink!`,
            text: post.description,
            url: window.location.href,
        };
        try {
            if (navigator.share) await navigator.share(shareData);
            else {
                navigator.clipboard.writeText(shareData.url);
                alert('Link copied to clipboard!');
            }
        } catch (err) { console.error('Error sharing:', err); }
    };

    // **NEW**: Function to handle deleting a post
    const handleDelete = async () => {
        if (!window.confirm("Are you sure you want to delete this post? This action cannot be undone.")) {
            return;
        }
        try {
            const response = await apiCall(`/api/posts/${post.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ userId: currentUser.uid })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete post.');
            }
            onPostDelete(post.id);
        } catch (error) {
            console.error("Delete failed:", error);
            alert(error.message);
        }
    };

    return (
        <div className="post">
            {/* Delete Button for Author */}
            {isAuthor && (
                <button 
                    onClick={handleDelete}
                    className="btn btn-sm"
                    style={{ 
                        position: 'absolute', 
                        top: 'var(--spacing-sm)', 
                        right: 'var(--spacing-sm)', 
                        background: 'none', 
                        border: 'none', 
                        fontSize: '20px', 
                        cursor: 'pointer', 
                        color: 'var(--text-secondary)',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    title="Delete Post"
                    onMouseEnter={(e) => {
                        e.target.style.backgroundColor = 'var(--error-color)';
                        e.target.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.backgroundColor = 'transparent';
                        e.target.style.color = 'var(--text-secondary)';
                    }}
                >
                    &times;
                </button>
            )}

            {/* Post Header */}
            <div className="post-header">
                <PostHeader userId={post.userId} timestamp={post.createdAt} navigateToProfile={navigateToProfile} />
            </div>
            
            {/* Post Content */}
            <div className="post-content">
                <div className="post-text">{post.description}</div>
                
                {/* Post Images */}
                {imageUrls.length > 0 && (
                    <div className="post-image-grid">
                        {imageUrls.map((url, index) => (
                            <div key={index} className="post-image-wrapper">
                                <img src={url} alt={`Post content ${index + 1}`} className="post-image" />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Post Stats */}
            <div style={{ 
                padding: 'var(--spacing-sm) var(--spacing-md)', 
                display: 'flex', 
                gap: 'var(--spacing-lg)', 
                color: 'var(--text-secondary)', 
                fontSize: 'var(--font-size-sm)',
                borderBottom: '1px solid var(--border-color)'
            }}>
                <span>{likes.length} {likes.length === 1 ? 'Like' : 'Likes'}</span>
                <span 
                    onClick={() => setShowComments(!showComments)} 
                    style={{cursor: 'pointer'}}
                    className="post-stat-clickable"
                >
                    {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
                </span>
            </div>
            
            {/* Post Actions */}
            <div className="post-actions">
                <button 
                    onClick={handleLike} 
                    className={`post-action ${hasLiked ? 'liked' : ''}`}
                >
                    <span>{hasLiked ? '❤️' : '🤍'}</span>
                    Like
                </button>
                <button 
                    onClick={() => setShowComments(!showComments)} 
                    className="post-action"
                >
                    <span>💬</span>
                    Comment
                </button>
                <button 
                    onClick={handleShare} 
                    className="post-action"
                >
                    <span>📤</span>
                    Share
                </button>
            </div>
            
            {/* Comments Section */}
            {showComments && (
                <div className="card-footer">
                    <form onSubmit={handleCommentSubmit} className="d-flex gap-2 mb-3">
                        <input 
                            type="text" 
                            value={commentText} 
                            onChange={(e) => setCommentText(e.target.value)} 
                            placeholder="Write a comment..." 
                            className="form-control"
                            style={{flexGrow: 1}}
                        />
                        <button type="submit" className="btn btn-primary btn-sm">
                            Post
                        </button>
                    </form>
                    <div className="comments-list">
                        {comments.map((comment, index) => (
                            <Comment key={index} comment={comment} navigateToProfile={navigateToProfile} />
                        ))}
                        {comments.length === 0 && (
                            <p style={{ 
                                textAlign: 'center', 
                                color: 'var(--text-secondary)', 
                                fontStyle: 'italic',
                                margin: 'var(--spacing-md) 0'
                            }}>
                                No comments yet. Be the first to comment!
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
