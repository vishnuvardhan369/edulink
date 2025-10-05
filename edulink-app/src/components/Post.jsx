import React from 'react';
import { useNavigate } from 'react-router-dom';
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

function PostHeader({ userId, timestamp }) {
    const [author, setAuthor] = React.useState(null);
    const navigate = useNavigate();
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
        <div onClick={() => navigate(`/profile/${userId}`)} 
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

function Comment({ comment, onCommentDelete, currentUserId }) {
    const navigate = useNavigate();
    const isCommentAuthor = currentUserId === comment.userId;
    
    const handleDeleteComment = async () => {
        if (!window.confirm("Are you sure you want to delete this comment?")) {
            return;
        }
        if (onCommentDelete) {
            onCommentDelete(comment.commentId || comment.id);
        }
    };
    
    return (
        <div className="comment" style={{
            fontSize: 'var(--font-size-sm)', 
            marginTop: 'var(--spacing-sm)', 
            borderTop: '1px solid var(--border-color)', 
            paddingTop: 'var(--spacing-sm)',
            position: 'relative'
        }}>
            {isCommentAuthor && (
                <button 
                    onClick={handleDeleteComment}
                    className="btn btn-sm"
                    style={{ 
                        position: 'absolute', 
                        top: 'var(--spacing-xs)', 
                        right: 'var(--spacing-xs)', 
                        background: 'none', 
                        border: 'none', 
                        fontSize: '16px', 
                        cursor: 'pointer', 
                        color: 'var(--text-secondary)',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    title="Delete Comment"
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
            <PostHeader userId={comment.userId} timestamp={comment.createdAt} />
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

export default function Post({ post, onPostUpdate, onPostDelete, isPublicView = false }) { // Added onPostDelete prop
    const [commentText, setCommentText] = React.useState('');
    const [showComments, setShowComments] = React.useState(false);
    const currentUser = auth.currentUser;

    const likes = post.likes || [];
    const comments = post.comments || [];
    const imageUrls = post.imageUrls || [];
    
    // Fix like checking logic - likes array contains objects with userId property
    const hasLiked = currentUser ? likes.some(like => like.userId === currentUser.uid) : false;
    const isAuthor = currentUser ? currentUser.uid === post.userId : false;

    const handleLike = async () => {
        if (!currentUser) return;
        
        try {
            const response = await apiCall(`/api/posts/${post.id}/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ userId: currentUser.uid })
            });
            
            if (response.ok) {
                // Update the post state based on current like status
                const newLikes = hasLiked 
                    ? likes.filter(like => like.userId !== currentUser.uid)
                    : [...likes, { userId: currentUser.uid }];
                    
                onPostUpdate({
                    ...post,
                    likes: newLikes
                });
            }
        } catch (error) {
            console.error("Failed to update like status:", error);
        }
    };

    const handleCommentSubmit = async (e) => {
        e.preventDefault();
        if (!commentText.trim() || !currentUser) return;
        
        const textToSubmit = commentText;
        
        try {
            const response = await apiCall(`/api/posts/${post.id}/comment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ userId: currentUser.uid, text: textToSubmit })
            });
            if (!response.ok) throw new Error("Failed to post comment");
            
            // Only clear the comment text AFTER successful response
            setCommentText('');
            const updatedPost = await response.json();
            onPostUpdate(updatedPost);
        } catch (error) {
            console.error('Error posting comment:', error);
            alert('Failed to post comment.');
            // Don't clear comment text on error so user can retry
        }
    };
    
    const handleShare = async () => {
        const postUrl = `${window.location.origin}/post/${post.id}`;
        const shareData = {
            title: `Check out this post on EduLink!`,
            text: post.description,
            url: postUrl,
        };
        try {
            if (navigator.share) await navigator.share(shareData);
            else {
                navigator.clipboard.writeText(shareData.url);
                alert('Link copied to clipboard!');
            }
        } catch (err) { console.error('Error sharing:', err); }
    };

    // **NEW**: Function to handle deleting a comment
    const handleCommentDelete = async (commentId) => {
        try {
            const response = await apiCall(`/api/comments/${commentId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ userId: currentUser.uid })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete comment.');
            }
            
            // Update the post to remove the deleted comment
            const updatedComments = comments.filter(comment => 
                (comment.commentId || comment.id) !== commentId
            );
            onPostUpdate({
                ...post,
                comments: updatedComments
            });
        } catch (error) {
            console.error("Comment delete failed:", error);
            alert(error.message);
        }
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
                        top: 'var(--spacing-md)', 
                        right: 'var(--spacing-md)', 
                        background: 'var(--bg-card)', 
                        border: '1px solid var(--border-color)', 
                        fontSize: '18px', 
                        cursor: 'pointer', 
                        color: 'var(--text-secondary)',
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10,
                        boxShadow: 'var(--shadow-sm)'
                    }}
                    title="Delete Post"
                    onMouseEnter={(e) => {
                        e.target.style.backgroundColor = 'var(--error-color)';
                        e.target.style.color = 'white';
                        e.target.style.borderColor = 'var(--error-color)';
                        e.target.style.transform = 'scale(1.1)';
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.backgroundColor = 'var(--bg-card)';
                        e.target.style.color = 'var(--text-secondary)';
                        e.target.style.borderColor = 'var(--border-color)';
                        e.target.style.transform = 'scale(1)';
                    }}
                >
                    ✕
                </button>
            )}

            {/* Post Header */}
            <div className="post-header">
                <PostHeader userId={post.userId} timestamp={post.createdAt} />
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
                    onClick={isPublicView ? () => alert('Please sign up to like posts!') : handleLike} 
                    className={`post-action ${hasLiked ? 'liked' : ''}`}
                    disabled={isPublicView}
                    style={isPublicView ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                >
                    <span>{hasLiked ? '❤️' : '🤍'}</span>
                    Like
                </button>
                <button 
                    onClick={isPublicView ? () => alert('Please sign up to comment!') : () => setShowComments(!showComments)} 
                    className="post-action"
                    disabled={isPublicView}
                    style={isPublicView ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
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
                    {!isPublicView && (
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
                    )}
                    <div className="comments-list">
                        {comments.map((comment, index) => (
                            <Comment 
                                key={comment.commentId || comment.id || index} 
                                comment={comment} 
                                onCommentDelete={handleCommentDelete}
                                currentUserId={currentUser?.uid}
                            />
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
