import React, { useState, useRef, useEffect } from 'react';
import { apiCall } from '../config/api';
import './RoadmapChatbot.css';

export default function RoadmapChatbot() {
    const [messages, setMessages] = useState([
        {
            type: 'bot',
            content: "Hey there! 👋 I'm your AI Learning Coach.\n\nWhat would you like to learn? (e.g., React, Python, Machine Learning)",
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(0); // 0: topic, 1: level, 2: goal, 3: timeframe, 4: generated
    const [roadmapData, setRoadmapData] = useState({
        topic: '',
        currentLevel: 'beginner',
        goalLevel: 'professional',
        timeframe: '6 months',
        preferences: []
    });
    const [generatedRoadmap, setGeneratedRoadmap] = useState(null);
    
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const addMessage = (type, content) => {
        setMessages(prev => [...prev, {
            type,
            content,
            timestamp: new Date()
        }]);
    };

    const showLevelOptions = () => {
        addMessage('bot', `Great! You want to learn **${roadmapData.topic}** 🎯\n\nWhat's your current skill level?`);
        setTimeout(() => {
            addMessage('bot-options', JSON.stringify([
                { label: '🌱 Beginner', value: 'beginner' },
                { label: '🎯 Intermediate', value: 'intermediate' },
                { label: '🚀 Advanced', value: 'advanced' }
            ]));
        }, 300);
    };

    const showGoalOptions = () => {
        addMessage('bot', 'What level do you want to reach?');
        setTimeout(() => {
            addMessage('bot-options', JSON.stringify([
                { label: '🎯 Intermediate', value: 'intermediate' },
                { label: '🚀 Advanced', value: 'advanced' },
                { label: '👔 Professional', value: 'professional' }
            ]));
        }, 300);
    };

    const showTimeframeOptions = () => {
        addMessage('bot', 'How much time do you have?');
        setTimeout(() => {
            addMessage('bot-options', JSON.stringify([
                { label: '⚡ 1 Month', value: '1 month' },
                { label: '🏃 3 Months', value: '3 months' },
                { label: '🎯 6 Months', value: '6 months' },
                { label: '🌟 1 Year', value: '1 year' }
            ]));
        }, 300);
    };

    const generateRoadmap = async () => {
        setLoading(true);
        addMessage('bot', `🤖 Perfect! Let me create your personalized learning roadmap...\n\n⏳ This might take a moment while I analyze the best resources!`);

        try {
            console.log('📡 Calling API with data:', roadmapData);
            
            const response = await apiCall('/api/roadmap/generate', {
                method: 'POST',
                body: JSON.stringify(roadmapData)
            });

            console.log('📥 API Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ API Error:', errorText);
                throw new Error('Failed to generate roadmap');
            }

            const data = await response.json();
            console.log('✅ Roadmap data received:', data);
            
            if (data.success && data.roadmap) {
                setGeneratedRoadmap(data.roadmap);
                
                // Display roadmap summary
                const summary = `✨ **Your Personalized ${roadmapData.topic} Roadmap is Ready!**\n\n${data.roadmap.description || ''}\n\n📊 **Overview:**\n• Duration: ${data.roadmap.totalDuration || roadmapData.timeframe}\n• Phases: ${data.roadmap.phases?.length || 0}\n• Projects: ${data.roadmap.overview?.totalProjects || 0}\n\n🔽 Here's your detailed roadmap:`;
                
                addMessage('bot', summary);
                
                // Display each phase
                if (data.roadmap.phases && data.roadmap.phases.length > 0) {
                    setTimeout(() => {
                        data.roadmap.phases.forEach((phase, index) => {
                            setTimeout(() => {
                                let phaseContent = `\n**Phase ${index + 1}: ${phase.name}** ⏱️ ${phase.duration}\n\n${phase.description || ''}\n\n`;
                                
                                if (phase.topics && phase.topics.length > 0) {
                                    phaseContent += '📚 **Topics to Learn:**\n';
                                    phase.topics.forEach(topic => {
                                        phaseContent += `• ${topic}\n`;
                                    });
                                }
                                
                                if (phase.projects && phase.projects.length > 0) {
                                    phaseContent += '\n🛠️ **Projects:**\n';
                                    phase.projects.forEach(project => {
                                        phaseContent += `• **${project.title}** - ${project.description}\n`;
                                    });
                                }
                                
                                if (phase.resources && phase.resources.length > 0) {
                                    phaseContent += '\n📖 **Resources:**\n';
                                    phase.resources.forEach(resource => {
                                        phaseContent += `• [${resource.title}](${resource.url})\n`;
                                    });
                                }
                                
                                addMessage('bot', phaseContent);
                            }, index * 500);
                        });
                        
                        // Show action buttons after all phases
                        setTimeout(() => {
                            addMessage('bot-options', JSON.stringify([
                                { label: '🔄 Generate New', value: 'new' },
                                { label: '💬 Ask Questions', value: 'questions' }
                            ]));
                        }, data.roadmap.phases.length * 500 + 500);
                        
                    }, 1000);
                }
                
                setStep(4);
            } else {
                throw new Error('Invalid roadmap data received');
            }
        } catch (error) {
            console.error('❌ Error generating roadmap:', error);
            addMessage('bot', `❌ Oops! Something went wrong while generating your roadmap.\n\n${error.message}\n\nWould you like to try again? Just type what you'd like to learn!`);
            setStep(0);
        } finally {
            setLoading(false);
        }
    };

    const handleQuickReply = async (value, label) => {
        console.log('🔘 Quick reply:', value, label, 'Step:', step);
        addMessage('user', label);
        
        if (value === 'new') {
            handleReset();
            return;
        }
        
        if (step === 1) {
            // Level selection
            setRoadmapData(prev => ({ ...prev, currentLevel: value }));
            setStep(2);
            setTimeout(() => showGoalOptions(), 300);
        } else if (step === 2) {
            // Goal selection
            setRoadmapData(prev => ({ ...prev, goalLevel: value }));
            setStep(3);
            setTimeout(() => showTimeframeOptions(), 300);
        } else if (step === 3) {
            // Timeframe selection
            setRoadmapData(prev => ({ ...prev, timeframe: value }));
            setTimeout(() => generateRoadmap(), 500);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMessage = input.trim();
        console.log('📝 User input:', userMessage, 'Step:', step);
        setInput('');
        addMessage('user', userMessage);
        
        if (step === 0) {
            // Topic input
            setRoadmapData(prev => ({ ...prev, topic: userMessage }));
            setStep(1);
            setTimeout(() => showLevelOptions(), 300);
        }
    };

    const handleReset = () => {
        setMessages([{
            type: 'bot',
            content: "Let's create another roadmap! 🎯\n\nWhat would you like to learn?",
            timestamp: new Date()
        }]);
        setStep(0);
        setRoadmapData({
            topic: '',
            currentLevel: 'beginner',
            goalLevel: 'professional',
            timeframe: '6 months',
            preferences: []
        });
        setGeneratedRoadmap(null);
    };

    return (
        <div className="roadmap-chatbot">
            <div className="chat-container">
                <div className="chat-header">
                    <div className="chat-header-content">
                        <div className="bot-avatar">🤖</div>
                        <div>
                            <h2>AI Learning Coach</h2>
                            <p className="status">● Online - Ready to help</p>
                        </div>
                    </div>
                    {generatedRoadmap && (
                        <button className="reset-btn" onClick={handleReset}>
                            🔄 New Roadmap
                        </button>
                    )}
                </div>

                <div className="messages-area">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`message ${msg.type}`}>
                            {msg.type === 'bot' || msg.type === 'bot-options' ? (
                                <div className="bot-avatar-small">🤖</div>
                            ) : null}
                            
                            <div className="message-content">
                                {msg.type === 'bot-options' ? (
                                    <div className="quick-replies">
                                        {JSON.parse(msg.content).map((option, i) => (
                                            <button
                                                key={i}
                                                className="quick-reply-btn"
                                                onClick={() => handleQuickReply(option.value, option.label)}
                                                disabled={loading}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-content">
                                        {msg.content.split('\n').map((line, i) => {
                                            // Handle markdown-style bold **text**
                                            const parts = line.split(/(\*\*.*?\*\*)/g);
                                            return (
                                                <p key={i}>
                                                    {parts.map((part, j) => {
                                                        if (part.startsWith('**') && part.endsWith('**')) {
                                                            return <strong key={j}>{part.slice(2, -2)}</strong>;
                                                        }
                                                        return part;
                                                    })}
                                                </p>
                                            );
                                        })}
                                    </div>
                                )}
                                <span className="timestamp">
                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    ))}
                    
                    {loading && (
                        <div className="message bot">
                            <div className="bot-avatar-small">🤖</div>
                            <div className="message-content">
                                <div className="typing-indicator">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <div ref={messagesEndRef} />
                </div>

                <form className="input-area" onSubmit={handleSubmit}>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={step === 0 ? "Type what you want to learn..." : "Type your message..."}
                        disabled={loading || step > 0}
                        className="message-input"
                    />
                    <button 
                        type="submit" 
                        className="send-btn"
                        disabled={loading || !input.trim() || step > 0}
                    >
                        <span>📤</span>
                    </button>
                </form>
            </div>
            
            {generatedRoadmap && (
                <div className="roadmap-preview">
                    <h3>📋 Quick Reference</h3>
                    <div className="roadmap-stats">
                        <div className="stat">
                            <span className="stat-label">Topic</span>
                            <span className="stat-value">{roadmapData.topic}</span>
                        </div>
                        <div className="stat">
                            <span className="stat-label">Duration</span>
                            <span className="stat-value">{roadmapData.timeframe}</span>
                        </div>
                        <div className="stat">
                            <span className="stat-label">Phases</span>
                            <span className="stat-value">{generatedRoadmap.phases?.length || 0}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
