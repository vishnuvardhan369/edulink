import React, { useState } from 'react';
import { apiCall } from '../config/api';
import './RoadmapCreator.css';

export default function RoadmapCreator() {
    const [step, setStep] = useState(1); // 1: Form, 2: Loading, 3: Result
    const [formData, setFormData] = useState({
        topic: '',
        currentLevel: 'beginner',
        goalLevel: 'professional',
        timeframe: '6 months',
        preferences: []
    });
    const [roadmap, setRoadmap] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const levelOptions = [
        { value: 'absolute-beginner', label: '🌱 Absolute Beginner' },
        { value: 'beginner', label: '📚 Beginner' },
        { value: 'intermediate', label: '🎯 Intermediate' },
        { value: 'advanced', label: '🚀 Advanced' },
        { value: 'professional', label: '👔 Professional' }
    ];

    const timeframeOptions = [
        { value: '1 month', label: '⚡ 1 Month (Intensive)' },
        { value: '3 months', label: '🏃 3 Months' },
        { value: '6 months', label: '🎯 6 Months (Recommended)' },
        { value: '1 year', label: '🌟 1 Year (Comprehensive)' },
        { value: '2 years', label: '🎓 2 Years (Mastery)' }
    ];

    const preferenceOptions = [
        'Video tutorials',
        'Interactive coding',
        'Reading documentation',
        'Building projects',
        'Online courses',
        'Books',
        'Mentorship',
        'Community learning'
    ];

    const handlePreferenceToggle = (pref) => {
        setFormData(prev => ({
            ...prev,
            preferences: prev.preferences.includes(pref)
                ? prev.preferences.filter(p => p !== pref)
                : [...prev.preferences, pref]
        }));
    };

    const handleGenerate = async () => {
        if (!formData.topic.trim()) {
            setError('Please enter a topic to learn');
            return;
        }

        setLoading(true);
        setError('');
        setStep(2);

        try {
            const response = await apiCall('/api/roadmap/generate', {
                method: 'POST',
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                throw new Error('Failed to generate roadmap');
            }

            const data = await response.json();
            
            if (data.success) {
                setRoadmap(data.roadmap);
                setStep(3);
            } else {
                // Fallback roadmap still returned
                setRoadmap(data.roadmap);
                setStep(3);
                setError('AI service is busy. Showing a general roadmap.');
            }
        } catch (err) {
            console.error('Error generating roadmap:', err);
            setError('Failed to generate roadmap. Please try again.');
            setStep(1);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const response = await apiCall('/api/roadmap/save', {
                method: 'POST',
                body: JSON.stringify({
                    roadmap,
                    topic: formData.topic
                })
            });

            if (response.ok) {
                alert('✅ Roadmap saved to your profile!');
            } else {
                throw new Error('Failed to save');
            }
        } catch (err) {
            alert('❌ Failed to save roadmap. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setStep(1);
        setRoadmap(null);
        setError('');
        setFormData({
            topic: '',
            currentLevel: 'beginner',
            goalLevel: 'professional',
            timeframe: '6 months',
            preferences: []
        });
    };

    return (
        <div className="roadmap-creator">
            {step === 1 && (
                <div className="roadmap-form">
                    <div className="form-header">
                        <h1>🗺️ AI Roadmap Creator</h1>
                        <p>Let AI create a personalized learning roadmap just for you</p>
                    </div>

                    <div className="form-section">
                        <label>What do you want to learn?</label>
                        <input
                            type="text"
                            placeholder="e.g., React, Machine Learning, Digital Marketing..."
                            value={formData.topic}
                            onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                            className="topic-input"
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-section">
                            <label>Your Current Level</label>
                            <select
                                value={formData.currentLevel}
                                onChange={(e) => setFormData({ ...formData, currentLevel: e.target.value })}
                            >
                                {levelOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-section">
                            <label>Goal Level</label>
                            <select
                                value={formData.goalLevel}
                                onChange={(e) => setFormData({ ...formData, goalLevel: e.target.value })}
                            >
                                {levelOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-section">
                        <label>Timeframe</label>
                        <select
                            value={formData.timeframe}
                            onChange={(e) => setFormData({ ...formData, timeframe: e.target.value })}
                        >
                            {timeframeOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-section">
                        <label>Learning Preferences (Optional)</label>
                        <div className="preference-grid">
                            {preferenceOptions.map(pref => (
                                <button
                                    key={pref}
                                    type="button"
                                    className={`preference-chip ${formData.preferences.includes(pref) ? 'active' : ''}`}
                                    onClick={() => handlePreferenceToggle(pref)}
                                >
                                    {pref}
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <button 
                        className="generate-btn"
                        onClick={handleGenerate}
                        disabled={loading}
                    >
                        ✨ Generate My Roadmap
                    </button>
                </div>
            )}

            {step === 2 && (
                <div className="loading-screen">
                    <div className="ai-animation">
                        <div className="spinner-large"></div>
                        <h2>🤖 AI is crafting your roadmap...</h2>
                        <p>Analyzing the best learning path for {formData.topic}</p>
                        <div className="loading-steps">
                            <div className="loading-step">✓ Understanding your goals</div>
                            <div className="loading-step">✓ Researching resources</div>
                            <div className="loading-step active">⏳ Creating custom curriculum</div>
                        </div>
                    </div>
                </div>
            )}

            {step === 3 && roadmap && (
                <div className="roadmap-result">
                    <div className="result-header">
                        <button className="back-btn" onClick={handleReset}>← Create Another</button>
                        <button className="save-btn" onClick={handleSave} disabled={saving}>
                            {saving ? '💾 Saving...' : '💾 Save Roadmap'}
                        </button>
                    </div>

                    <div className="roadmap-content">
                        <h1>{roadmap.title}</h1>
                        <p className="roadmap-description">{roadmap.description}</p>
                        
                        {/* Overview Section */}
                        {roadmap.overview && (
                            <div className="overview-section">
                                <div className="roadmap-meta">
                                    <span className="meta-item">⏱️ {roadmap.totalDuration}</span>
                                    <span className="meta-item">📊 {roadmap.overview.totalPhases || roadmap.phases?.length || 0} Phases</span>
                                    <span className="meta-item">🎯 {roadmap.milestones?.length || 0} Milestones</span>
                                    <span className="meta-item">🛠️ {roadmap.overview.totalProjects || 0} Projects</span>
                                    <span className="meta-item">⏰ {roadmap.overview.estimatedHoursPerWeek || 0}h/week</span>
                                </div>
                                {roadmap.overview.prerequisites && roadmap.overview.prerequisites.length > 0 && (
                                    <div className="prerequisites">
                                        <h3>📋 Prerequisites</h3>
                                        <ul>
                                            {roadmap.overview.prerequisites.map((prereq, i) => (
                                                <li key={i}>{prereq}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {!roadmap.overview && (
                            <div className="roadmap-meta">
                                <span className="meta-item">⏱️ {roadmap.totalDuration}</span>
                                <span className="meta-item">📊 {roadmap.phases?.length || 0} Phases</span>
                                <span className="meta-item">🎯 {roadmap.milestones?.length || 0} Milestones</span>
                            </div>
                        )}

                        {/* Phases */}
                        <div className="phases-section">
                            {roadmap.phases?.map((phase, idx) => (
                                <div key={idx} className="phase-card">
                                    <div className="phase-header">
                                        <span className="phase-number">Phase {phase.phaseNumber}</span>
                                        <h2>{phase.phaseName}</h2>
                                        <span className="phase-duration">⏱️ {phase.duration}</span>
                                    </div>
                                    <p className="phase-description">{phase.description}</p>

                                    {/* Concepts */}
                                    {phase.concepts && phase.concepts.length > 0 && (
                                        <div className="phase-subsection">
                                            <h3>📚 Core Concepts</h3>
                                            <ul>
                                                {phase.concepts.map((concept, i) => (
                                                    <li key={i}>{concept}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Projects */}
                                    {phase.projects && phase.projects.length > 0 && (
                                        <div className="phase-subsection">
                                            <h3>🛠️ Projects</h3>
                                            {phase.projects.map((project, i) => (
                                                <div key={i} className="project-card">
                                                    <h4>{project.name}</h4>
                                                    <p>{project.description}</p>
                                                    <div className="project-meta">
                                                        <span className="difficulty-badge">{project.difficulty}</span>
                                                        <span>{project.estimatedTime}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Week by Week Breakdown */}
                                    {phase.weekByWeek && phase.weekByWeek.length > 0 && (
                                        <div className="phase-subsection">
                                            <h3>📅 Week-by-Week Plan</h3>
                                            <div className="week-breakdown">
                                                {phase.weekByWeek.map((week, i) => (
                                                    <div key={i} className="week-card">
                                                        <div className="week-header">
                                                            <strong>Week {week.week}</strong>
                                                            <span>{week.dailyHours}h/day</span>
                                                        </div>
                                                        <p className="week-goal">{week.goal}</p>
                                                        <div className="week-topics">
                                                            {week.topics?.map((topic, j) => (
                                                                <span key={j} className="topic-tag">{topic}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* YouTube Resources */}
                                    {phase.youtubeResources && phase.youtubeResources.length > 0 && (
                                        <div className="phase-subsection">
                                            <h3>📺 YouTube Tutorials</h3>
                                            {phase.youtubeResources.map((video, i) => (
                                                <div key={i} className="youtube-card">
                                                    <div className="youtube-icon">▶️</div>
                                                    <div className="youtube-content">
                                                        <strong>{video.channel}</strong>
                                                        <p className="video-title">{video.title}</p>
                                                        <p className="video-description">{video.description}</p>
                                                        <div className="video-meta">
                                                            <span>⏱️ {video.duration}</span>
                                                            {video.url && (
                                                                <a href={video.url} target="_blank" rel="noopener noreferrer">
                                                                    Watch Now →
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Online Courses */}
                                    {phase.onlineCourses && phase.onlineCourses.length > 0 && (
                                        <div className="phase-subsection">
                                            <h3>🎓 Online Courses</h3>
                                            {phase.onlineCourses.map((course, i) => (
                                                <div key={i} className="course-card">
                                                    <div className="course-header">
                                                        <span className="course-platform">{course.platform}</span>
                                                        <span className="course-price">{course.price}</span>
                                                        {course.rating && <span className="course-rating">⭐ {course.rating}</span>}
                                                    </div>
                                                    <strong>{course.title}</strong>
                                                    <p className="course-instructor">by {course.instructor}</p>
                                                    <p>{course.description}</p>
                                                    {course.url && (
                                                        <a href={course.url} target="_blank" rel="noopener noreferrer" className="course-link">
                                                            Enroll Now →
                                                        </a>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Books */}
                                    {phase.books && phase.books.length > 0 && (
                                        <div className="phase-subsection">
                                            <h3>📚 Recommended Books</h3>
                                            {phase.books.map((book, i) => (
                                                <div key={i} className="book-card">
                                                    <div className="book-icon">📖</div>
                                                    <div>
                                                        <strong>{book.title}</strong>
                                                        <p className="book-author">by {book.author}</p>
                                                        <span className="book-type">{book.type}</span>
                                                        <p>{book.description}</p>
                                                        {book.url && (
                                                            <a href={book.url} target="_blank" rel="noopener noreferrer">
                                                                Get Book →
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Documentation */}
                                    {phase.documentation && phase.documentation.length > 0 && (
                                        <div className="phase-subsection">
                                            <h3>📄 Documentation</h3>
                                            {phase.documentation.map((doc, i) => (
                                                <div key={i} className="doc-card">
                                                    <strong>{doc.name}</strong>
                                                    <p>{doc.description}</p>
                                                    {doc.url && (
                                                        <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                                            Read Docs →
                                                        </a>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Legacy Resources (fallback) */}
                                    {phase.resources && phase.resources.length > 0 && (
                                        <div className="phase-subsection">
                                            <h3>📖 Resources</h3>
                                            {phase.resources.map((resource, i) => (
                                                <div key={i} className="resource-item">
                                                    <span className="resource-type">{resource.type}</span>
                                                    <div>
                                                        <strong>{resource.title}</strong>
                                                        <p>{resource.description}</p>
                                                        {resource.url && (
                                                            <a href={resource.url} target="_blank" rel="noopener noreferrer">
                                                                Visit Resource →
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Tools */}
                                    {phase.tools && phase.tools.length > 0 && (
                                        <div className="phase-subsection">
                                            <h3>🛠️ Tools & Setup</h3>
                                            {phase.tools.map((tool, i) => (
                                                <div key={i} className="tool-card">
                                                    <strong>{tool.name}</strong>
                                                    <p>{tool.purpose}</p>
                                                    {tool.installCommand && (
                                                        <code className="install-command">{tool.installCommand}</code>
                                                    )}
                                                    {tool.documentation && (
                                                        <a href={tool.documentation} target="_blank" rel="noopener noreferrer">
                                                            Documentation →
                                                        </a>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Skills */}
                                    {phase.skills && phase.skills.length > 0 && (
                                        <div className="phase-subsection">
                                            <h3>💪 Skills to Master</h3>
                                            <div className="skills-grid">
                                                {phase.skills.map((skill, i) => (
                                                    <span key={i} className="skill-tag">{skill}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Common Challenges */}
                                    {phase.commonChallenges && phase.commonChallenges.length > 0 && (
                                        <div className="phase-subsection">
                                            <h3>⚠️ Common Challenges & Solutions</h3>
                                            {phase.commonChallenges.map((item, i) => (
                                                <div key={i} className="challenge-card">
                                                    <div className="challenge-title">⚠️ {item.challenge}</div>
                                                    <div className="challenge-solution">💡 {item.solution}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Assessment Criteria */}
                                    {phase.assessmentCriteria && phase.assessmentCriteria.length > 0 && (
                                        <div className="phase-subsection">
                                            <h3>✅ Ready for Next Phase When You Can:</h3>
                                            <ul>
                                                {phase.assessmentCriteria.map((criteria, i) => (
                                                    <li key={i}>{criteria}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Community Resources */}
                        {roadmap.communityResources && roadmap.communityResources.length > 0 && (
                            <div className="community-section">
                                <h2>👥 Community & Support</h2>
                                <div className="community-grid">
                                    {roadmap.communityResources.map((community, idx) => (
                                        <div key={idx} className="community-card">
                                            <span className="community-icon">{community.type === 'Discord' ? '💬' : '🗨️'}</span>
                                            <strong>{community.name}</strong>
                                            <p>{community.description}</p>
                                            {community.url && (
                                                <a href={community.url} target="_blank" rel="noopener noreferrer">
                                                    Join Community →
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Practice Platforms */}
                        {roadmap.practiceplatforms && roadmap.practiceplatforms.length > 0 && (
                            <div className="practice-section">
                                <h2>💪 Practice Platforms</h2>
                                <div className="practice-grid">
                                    {roadmap.practiceplatforms.map((platform, idx) => (
                                        <div key={idx} className="practice-card">
                                            <strong>{platform.name}</strong>
                                            {platform.recommended && <span className="recommended-badge">⭐ Recommended</span>}
                                            <p>{platform.description}</p>
                                            {platform.url && (
                                                <a href={platform.url} target="_blank" rel="noopener noreferrer">
                                                    Start Practicing →
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Milestones */}
                        {roadmap.milestones && roadmap.milestones.length > 0 && (
                            <div className="milestones-section">
                                <h2>🎯 Milestones Timeline</h2>
                                <div className="milestones-timeline">
                                    {roadmap.milestones.map((milestone, idx) => (
                                        <div key={idx} className="milestone-item">
                                            <div className="milestone-marker">Week {milestone.week}</div>
                                            <div className="milestone-content">
                                                <h3>{milestone.achievement}</h3>
                                                <p>{milestone.project}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Tips */}
                        {roadmap.tips && roadmap.tips.length > 0 && (
                            <div className="tips-section">
                                <h2>💡 Success Tips</h2>
                                <div className="tips-grid">
                                    {roadmap.tips.map((tip, idx) => (
                                        <div key={idx} className="tip-card">
                                            <span className="tip-icon">💡</span>
                                            <p>{tip}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Career Path */}
                        {roadmap.careerPath && (
                            <div className="career-section">
                                <h2>💼 Career Opportunities</h2>
                                <div className="career-card">
                                    {roadmap.careerPath.jobTitles && (
                                        <div className="career-item">
                                            <strong>Job Titles:</strong>
                                            <div className="job-tags">
                                                {roadmap.careerPath.jobTitles.map((job, i) => (
                                                    <span key={i} className="job-tag">{job}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {roadmap.careerPath.averageSalary && (
                                        <div className="career-item">
                                            <strong>Average Salary:</strong> {roadmap.careerPath.averageSalary}
                                        </div>
                                    )}
                                    {roadmap.careerPath.topCompanies && (
                                        <div className="career-item">
                                            <strong>Top Hiring Companies:</strong>
                                            <div className="company-tags">
                                                {roadmap.careerPath.topCompanies.map((company, i) => (
                                                    <span key={i} className="company-tag">{company}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {roadmap.careerPath.portfolioMustHaves && (
                                        <div className="career-item">
                                            <strong>Portfolio Must-Haves:</strong>
                                            <ul>
                                                {roadmap.careerPath.portfolioMustHaves.map((item, i) => (
                                                    <li key={i}>{item}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Final Project */}
                        {roadmap.finalProject && (
                            <div className="final-project-section">
                                <h2>🏆 Capstone Project</h2>
                                <div className="final-project-card">
                                    <h3>{roadmap.finalProject.name}</h3>
                                    <p>{roadmap.finalProject.description}</p>
                                    {roadmap.finalProject.estimatedTime && (
                                        <p className="project-time">⏱️ Estimated Time: {roadmap.finalProject.estimatedTime}</p>
                                    )}
                                    {roadmap.finalProject.technologiesUsed && roadmap.finalProject.technologiesUsed.length > 0 && (
                                        <div className="project-tech">
                                            <strong>Technologies:</strong>
                                            <div className="tech-tags">
                                                {roadmap.finalProject.technologiesUsed.map((tech, i) => (
                                                    <span key={i} className="tech-tag">{tech}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {roadmap.finalProject.requirements && (
                                        <>
                                            <h4>Requirements:</h4>
                                            <ul>
                                                {roadmap.finalProject.requirements.map((req, i) => (
                                                    <li key={i}>{req}</li>
                                                ))}
                                            </ul>
                                        </>
                                    )}
                                    {roadmap.finalProject.deploymentPlatform && (
                                        <p className="deployment-info">
                                            <strong>Deploy on:</strong> {roadmap.finalProject.deploymentPlatform}
                                        </p>
                                    )}
                                    {roadmap.finalProject.portfolioValue && (
                                        <div className="portfolio-value">
                                            <strong>💼 Portfolio Value:</strong> {roadmap.finalProject.portfolioValue}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
