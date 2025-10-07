const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'AIzaSyBQxq5np_mMPQE0B4RFw35YhBLO6GamW3g');

/**
 * Generate a comprehensive learning roadmap using Google Gemini AI
 * @param {Object} params - Roadmap generation parameters
 * @param {string} params.topic - The main topic/skill to learn
 * @param {string} params.currentLevel - User's current skill level (beginner/intermediate/advanced)
 * @param {string} params.goalLevel - Target skill level
 * @param {string} params.timeframe - Available time (e.g., "3 months", "6 months", "1 year")
 * @param {string[]} params.preferences - Learning preferences (e.g., "video tutorials", "hands-on projects")
 * @returns {Promise<Object>} Generated roadmap
 */
async function generateRoadmap(params) {
    const { topic, currentLevel = 'beginner', goalLevel = 'professional', timeframe = '6 months', preferences = [] } = params;

    const prompt = `Create a learning roadmap for "${topic}". Level: ${currentLevel} to ${goalLevel}. Time: ${timeframe}.

Return JSON with this structure:
{
  "title": "Learning Roadmap: ${topic}",
  "description": "Brief overview",
  "phases": [
    {
      "phaseNumber": 1,
      "phaseName": "Phase name (e.g., Foundations)",
      "duration": "2 weeks",
      "topics": ["Topic 1", "Topic 2", "Topic 3"],
      "resources": [
        {"type": "youtube", "title": "Video title", "channel": "Channel name"},
        {"type": "course", "title": "Course name", "platform": "Udemy/Coursera"}
      ],
      "projects": [
        {"name": "Project name", "description": "What to build", "difficulty": "beginner"}
      ]
    }
  ],
  "milestones": [
    {"week": 4, "achievement": "What you'll achieve"}
  ],
  "tips": ["Tip 1", "Tip 2"]
}

Include 4-6 phases with real YouTube channels (freeCodeCamp, Traversy Media) and courses (Udemy, Coursera). Keep it practical.`;

    try {
        console.log('🤖 Calling Gemini 2.5 Pro API...');
        console.log(`📝 Prompt length: ${prompt.length} characters`);
        
        // Use Gemini 2.5 Pro model
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

        console.log('⏳ Waiting for Gemini response...');
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log('✅ Gemini API Response received!');
        console.log('📊 Response length:', text.length, 'characters');
        console.log('📚 First 200 chars:', text.substring(0, 200) + '...');

        // Try to parse JSON from response
        // Gemini might wrap JSON in markdown code blocks
        let jsonText = text.trim();
        
        // Remove markdown code blocks if present
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```\n?/g, '').replace(/```\n?$/g, '');
        }

        const roadmap = JSON.parse(jsonText);

        return {
            success: true,
            roadmap,
            generatedAt: new Date().toISOString()
        };
    } catch (error) {
        console.error('❌ GEMINI API ERROR:');
        console.error('  Error Type:', error.constructor.name);
        console.error('  Message:', error.message);
        console.error('  Status:', error.status || error.statusCode || 'N/A');
        console.error('  Details:', error.details || error.response || 'No additional details');
        console.error('  Stack:', error.stack);
        
        // Return fallback roadmap if API fails
        return {
            success: false,
            error: error.message,
            errorType: error.constructor.name,
            roadmap: createFallbackRoadmap(topic, currentLevel, goalLevel, timeframe)
        };
    }
}

/**
 * Generate personalized learning suggestions based on user progress
 */
async function generateLearningTips(topic, currentProgress, strugglingAreas = []) {
    const prompt = `As an educational mentor, provide 5 personalized tips for someone learning "${topic}".

Current Progress: ${currentProgress}
Struggling With: ${strugglingAreas.join(', ') || 'No specific struggles mentioned'}

Provide encouraging, actionable advice that:
1. Addresses their struggles
2. Suggests specific next steps
3. Recommends resources or techniques
4. Keeps them motivated

Return as JSON array: ["tip1", "tip2", "tip3", "tip4", "tip5"]`;

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text().trim();

        // Clean up markdown if present
        if (text.startsWith('```json')) {
            text = text.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
        } else if (text.startsWith('```')) {
            text = text.replace(/```\n?/g, '');
        }

        const tips = JSON.parse(text);
        return { success: true, tips };
    } catch (error) {
        console.error('❌ Error generating tips:', error);
        return { 
            success: false, 
            tips: [
                "Take regular breaks to avoid burnout",
                "Practice consistently - even 30 minutes daily helps",
                "Join online communities for support",
                "Build projects to apply what you learn",
                "Don't compare your progress to others"
            ]
        };
    }
}

/**
 * Fallback roadmap in case AI API fails
 */
function createFallbackRoadmap(topic, currentLevel, goalLevel, timeframe) {
    return {
        title: `Learning Roadmap: ${topic}`,
        description: `A structured path to learn ${topic} from ${currentLevel} to ${goalLevel} level`,
        totalDuration: timeframe,
        phases: [
            {
                phaseNumber: 1,
                phaseName: "Foundation",
                duration: "First 25% of timeline",
                description: "Build strong fundamentals",
                concepts: [
                    "Core concepts and terminology",
                    "Basic principles and theory",
                    "Essential tools and setup"
                ],
                projects: [
                    {
                        name: "Beginner Project",
                        description: "Start with a simple hands-on project",
                        difficulty: "beginner",
                        estimatedTime: "5-10 hours"
                    }
                ],
                resources: [
                    {
                        type: "documentation",
                        title: "Official Documentation",
                        description: "Start with official resources"
                    }
                ],
                skills: ["Understanding basics", "Using fundamental tools"],
                assessmentCriteria: ["Can explain core concepts", "Completed first project"]
            },
            {
                phaseNumber: 2,
                phaseName: "Intermediate Development",
                duration: "Middle 50% of timeline",
                description: "Deepen knowledge and build complex projects",
                concepts: [
                    "Advanced concepts",
                    "Best practices and patterns",
                    "Problem-solving techniques"
                ],
                projects: [
                    {
                        name: "Intermediate Projects",
                        description: "Build 2-3 progressively complex projects",
                        difficulty: "intermediate",
                        estimatedTime: "20-30 hours each"
                    }
                ],
                resources: [
                    {
                        type: "course",
                        title: "Online Courses",
                        description: "Take structured courses for deeper learning"
                    }
                ],
                skills: ["Building real applications", "Debugging effectively"],
                assessmentCriteria: ["Completed multiple projects", "Can solve problems independently"]
            },
            {
                phaseNumber: 3,
                phaseName: "Advanced Mastery",
                duration: "Final 25% of timeline",
                description: "Achieve professional-level expertise",
                concepts: [
                    "Advanced techniques",
                    "System design",
                    "Performance optimization"
                ],
                projects: [
                    {
                        name: "Capstone Project",
                        description: "Build a comprehensive, production-ready project",
                        difficulty: "advanced",
                        estimatedTime: "40-60 hours"
                    }
                ],
                resources: [
                    {
                        type: "book",
                        title: "Advanced Books and Papers",
                        description: "Study in-depth resources"
                    }
                ],
                skills: ["Expert-level implementation", "Teaching others"],
                assessmentCriteria: ["Completed capstone project", "Ready for professional work"]
            }
        ],
        milestones: [
            { week: Math.ceil(parseInt(timeframe) * 0.25), achievement: "Fundamentals mastered", project: "First project completed" },
            { week: Math.ceil(parseInt(timeframe) * 0.5), achievement: "Intermediate skills", project: "Multiple projects completed" },
            { week: Math.ceil(parseInt(timeframe) * 0.75), achievement: "Advanced concepts", project: "Complex project completed" },
            { week: parseInt(timeframe) || 24, achievement: "Goal achieved", project: "Capstone completed" }
        ],
        tips: [
            "Stay consistent - regular practice is key",
            "Build projects to reinforce learning",
            "Join communities and find study partners",
            "Don't skip fundamentals - they matter",
            "Teach others to solidify your knowledge"
        ],
        finalProject: {
            name: `Comprehensive ${topic} Application`,
            description: "Build a complete application demonstrating mastery",
            requirements: [
                "Uses all major concepts learned",
                "Production-ready quality",
                "Well-documented",
                "Portfolio-worthy"
            ]
        }
    };
}

module.exports = {
    generateRoadmap,
    generateLearningTips
};
