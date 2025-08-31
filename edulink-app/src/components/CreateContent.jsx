import React from 'react';
import CreatePost from './CreatePost';
import CreatePoll from './CreatePoll';

export default function CreateContent({ onContentCreated }) {
    const [activeTab, setActiveTab] = React.useState('post');
    
    return (
        <div className="create-content-container">
            <div className="create-tabs">
                <button 
                    className={`tab-button ${activeTab === 'post' ? 'active' : ''}`}
                    onClick={() => setActiveTab('post')}
                >
                    Post
                </button>
                <button 
                    className={`tab-button ${activeTab === 'poll' ? 'active' : ''}`}
                    onClick={() => setActiveTab('poll')}
                >
                    Poll
                </button>
            </div>
            
            <div className="create-content">
                {activeTab === 'post' ? (
                    <CreatePost onPostCreated={onContentCreated} />
                ) : (
                    <CreatePoll onPollCreated={onContentCreated} />
                )}
            </div>
        </div>
    );
}
