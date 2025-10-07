import React from 'react';
import { auth } from '../App';
import { apiCall } from '../config/api';

export default function CreatePoll({ onPollCreated }) {
    const [question, setQuestion] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [options, setOptions] = React.useState(['', '']);
    const [allowMultipleVotes, setAllowMultipleVotes] = React.useState(false);
    const [hasExpiry, setHasExpiry] = React.useState(false);
    const [expiryDays, setExpiryDays] = React.useState(7);
    const [creating, setCreating] = React.useState(false);
    const [error, setError] = React.useState('');
    
    const handleOptionChange = (index, value) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };
    
    const addOption = () => {
        if (options.length < 20) {
            setOptions([...options, '']);
        }
    };
    
    const removeOption = (index) => {
        if (options.length > 2) {
            setOptions(options.filter((_, i) => i !== index));
        }
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        // Validation
        if (!question.trim()) {
            setError('Poll question is required.');
            return;
        }
        
        const validOptions = options.filter(opt => opt.trim());
        if (validOptions.length < 2) {
            setError('At least 2 options are required.');
            return;
        }
        
        if (validOptions.length > 20) {
            setError('Maximum 20 options allowed.');
            return;
        }
        
        setCreating(true);
        
        try {
            const pollData = {
                userId: auth.currentUser.uid,
                question: question.trim(),
                description: description.trim() || null,
                options: validOptions,
                allowMultipleVotes,
                expiresAt: hasExpiry ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString() : null
            };
            
            const response = await apiCall('/api/polls', {
                method: 'POST',
                body: JSON.stringify(pollData)
            });
            
            if (!response.ok) {
                throw new Error('Failed to create poll');
            }
            
            // Reset form
            setQuestion('');
            setDescription('');
            setOptions(['', '']);
            setAllowMultipleVotes(false);
            setHasExpiry(false);
            setExpiryDays(7);
            
            onPollCreated();
            
        } catch (err) {
            console.error('Poll creation failed:', err);
            setError(err.message);
        } finally {
            setCreating(false);
        }
    };
    
    return (
        <div className="create-poll-container">
            <div className="d-flex align-items-center gap-3 mb-3">
                <div className="avatar">
                    <img 
                        src={auth.currentUser?.photoURL || 'https://via.placeholder.com/40'} 
                        alt="Your profile" 
                        className="avatar-img" 
                    />
                </div>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
                    Create a Poll
                </h3>
            </div>
            
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="poll-question" className="form-label" style={{ color: 'var(--text-primary)' }}>
                        Poll Question *
                    </label>
                    <input
                        id="poll-question"
                        type="text"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="What would you like to ask?"
                        className="form-control"
                        maxLength="200"
                        style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-primary)' }}
                    />
                    <small className="text-muted" style={{ color: 'var(--text-secondary)' }}>{question.length}/200 characters</small>
                </div>
                
                <div className="form-group">
                    <label htmlFor="poll-description" className="form-label" style={{ color: 'var(--text-primary)' }}>
                        Description (Optional)
                    </label>
                    <textarea
                        id="poll-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Add more context to your poll..."
                        rows="3"
                        className="form-control"
                        maxLength="500"
                        style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-primary)' }}
                    />
                    <small className="text-muted" style={{ color: 'var(--text-secondary)' }}>{description.length}/500 characters</small>
                </div>
                
                <div className="form-group">
                    <label className="form-label" style={{ color: 'var(--text-primary)' }}>
                        Poll Options * (2-20 options)
                    </label>
                    <div className="poll-options-container">
                        {options.map((option, index) => (
                            <div key={index} className="poll-option-input">
                                <input
                                    type="text"
                                    value={option}
                                    onChange={(e) => handleOptionChange(index, e.target.value)}
                                    placeholder={`Option ${index + 1}`}
                                    className="form-control"
                                    maxLength="100"
                                    style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-primary)' }}
                                />
                                {options.length > 2 && (
                                    <button
                                        type="button"
                                        onClick={() => removeOption(index)}
                                        className="btn btn-sm btn-outline-danger"
                                        style={{ minWidth: '60px' }}
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                        ))}
                        
                        {options.length < 20 && (
                            <button
                                type="button"
                                onClick={addOption}
                                className="btn btn-sm btn-outline-primary"
                                style={{ alignSelf: 'flex-start' }}
                            >
                                + Add Option
                            </button>
                        )}
                    </div>
                </div>
                
                <div className="form-group">
                    <div className="poll-settings">
                        <div className="setting-item">
                            <label className="checkbox-label" style={{ color: 'var(--text-primary)' }}>
                                <input
                                    type="checkbox"
                                    checked={allowMultipleVotes}
                                    onChange={(e) => setAllowMultipleVotes(e.target.checked)}
                                />
                                <span>Allow multiple votes per person</span>
                            </label>
                        </div>
                        
                        <div className="setting-item">
                            <label className="checkbox-label" style={{ color: 'var(--text-primary)' }}>
                                <input
                                    type="checkbox"
                                    checked={hasExpiry}
                                    onChange={(e) => setHasExpiry(e.target.checked)}
                                />
                                <span>Set expiration date</span>
                            </label>
                            
                            {hasExpiry && (
                                <div className="expiry-settings">
                                    <label htmlFor="expiry-days" className="form-label" style={{ color: 'var(--text-primary)' }}>
                                        Poll expires in:
                                    </label>
                                    <select
                                        id="expiry-days"
                                        value={expiryDays}
                                        onChange={(e) => setExpiryDays(Number(e.target.value))}
                                        className="form-control"
                                        style={{ width: 'auto', display: 'inline-block', color: 'var(--text-primary)', backgroundColor: 'var(--bg-primary)' }}
                                    >
                                        <option value={1}>1 day</option>
                                        <option value={3}>3 days</option>
                                        <option value={7}>1 week</option>
                                        <option value={14}>2 weeks</option>
                                        <option value={30}>1 month</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                
                {error && (
                    <div className="mb-3 alert alert-danger">
                        {error}
                    </div>
                )}
                
                <div className="d-flex justify-content-between align-items-center">
                    <div className="poll-summary">
                        <small className="text-muted" style={{ color: 'var(--text-secondary)' }}>
                            {options.filter(opt => opt.trim()).length} options • 
                            {allowMultipleVotes ? ' Multiple votes' : ' Single vote'} • 
                            {hasExpiry ? ` Expires in ${expiryDays} days` : ' No expiration'}
                        </small>
                    </div>
                    <button 
                        type="submit" 
                        disabled={creating || !question.trim() || options.filter(opt => opt.trim()).length < 2} 
                        className={`btn ${creating ? 'btn-secondary' : 'btn-primary'} btn-lg`}
                    >
                        {creating ? (
                            <>
                                <div className="spinner" style={{ width: '16px', height: '16px', marginRight: '8px' }}></div>
                                Creating...
                            </>
                        ) : (
                            'Create Poll'
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
