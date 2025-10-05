import React from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../App';
import { apiCall } from '../config/api';

export default function Poll({ poll, onPollUpdate, isPublicView = false }) {
    const navigate = useNavigate();
    const [userVotes, setUserVotes] = React.useState([]);
    const [isVoting, setIsVoting] = React.useState(false);
    const [showResults, setShowResults] = React.useState(false);
    
    const currentUserId = auth.currentUser?.uid;
    
    // Check if current user has voted and get their specific votes
    const currentUserVotes = poll.userVotes.filter(vote => vote.userId === currentUserId);
    const hasVoted = currentUserVotes.length > 0;
    const currentUserOptionIds = currentUserVotes.map(vote => vote.optionId);
    
    const isExpired = poll.expiresAt && new Date() > new Date(poll.expiresAt);
    const isOwner = poll.userId === currentUserId;
    
    // Calculate total votes
    const totalVotes = poll.options.reduce((sum, option) => sum + option.votes, 0);
    
    // Share function
    const handleShare = async () => {
        const pollUrl = `${window.location.origin}/poll/${poll.id}`;
        const shareData = {
            title: `Check out this poll on EduLink!`,
            text: poll.question,
            url: pollUrl,
        };
        try {
            if (navigator.share) await navigator.share(shareData);
            else {
                navigator.clipboard.writeText(shareData.url);
                alert('Link copied to clipboard!');
            }
        } catch (err) { console.error('Error sharing:', err); }
    };
    
    React.useEffect(() => {
        // Initialize user votes if they've already voted
        if (hasVoted) {
            setUserVotes(currentUserOptionIds);
            setShowResults(true);
        } else {
            setShowResults(false);
            setUserVotes([]);
        }
    }, [hasVoted, JSON.stringify(currentUserOptionIds)]);
    
    const handleVoteChange = (optionId) => {
        if (isExpired || isVoting) return;
        
        if (poll.allowMultipleVotes) {
            setUserVotes(prev => 
                prev.includes(optionId) 
                    ? prev.filter(id => id !== optionId)
                    : [...prev, optionId]
            );
        } else {
            setUserVotes([optionId]);
        }
    };
    
    const submitVote = async () => {
        if (userVotes.length === 0 || isVoting) return;
        
        setIsVoting(true);
        try {
            const response = await apiCall(`/api/polls/${poll.id}/vote`, {
                method: 'POST',
                body: JSON.stringify({
                    userId: currentUserId,
                    optionIds: userVotes
                })
            });
            
            if (response.ok) {
                setShowResults(true);
                // Add a delay before refreshing to ensure backend has processed the vote
                setTimeout(() => {
                    if (onPollUpdate) onPollUpdate();
                }, 500);
            } else {
                throw new Error('Failed to submit vote');
            }
        } catch (error) {
            console.error('Error voting:', error);
            alert('Failed to submit vote. Please try again.');
        } finally {
            setIsVoting(false);
        }
    };
    
    const deletePoll = async () => {
        if (!isOwner || !confirm('Are you sure you want to delete this poll?')) return;
        
        try {
            const response = await apiCall(`/api/polls/${poll.id}`, {
                method: 'DELETE',
                body: JSON.stringify({ userId: currentUserId })
            });
            
            if (response.ok) {
                if (onPollUpdate) onPollUpdate();
            } else {
                throw new Error('Failed to delete poll');
            }
        } catch (error) {
            console.error('Error deleting poll:', error);
            alert('Failed to delete poll. Please try again.');
        }
    };
    
    const formatTimeRemaining = (expiresAt) => {
        const now = new Date();
        const expiry = new Date(expiresAt);
        const diff = expiry - now;
        
        if (diff <= 0) return 'Expired';
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (days > 0) return `${days}d ${hours}h remaining`;
        if (hours > 0) return `${hours}h ${minutes}m remaining`;
        return `${minutes}m remaining`;
    };
    
    return (
        <div className="card poll-card">
            {/* Delete Button for Owner */}
            {isOwner && (
                <button 
                    onClick={deletePoll}
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
                    title="Delete Poll"
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

            <div className="card-header">
                <div className="d-flex align-items-center justify-content-between">
                    <div 
                        className="d-flex align-items-center gap-3"
                        onClick={() => navigate(`/profile/${poll.userId}`)}
                        style={{ cursor: 'pointer' }}
                    >
                        <div className="avatar">
                            <img 
                                src={poll.profilePictureUrl || 'https://via.placeholder.com/40'} 
                                alt={poll.displayName} 
                                className="avatar-img"
                            />
                        </div>
                        <div>
                            <h4 className="card-title mb-0">{poll.displayName}</h4>
                            <p className="card-subtitle">@{poll.username}</p>
                        </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        <span className="poll-badge">Poll</span>
                    </div>
                </div>
            </div>
            
            <div className="card-body">
                <h3 className="poll-question">{poll.question}</h3>
                {poll.description && (
                    <p className="poll-description">{poll.description}</p>
                )}
                
                <div className="poll-options">
                    {poll.options.map((option) => {
                        const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
                        const isSelected = userVotes.includes(option.optionId);
                        
                        return (
                            <div key={option.optionId} className="poll-option">
                                {!showResults && !isExpired ? (
                                    <label className={`poll-option-label ${isSelected ? 'selected' : ''} ${isPublicView ? 'disabled' : ''}`}>
                                        <input
                                            type={poll.allowMultipleVotes ? 'checkbox' : 'radio'}
                                            name={`poll-${poll.id}`}
                                            checked={isSelected}
                                            onChange={isPublicView ? () => alert('Please sign up to vote!') : () => handleVoteChange(option.optionId)}
                                            disabled={isVoting || isPublicView}
                                        />
                                        <span className="poll-option-text">{option.text}</span>
                                        {isPublicView && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginLeft: 'auto' }}>Sign up to vote</span>}
                                    </label>
                                ) : (
                                    <div className="poll-option-result">
                                        <div className="poll-option-header">
                                            <span className="poll-option-text">{option.text}</span>
                                            <span className="poll-option-stats">
                                                {option.votes} votes ({percentage.toFixed(1)}%)
                                            </span>
                                        </div>
                                        <div className="poll-progress">
                                            <div 
                                                className="poll-progress-bar"
                                                style={{ width: `${percentage}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                
                {!showResults && !isExpired && !isPublicView && (
                    <div className="poll-actions">
                        <button 
                            className="btn btn-primary"
                            onClick={submitVote}
                            disabled={userVotes.length === 0 || isVoting}
                        >
                            {isVoting ? 'Submitting...' : 'Submit Vote'}
                        </button>
                        {poll.allowMultipleVotes && (
                            <small className="text-muted ms-3">
                                You can select multiple options
                            </small>
                        )}
                    </div>
                )}
                
                <div className="poll-meta">
                    <div className="d-flex justify-content-between align-items-center">
                        <span className="poll-total-votes">
                            {totalVotes} total {totalVotes === 1 ? 'vote' : 'votes'}
                        </span>
                        <div className="d-flex align-items-center gap-3">
                            {poll.expiresAt && (
                                <span className={`poll-expiry ${isExpired ? 'expired' : ''}`}>
                                    {formatTimeRemaining(poll.expiresAt)}
                                </span>
                            )}
                            <span className="post-time">
                                {new Date(poll.createdAt).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                    {showResults && !hasVoted && (
                        <button 
                            className="btn btn-sm btn-outline-secondary mt-2"
                            onClick={() => setShowResults(false)}
                        >
                            Back to Vote
                        </button>
                    )}
                </div>
            </div>
            
            {/* Poll Action Buttons (Like, Comment, Share) */}
            <div className="post-actions">
                <button 
                    onClick={handleShare} 
                    className="post-action"
                >
                    <span>📤</span>
                    Share
                </button>
            </div>
        </div>
    );
}
