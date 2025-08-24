import React from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../App';

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
            const userDocRef = doc(db, 'users', userId);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) setAuthor(userDocSnap.data());
        };
        fetchAuthor();
    }, [userId]);

    if (!author) return <div style={{height: '50px'}}></div>;
    return (
        // **NEW**: Added onClick handler and cursor style
        <div onClick={() => navigateToProfile(userId)} style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src={author.profilePictureUrl} alt={author.displayName} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                <div>
                    <p style={{ margin: 0, fontWeight: 'bold', color: 'black' }}>{author.displayName}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#555' }}>@{author.username} · {formatTimestamp(timestamp)}</p>
                </div>
            </div>
        </div>
    );
}

function Comment({ comment, navigateToProfile }) {
    return (
        <div style={{fontSize: '14px', marginTop: '10px', borderTop: '1px solid #f0f0f0', paddingTop: '10px'}}>
            {/* **NEW**: Pass navigation function down */}
            <PostHeader userId={comment.userId} timestamp={comment.createdAt} navigateToProfile={navigateToProfile} />
            <p style={{marginLeft: '50px', marginTop: '5px', paddingBottom: '5px', color: 'black'}}>{comment.text}</p>
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
            await fetch(`https://edulink-g0gqgxhhezfjbzg4.southindia-01.azurewebsites.net/api/posts/${post.id}/like`, {
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
            const response = await fetch(`https://edulink-g0gqgxhhezfjbzg4.southindia-01.azurewebsites.net/api/posts/${post.id}/comment`, {
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
            const response = await fetch(`https://edulink-g0gqgxhhezfjbzg4.southindia-01.azurewebsites.net/api/posts/${post.id}`, {
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
        <div style={{ border: '1px solid #ddd', padding: '15px', marginBottom: '15px', background: 'white', borderRadius: '8px', position: 'relative' }}>
            {isAuthor && (
                <button 
                    onClick={handleDelete}
                    style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#555' }}
                    title="Delete Post"
                >
                    &times;
                </button>
            )}

            {/* **NEW**: Pass navigation function down */}
            <PostHeader userId={post.userId} timestamp={post.createdAt} navigateToProfile={navigateToProfile} />
            <p style={{color: '#1c1e21', whiteSpace: 'pre-wrap', wordWrap: 'break-word'}}>{post.description}</p>
            
            {imageUrls.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(200px, 1fr))`, gap: '5px', marginTop: '10px' }}>
                    {imageUrls.map((url, index) => (
                        <div key={index} style={{position: 'relative', width: '100%', paddingTop: '100%'}}>
                            <img src={url} alt={`Post content ${index + 1}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                        </div>
                    ))}
                </div>
            )}

            <div style={{ marginTop: '10px', display: 'flex', gap: '20px', color: '#555', fontSize: '14px' }}>
                <span>{likes.length} Likes</span>
                <span onClick={() => setShowComments(!showComments)} style={{cursor: 'pointer'}}>{comments.length} Comments</span>
            </div>
            <div style={{ marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '10px', display: 'flex', gap: '20px' }}>
                <button onClick={handleLike} style={{fontWeight: hasLiked ? 'bold' : 'normal', color: hasLiked ? '' : '#fff'}}>Like</button>
                <button onClick={() => setShowComments(!showComments)} style={{color: '#fff'}}>Comment</button>
                <button onClick={handleShare} style={{color: '#fff'}}>Share</button>
            </div>
            {showComments && (
                <div style={{marginTop: '10px'}}>
                    <form onSubmit={handleCommentSubmit} style={{display: 'flex', gap: '10px'}}>
                        <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Write a comment..." style={{flexGrow: 1, padding: '8px'}}/>
                        <button type="submit" style={{padding: '8px'}}>Post</button>
                    </form>
                    <div style={{marginTop: '10px'}}>
                        {comments.map((comment, index) => (
                            // **NEW**: Pass navigation function down
                            <Comment key={index} comment={comment} navigateToProfile={navigateToProfile} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
