// Quick CORS test server - bypasses DB and Firebase for testing
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001; // Different port to avoid conflicts

const corsOptions = {
    origin: function(origin, callback) {
        console.log('CORS request from origin:', origin);
        // Allow requests from production domain, localhost for dev, or no origin (mobile apps)
        const allowedOrigins = [
            "https://www.edulink.social",
            "http://localhost:5173", // Vite dev server
            "http://localhost:3000"  // Local testing
        ];
        
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log('CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Origin", "X-Requested-With", "Accept"],
    credentials: true,
    optionsSuccessStatus: 200 // For legacy browser support
};

// Apply CORS middleware first
app.use(cors(corsOptions));
app.use(express.json());

// Test routes
app.get('/', (req, res) => {
    res.json({ message: 'CORS test server running!', origin: req.get('Origin') });
});

app.post('/api/posts', (req, res) => {
    console.log('POST /api/posts received from origin:', req.get('Origin'));
    res.status(201).json({ 
        message: 'CORS test successful!', 
        received: req.body,
        origin: req.get('Origin')
    });
});

app.listen(PORT, () => {
    console.log(`🧪 CORS Test Server running on http://localhost:${PORT}`);
    console.log('✅ This server will accept requests from:');
    console.log('   - https://www.edulink.social');
    console.log('   - http://localhost:5173 (Vite dev)');
    console.log('   - http://localhost:3000 (local backend)');
    console.log('   - No origin (mobile apps, curl)');
});
