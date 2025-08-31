// 1. Import Packages & Setup
const express = require('express');
const cors = require('cors');
require('dotenv').config(); 
const { Client, Pool } = require('pg');
const { BlobServiceClient, StorageSharedKeyCredential, BlobSASPermissions, generateBlobSASQueryParameters } = require('@azure/storage-blob');
const admin = require('firebase-admin');

// --- Initialize Firebase Admin (for authentication only) ---
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

// --- PostgreSQL Database Setup with Pool ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 20, // maximum number of clients in the pool
  idleTimeoutMillis: 30000, // close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // return an error after 2 seconds if connection could not be established
});

// Legacy client for backward compatibility (we'll migrate queries to pool)
const client = pool;

// Test database connection
pool.connect()
  .then((client) => {
    console.log('Connected to Neon PostgreSQL database');
    client.release();
  })
  .catch(err => {
    console.error('Error connecting to PostgreSQL:', err);
  });

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});


// --- Express Setup ---
const app = express();
const PORT = process.env.PORT;  // ✅ FIX: Use Azure PORT

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

// Environment detection
const isDevelopment = process.env.NODE_ENV === 'development';
const isAzure = !!process.env.WEBSITE_SITE_NAME; // Azure App Service sets this

// --- Azure Storage Setup ---
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
if (!accountName || !accountKey) { 
    console.error("Error: Azure Storage credentials are not set in the .env file.");
    process.exit(1);
}
const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);

// 2. --- ALL API ROUTES ---

// Health Check
app.get('/', (req, res) => res.send('EduLink Backend is running! v2.0 - DB Compatible'));

// PROFILE PICTURE UPLOAD URL
app.post('/api/generate-upload-url', (req, res) => {
    try {
        const { fileName } = req.body;
        if (!fileName) return res.status(400).send({ error: 'fileName is required.' });
        const containerName = 'profile-pictures'; 
        const blobName = `${Date.now()}-${fileName}`;
        const sasToken = generateBlobSASQueryParameters({
            containerName, blobName,
            permissions: BlobSASPermissions.parse("w"), // Write permission
            startsOn: new Date(),
            expiresOn: new Date(new Date().valueOf() + 3600 * 1000) // 1 hour expiry
        }, sharedKeyCredential).toString();
        const uploadUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}?${sasToken}`;
        res.status(200).send({ uploadUrl, blobName });
    } catch (error) {
        res.status(500).send({ error: 'Failed to generate profile picture upload URL.' });
    }
});

// POST IMAGE UPLOAD URL
app.post('/api/generate-post-upload-url', (req, res) => {
    try {
        const { fileName } = req.body;
        if (!fileName) return res.status(400).send({ error: 'fileName is required.' });
        const containerName = 'post-images';
        const blobName = `${Date.now()}-${fileName}`;
        const sasToken = generateBlobSASQueryParameters({
            containerName, blobName,
            permissions: BlobSASPermissions.parse("w"),
            startsOn: new Date(),
            expiresOn: new Date(new Date().valueOf() + 3600 * 1000)
        }, sharedKeyCredential).toString();
        const uploadUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}?${sasToken}`;
        res.status(200).send({ uploadUrl, blobName });
    } catch (error) {
        res.status(500).send({ error: 'Failed to generate post upload URL.' });
    }
});

// POSTS ROUTES
app.post('/api/posts', async (req, res) => {
    try {
        console.log('DEBUG: Creating post with updated query (no updated_at)');
        const { userId, description, imageUrls } = req.body;
        if (!userId || !description) return res.status(400).send({ error: 'userId and description are required.' });
        
        // Check if user exists, create if not
        const checkUserQuery = `SELECT user_id FROM users WHERE user_id = $1`;
        const userResult = await client.query(checkUserQuery, [userId]);
        
        if (userResult.rows.length === 0) {
            console.log('DEBUG: User not found, creating user:', userId);
            // Create user with basic info (this should ideally come from frontend)
            const createUserQuery = `
                INSERT INTO users (user_id, username, email, display_name, display_name_lowercase, created_at) 
                VALUES ($1, $2, $3, $4, $5, NOW())
            `;
            // Use userId as fallback values (frontend should call proper user creation endpoint)
            const tempUsername = `user_${userId.slice(-8)}`;
            const tempEmail = `${userId}@temp.com`;
            const tempDisplayName = `User ${userId.slice(-8)}`;
            console.log('DEBUG: Creating temp user with:', { tempUsername, tempEmail, tempDisplayName });
            await client.query(createUserQuery, [userId, tempUsername, tempEmail, tempDisplayName, tempDisplayName.toLowerCase()]);
            console.log('DEBUG: Created temporary user profile');
        }
        
        // Insert post into PostgreSQL
        const insertPostQuery = `
            INSERT INTO posts (user_id, description) 
            VALUES ($1, $2) 
            RETURNING post_id, created_at
        `;
        const postResult = await client.query(insertPostQuery, [userId, description]);
        const postId = postResult.rows[0].post_id;
        
        // Insert images if provided
        if (imageUrls && imageUrls.length > 0) {
            const insertImageQuery = `
                INSERT INTO post_images (post_id, image_url) 
                VALUES ($1, $2)
            `;
            for (const imageUrl of imageUrls) {
                await client.query(insertImageQuery, [postId, imageUrl]);
            }
        }
        
        res.status(201).send({ message: 'Post created successfully', postId });
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).send({ error: 'Failed to create post.' });
    }
});

app.get('/api/posts', async (req, res) => {
    try {
        console.log('DEBUG: Fetching posts with updated query (no pi.created_at)');
        const postsQuery = `
            SELECT 
                p.post_id as id,
                p.user_id as "userId",
                p.description,
                p.created_at,
                u.username,
                u.display_name as "displayName",
                u.profile_picture_url as "profilePictureUrl",
                COALESCE(
                    json_agg(
                        DISTINCT pi.image_url
                    ) FILTER (WHERE pi.image_url IS NOT NULL), 
                    '[]'::json
                ) as "imageUrls",
                COALESCE(
                    json_agg(
                        DISTINCT jsonb_build_object(
                            'userId', l.user_id
                        )
                    ) FILTER (WHERE l.user_id IS NOT NULL), 
                    '[]'::json
                ) as likes,
                COALESCE(
                    json_agg(
                        DISTINCT jsonb_build_object(
                            'userId', c.user_id,
                            'text', c.comment_text,
                            'createdAt', EXTRACT(EPOCH FROM c.created_at) * 1000
                        )
                    ) FILTER (WHERE c.comment_text IS NOT NULL), 
                    '[]'::json
                ) as comments
            FROM posts p
            JOIN users u ON p.user_id = u.user_id
            LEFT JOIN post_images pi ON p.post_id = pi.post_id
            LEFT JOIN likes l ON p.post_id = l.post_id
            LEFT JOIN comments c ON p.post_id = c.post_id
            GROUP BY p.post_id, p.user_id, p.description, p.created_at, u.username, u.display_name, u.profile_picture_url
            ORDER BY p.created_at DESC
        `;
        
        const result = await client.query(postsQuery);
        
        const posts = result.rows.map(row => ({
            ...row,
            createdAt: new Date(row.created_at).getTime()
        }));
        
        res.status(200).send(posts);
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).send({ error: 'Failed to fetch posts.' });
    }
});

app.delete('/api/posts/:postId', async (req, res) => {
    try {
        const { postId } = req.params;
        const { userId } = req.body;
        if (!userId) return res.status(400).send({ error: 'User ID is required.' });
        
        // Check if post exists and belongs to user
        const checkPostQuery = `SELECT user_id FROM posts WHERE post_id = $1`;
        const checkResult = await client.query(checkPostQuery, [postId]);
        
        if (checkResult.rows.length === 0) {
            return res.status(404).send({ error: 'Post not found.' });
        }
        
        if (checkResult.rows[0].user_id !== userId) {
            return res.status(403).send({ error: 'Forbidden' });
        }
        
        // Delete post (cascade will handle related records)
        const deletePostQuery = `DELETE FROM posts WHERE post_id = $1`;
        await client.query(deletePostQuery, [postId]);
        
        res.status(200).send({ message: 'Post deleted successfully.' });
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).send({ error: 'Failed to delete post.' });
    }
});

app.post('/api/posts/:postId/like', async (req, res) => {
    try {
        const { postId } = req.params;
        const { userId } = req.body;
        if (!userId) return res.status(400).send({ error: 'userId is required.' });
        
        // Check if post exists
        const checkPostQuery = `SELECT post_id FROM posts WHERE post_id = $1`;
        const postResult = await client.query(checkPostQuery, [postId]);
        if (postResult.rows.length === 0) {
            return res.status(404).send({ error: 'Post not found.' });
        }
        
        // Check if user already liked the post
        const checkLikeQuery = `SELECT 1 FROM likes WHERE post_id = $1 AND user_id = $2`;
        const likeResult = await client.query(checkLikeQuery, [postId, userId]);
        
        if (likeResult.rows.length > 0) {
            // Unlike the post
            const deleteLikeQuery = `DELETE FROM likes WHERE post_id = $1 AND user_id = $2`;
            await client.query(deleteLikeQuery, [postId, userId]);
        } else {
            // Like the post
            const insertLikeQuery = `INSERT INTO likes (post_id, user_id) VALUES ($1, $2)`;
            await client.query(insertLikeQuery, [postId, userId]);
        }
        
        res.status(200).send({ message: 'Like status updated.' });
    } catch (error) {
        console.error('Error updating like status:', error);
        res.status(500).send({ error: 'Failed to update like status.' });
    }
});

app.post('/api/posts/:postId/comment', async (req, res) => {
    try {
        const { postId } = req.params;
        const { userId, text } = req.body;
        if (!userId || !text) return res.status(400).send({ error: 'userId and text are required.' });
        
        // Check if post exists
        const checkPostQuery = `SELECT post_id FROM posts WHERE post_id = $1`;
        const postResult = await client.query(checkPostQuery, [postId]);
        if (postResult.rows.length === 0) {
            return res.status(404).send({ error: 'Post not found.' });
        }
        
        // Add comment
        const insertCommentQuery = `
            INSERT INTO comments (post_id, user_id, comment_text) 
            VALUES ($1, $2, $3)
        `;
        await client.query(insertCommentQuery, [postId, userId, text]);
        
        // Get updated post with all data
        const updatedPostQuery = `
            SELECT 
                p.post_id as id,
                p.user_id as "userId",
                p.description,
                p.created_at,
                u.username,
                u.display_name as "displayName",
                u.profile_picture_url as "profilePictureUrl",
                COALESCE(
                    json_agg(
                        DISTINCT pi.image_url
                    ) FILTER (WHERE pi.image_url IS NOT NULL), 
                    '[]'::json
                ) as "imageUrls",
                COALESCE(
                    json_agg(
                        DISTINCT jsonb_build_object(
                            'userId', l.user_id
                        )
                    ) FILTER (WHERE l.user_id IS NOT NULL), 
                    '[]'::json
                ) as likes,
                COALESCE(
                    json_agg(
                        DISTINCT jsonb_build_object(
                            'userId', c.user_id,
                            'text', c.comment_text,
                            'createdAt', EXTRACT(EPOCH FROM c.created_at) * 1000
                        )
                    ) FILTER (WHERE c.comment_text IS NOT NULL), 
                    '[]'::json
                ) as comments
            FROM posts p
            JOIN users u ON p.user_id = u.user_id
            LEFT JOIN post_images pi ON p.post_id = pi.post_id
            LEFT JOIN likes l ON p.post_id = l.post_id
            LEFT JOIN comments c ON p.post_id = c.post_id
            WHERE p.post_id = $1
            GROUP BY p.post_id, p.user_id, p.description, p.created_at, u.username, u.display_name, u.profile_picture_url
        `;
        
        const result = await client.query(updatedPostQuery, [postId]);
        const updatedPost = {
            ...result.rows[0],
            createdAt: new Date(result.rows[0].created_at).getTime()
        };
        
        res.status(201).send(updatedPost);
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).send({ error: 'Failed to add comment.' });
    }
});

// USER & CONNECTION ROUTES
app.get('/api/users/search', async (req, res) => {
    try {
        const { query } = req.query;
        if (!query || query.length < 2) return res.status(200).send([]);
        
        const searchQuery = `
            SELECT 
                user_id as id,
                username,
                display_name as "displayName",
                profile_picture_url as "profilePictureUrl",
                bio
            FROM users 
            WHERE 
                LOWER(display_name) LIKE LOWER($1) OR 
                LOWER(username) LIKE LOWER($1)
            ORDER BY 
                CASE 
                    WHEN LOWER(username) = LOWER($2) THEN 1
                    WHEN LOWER(display_name) = LOWER($2) THEN 2
                    WHEN LOWER(username) LIKE LOWER($1) THEN 3
                    ELSE 4
                END
            LIMIT 10
        `;
        
        const searchPattern = `%${query}%`;
        const result = await client.query(searchQuery, [searchPattern, query]);
        
        res.status(200).send(result.rows);
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).send({ error: 'Failed to search for users.' });
    }
});

app.post('/api/users/:userId/follow', async (req, res) => {
    try {
        const { userId: userToFollowId } = req.params;
        const { currentUserId } = req.body;
        if (!currentUserId || userToFollowId === currentUserId) {
            return res.status(400).send({ error: 'Invalid request.' });
        }
        
        // Check if users exist
        const checkUsersQuery = `
            SELECT user_id FROM users WHERE user_id IN ($1, $2)
        `;
        const usersResult = await client.query(checkUsersQuery, [currentUserId, userToFollowId]);
        if (usersResult.rows.length < 2) {
            return res.status(404).send({ error: 'One or both users not found.' });
        }
        
        // Insert connection (ignore if already exists)
        const insertConnectionQuery = `
            INSERT INTO user_connections (follower_id, following_id, created_at) 
            VALUES ($1, $2, NOW())
            ON CONFLICT (follower_id, following_id) DO NOTHING
        `;
        await client.query(insertConnectionQuery, [currentUserId, userToFollowId]);
        
        res.status(200).send({ message: 'Successfully followed user.' });
    } catch (error) {
        console.error('Error following user:', error);
        res.status(500).send({ error: 'Failed to follow user.' });
    }
});

app.post('/api/users/:userId/unfollow', async (req, res) => {
    try {
        const { userId: userToUnfollowId } = req.params;
        const { currentUserId } = req.body;
        if (!currentUserId) return res.status(400).send({ error: 'Current user ID is required.' });
        
        // Remove connection
        const deleteConnectionQuery = `
            DELETE FROM user_connections 
            WHERE follower_id = $1 AND following_id = $2
        `;
        await client.query(deleteConnectionQuery, [currentUserId, userToUnfollowId]);
        
        res.status(200).send({ message: 'Successfully unfollowed user.' });
    } catch (error) {
        console.error('Error unfollowing user:', error);
        res.status(500).send({ error: 'Failed to unfollow user.' });
    }
});

app.post('/api/users/:userId/request-connect', async (req, res) => {
    try {
        const { userId: recipientId } = req.params;
        const { currentUserId: senderId } = req.body;
        if (!senderId || recipientId === senderId) {
            return res.status(400).send({ error: 'Invalid request.' });
        }
        
        // Check if users exist
        const checkUsersQuery = `SELECT user_id FROM users WHERE user_id IN ($1, $2)`;
        const usersResult = await client.query(checkUsersQuery, [senderId, recipientId]);
        if (usersResult.rows.length < 2) {
            return res.status(404).send({ error: 'One or both users not found.' });
        }
        
        // Insert connection request (ignore if already exists)
        const insertRequestQuery = `
            INSERT INTO connection_requests (sender_id, recipient_id, created_at) 
            VALUES ($1, $2, NOW())
            ON CONFLICT (sender_id, recipient_id) DO NOTHING
        `;
        await client.query(insertRequestQuery, [senderId, recipientId]);
        
        res.status(200).send({ message: 'Connection request sent.' });
    } catch (error) {
        console.error('Error sending connection request:', error);
        res.status(500).send({ error: 'Failed to send connection request.' });
    }
});

app.post('/api/users/:userId/accept-connect', async (req, res) => {
    try {
        const { userId: senderId } = req.params;
        const { currentUserId: recipientId } = req.body;
        if (!recipientId || senderId === recipientId) {
            return res.status(400).send({ error: 'Invalid request.' });
        }
        
        // Check if connection request exists
        const checkRequestQuery = `
            SELECT request_id FROM connection_requests 
            WHERE sender_id = $1 AND recipient_id = $2
        `;
        const requestResult = await client.query(checkRequestQuery, [senderId, recipientId]);
        if (requestResult.rows.length === 0) {
            return res.status(404).send({ error: 'Connection request not found.' });
        }
        
        // Begin transaction
        await client.query('BEGIN');
        
        try {
            // Remove connection request
            const deleteRequestQuery = `
                DELETE FROM connection_requests 
                WHERE sender_id = $1 AND recipient_id = $2
            `;
            await client.query(deleteRequestQuery, [senderId, recipientId]);
            
            // Add mutual connections
            const insertConnectionQuery = `
                INSERT INTO user_connections (follower_id, following_id, created_at) 
                VALUES ($1, $2, NOW()), ($2, $1, NOW())
                ON CONFLICT (follower_id, following_id) DO NOTHING
            `;
            await client.query(insertConnectionQuery, [recipientId, senderId]);
            
            await client.query('COMMIT');
            res.status(200).send({ message: 'Connection accepted.' });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Error accepting connection:', error);
        res.status(500).send({ error: 'Failed to accept connection.' });
    }
});

app.post('/api/users/:userId/cancel-request', async (req, res) => {
    try {
        const { userId: recipientId } = req.params;
        const { currentUserId: senderId } = req.body;
        if (!senderId) return res.status(400).send({ error: 'Current user ID is required.' });
        
        // Remove connection request
        const deleteRequestQuery = `
            DELETE FROM connection_requests 
            WHERE sender_id = $1 AND recipient_id = $2
        `;
        await client.query(deleteRequestQuery, [senderId, recipientId]);
        
        res.status(200).send({ message: 'Request cancelled.' });
    } catch (error) {
        console.error('Error cancelling request:', error);
        res.status(500).send({ error: 'Failed to cancel request.' });
    }
});

app.post('/api/users/notifications', async (req, res) => {
    try {
        const { userIds } = req.body;
        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(200).send([]);
        }
        
        // Create placeholders for the IN clause
        const placeholders = userIds.map((_, index) => `$${index + 1}`).join(',');
        
        const getUsersQuery = `
            SELECT 
                user_id as id,
                username,
                display_name as "displayName",
                profile_picture_url as "profilePictureUrl",
                bio
            FROM users 
            WHERE user_id IN (${placeholders})
        `;
        
        const result = await client.query(getUsersQuery, userIds);
        res.status(200).send(result.rows);
    } catch (error) {
        console.error('Error fetching notification data:', error);
        res.status(500).send({ error: 'Failed to fetch notification data.' });
    }
});

// USER PROFILE ROUTES
app.get('/api/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const getUserQuery = `
            SELECT 
                user_id as id,
                username,
                display_name as "displayName",
                profile_picture_url as "profilePictureUrl",
                bio,
                headline,
                location,
                skills,
                social_links as "socialLinks",
                created_at as "createdAt"
            FROM users 
            WHERE user_id = $1
        `;
        
        const result = await client.query(getUserQuery, [userId]);
        if (result.rows.length === 0) {
            return res.status(404).send({ error: 'User not found.' });
        }
        
        const user = result.rows[0];
        
        // Get followers (users who follow this user)
        const followersQuery = `
            SELECT follower_id FROM user_connections WHERE following_id = $1
        `;
        const followersResult = await client.query(followersQuery, [userId]);
        user.followers = followersResult.rows.map(row => row.follower_id);
        
        // Get following (users this user follows)
        const followingQuery = `
            SELECT following_id FROM user_connections WHERE follower_id = $1
        `;
        const followingResult = await client.query(followingQuery, [userId]);
        user.following = followingResult.rows.map(row => row.following_id);
        
        // Get connection requests sent by this user
        const requestsSentQuery = `
            SELECT recipient_id FROM connection_requests WHERE sender_id = $1
        `;
        const requestsSentResult = await client.query(requestsSentQuery, [userId]);
        user.connectionRequestsSent = requestsSentResult.rows.map(row => row.recipient_id);
        
        // Get connection requests received by this user
        const requestsReceivedQuery = `
            SELECT sender_id FROM connection_requests WHERE recipient_id = $1
        `;
        const requestsReceivedResult = await client.query(requestsReceivedQuery, [userId]);
        user.connectionRequestsReceived = requestsReceivedResult.rows.map(row => row.sender_id);
        
        res.status(200).send(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).send({ error: 'Failed to fetch user.' });
    }
});

app.put('/api/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { username, displayName, bio, headline, location, skills, socialLinks, profilePictureUrl } = req.body;
        
        console.log('Backend: PUT /api/users/:userId received data:', {
            userId,
            username,
            displayName,
            bio,
            headline,
            location,
            skills,
            socialLinks,
            profilePictureUrl
        });
        
        const updateUserQuery = `
            UPDATE users 
            SET 
                username = COALESCE($2, username),
                display_name = COALESCE($3, display_name),
                bio = COALESCE($4, bio),
                headline = COALESCE($5, headline),
                location = COALESCE($6, location),
                skills = COALESCE($7::jsonb, skills),
                social_links = COALESCE($8::jsonb, social_links),
                profile_picture_url = COALESCE($9, profile_picture_url)
            WHERE user_id = $1
            RETURNING 
                user_id as id, 
                username, 
                display_name as "displayName", 
                bio, 
                headline,
                location,
                skills,
                social_links as "socialLinks",
                profile_picture_url as "profilePictureUrl"
        `;
        
        const result = await client.query(updateUserQuery, [
            userId, 
            username, 
            displayName, 
            bio, 
            headline, 
            location, 
            skills ? JSON.stringify(skills) : null,
            socialLinks ? JSON.stringify(socialLinks) : null,
            profilePictureUrl
        ]);
        if (result.rows.length === 0) {
            return res.status(404).send({ error: 'User not found.' });
        }
        
        res.status(200).send(result.rows[0]);
    } catch (error) {
        console.error('Error updating user:', error);
        if (error.code === '23505') {
            res.status(400).send({ error: 'Username already exists.' });
        } else {
            res.status(500).send({ error: 'Failed to update user.' });
        }
    }
});

// Create user endpoint for when users sign up
app.post('/api/users', async (req, res) => {
    try {
        console.log('DEBUG: Creating user with data:', req.body);
        const { userId, username, email, displayName, profilePictureUrl, bio } = req.body;
        if (!userId || !username || !email || !displayName) {
            console.log('DEBUG: Missing required fields for user creation');
            return res.status(400).send({ error: 'userId, username, email, and displayName are required.' });
        }
        
        const insertUserQuery = `
            INSERT INTO users (user_id, username, email, display_name, display_name_lowercase, profile_picture_url, bio, created_at) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                username = EXCLUDED.username,
                email = EXCLUDED.email,
                display_name = EXCLUDED.display_name,
                display_name_lowercase = EXCLUDED.display_name_lowercase,
                profile_picture_url = EXCLUDED.profile_picture_url,
                bio = EXCLUDED.bio
            RETURNING user_id as id, username, display_name as "displayName", profile_picture_url as "profilePictureUrl", bio
        `;
        
        const result = await client.query(insertUserQuery, [userId, username, email, displayName, displayName.toLowerCase(), profilePictureUrl, bio]);
        console.log('DEBUG: User created successfully:', result.rows[0]);
        res.status(201).send(result.rows[0]);
    } catch (error) {
        console.error('Error creating user:', error);
        if (error.code === '23505') {
            res.status(400).send({ error: 'Username or email already exists.' });
        } else {
            res.status(500).send({ error: 'Failed to create user.' });
        }
    }
});

// Get user's connections/followers/following
app.get('/api/users/:userId/connections', async (req, res) => {
    try {
        const { userId } = req.params;
        const { type } = req.query; // 'followers', 'following', or 'requests'
        
        let query;
        let params = [userId];
        
        if (type === 'followers') {
            query = `
                SELECT 
                    u.user_id as id,
                    u.username,
                    u.display_name as "displayName",
                    u.profile_picture_url as "profilePictureUrl",
                    u.bio
                FROM user_connections uc
                JOIN users u ON uc.follower_id = u.user_id
                WHERE uc.following_id = $1
                ORDER BY uc.created_at DESC
            `;
        } else if (type === 'following') {
            query = `
                SELECT 
                    u.user_id as id,
                    u.username,
                    u.display_name as "displayName",
                    u.profile_picture_url as "profilePictureUrl",
                    u.bio
                FROM user_connections uc
                JOIN users u ON uc.following_id = u.user_id
                WHERE uc.follower_id = $1
                ORDER BY uc.created_at DESC
            `;
        } else if (type === 'requests') {
            query = `
                SELECT 
                    u.user_id as id,
                    u.username,
                    u.display_name as "displayName",
                    u.profile_picture_url as "profilePictureUrl",
                    u.bio
                FROM connection_requests cr
                JOIN users u ON cr.sender_id = u.user_id
                WHERE cr.recipient_id = $1
                ORDER BY cr.created_at DESC
            `;
        } else {
            return res.status(400).send({ error: 'Invalid type parameter. Use followers, following, or requests.' });
        }
        
        const result = await client.query(query, params);
        res.status(200).send(result.rows);
    } catch (error) {
        console.error('Error fetching connections:', error);
        res.status(500).send({ error: 'Failed to fetch connections.' });
    }
});

// POLLS ROUTES
app.post('/api/polls', async (req, res) => {
    try {
        const { userId, question, description, options, allowMultipleVotes, expiresAt } = req.body;
        if (!userId || !question || !options || options.length < 2) {
            return res.status(400).send({ error: 'userId, question, and at least 2 options are required.' });
        }
        if (options.length > 20) {
            return res.status(400).send({ error: 'Maximum 20 options allowed.' });
        }
        
        // Check if user exists, create if not
        const checkUserQuery = `SELECT user_id FROM users WHERE user_id = $1`;
        const userResult = await client.query(checkUserQuery, [userId]);
        
        if (userResult.rows.length === 0) {
            const createUserQuery = `
                INSERT INTO users (user_id, username, email, display_name, display_name_lowercase, created_at) 
                VALUES ($1, $2, $3, $4, $5, NOW())
            `;
            const tempUsername = `user_${userId.slice(-8)}`;
            const tempEmail = `${userId}@temp.com`;
            const tempDisplayName = `User ${userId.slice(-8)}`;
            await client.query(createUserQuery, [userId, tempUsername, tempEmail, tempDisplayName, tempDisplayName.toLowerCase()]);
        }
        
        // Begin transaction
        await client.query('BEGIN');
        
        try {
            // Insert poll
            const insertPollQuery = `
                INSERT INTO polls (user_id, question, description, allow_multiple_votes, expires_at) 
                VALUES ($1, $2, $3, $4, $5) 
                RETURNING poll_id, created_at
            `;
            const pollResult = await client.query(insertPollQuery, [
                userId, 
                question, 
                description, 
                allowMultipleVotes || false,
                expiresAt ? new Date(expiresAt) : null
            ]);
            const pollId = pollResult.rows[0].poll_id;
            
            // Insert poll options
            const insertOptionQuery = `
                INSERT INTO poll_options (poll_id, option_text, option_order) 
                VALUES ($1, $2, $3)
            `;
            for (let i = 0; i < options.length; i++) {
                await client.query(insertOptionQuery, [pollId, options[i], i + 1]);
            }
            
            await client.query('COMMIT');
            res.status(201).send({ message: 'Poll created successfully', pollId });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Error creating poll:', error);
        res.status(500).send({ error: 'Failed to create poll.' });
    }
});

app.get('/api/polls', async (req, res) => {
    try {
        const pollsQuery = `
            SELECT 
                p.poll_id as id,
                p.user_id as "userId",
                p.question,
                p.description,
                p.allow_multiple_votes as "allowMultipleVotes",
                p.created_at,
                p.expires_at as "expiresAt",
                u.username,
                u.display_name as "displayName",
                u.profile_picture_url as "profilePictureUrl",
                COALESCE(
                    json_agg(
                        json_build_object(
                            'optionId', po.option_id,
                            'text', po.option_text,
                            'order', po.option_order,
                            'votes', COALESCE(vote_counts.vote_count, 0)
                        )
                        ORDER BY po.option_order
                    ) FILTER (WHERE po.option_id IS NOT NULL), 
                    '[]'::json
                ) as options,
                COALESCE(
                    json_agg(
                        DISTINCT pv.user_id
                    ) FILTER (WHERE pv.user_id IS NOT NULL), 
                    '[]'::json
                ) as "userVotes"
            FROM polls p
            JOIN users u ON p.user_id = u.user_id
            LEFT JOIN poll_options po ON p.poll_id = po.poll_id
            LEFT JOIN poll_votes pv ON p.poll_id = pv.poll_id
            LEFT JOIN (
                SELECT 
                    option_id,
                    COUNT(*) as vote_count
                FROM poll_votes
                GROUP BY option_id
            ) vote_counts ON po.option_id = vote_counts.option_id
            GROUP BY p.poll_id, p.user_id, p.question, p.description, p.allow_multiple_votes, p.created_at, p.expires_at, u.username, u.display_name, u.profile_picture_url
            ORDER BY p.created_at DESC
        `;
        
        const result = await client.query(pollsQuery);
        
        const polls = result.rows.map(row => ({
            ...row,
            createdAt: new Date(row.created_at).getTime(),
            expiresAt: row.expiresAt ? new Date(row.expiresAt).getTime() : null
        }));
        
        res.status(200).send(polls);
    } catch (error) {
        console.error('Error fetching polls:', error);
        res.status(500).send({ error: 'Failed to fetch polls.' });
    }
});

app.post('/api/polls/:pollId/vote', async (req, res) => {
    try {
        const { pollId } = req.params;
        const { userId, optionIds } = req.body;
        if (!userId || !optionIds || !Array.isArray(optionIds) || optionIds.length === 0) {
            return res.status(400).send({ error: 'userId and optionIds array are required.' });
        }
        
        // Get poll details
        const pollQuery = `SELECT allow_multiple_votes FROM polls WHERE poll_id = $1`;
        const pollResult = await client.query(pollQuery, [pollId]);
        if (pollResult.rows.length === 0) {
            return res.status(404).send({ error: 'Poll not found.' });
        }
        
        const allowMultipleVotes = pollResult.rows[0].allow_multiple_votes;
        
        // Validate vote count
        if (!allowMultipleVotes && optionIds.length > 1) {
            return res.status(400).send({ error: 'This poll only allows one vote per user.' });
        }
        
        // Begin transaction
        await client.query('BEGIN');
        
        try {
            // Remove existing votes for this user on this poll
            const deleteVotesQuery = `DELETE FROM poll_votes WHERE poll_id = $1 AND user_id = $2`;
            await client.query(deleteVotesQuery, [pollId, userId]);
            
            // Add new votes
            const insertVoteQuery = `
                INSERT INTO poll_votes (poll_id, option_id, user_id) 
                VALUES ($1, $2, $3)
            `;
            for (const optionId of optionIds) {
                await client.query(insertVoteQuery, [pollId, optionId, userId]);
            }
            
            await client.query('COMMIT');
            res.status(200).send({ message: 'Vote recorded successfully.' });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Error voting on poll:', error);
        res.status(500).send({ error: 'Failed to vote on poll.' });
    }
});

app.delete('/api/polls/:pollId', async (req, res) => {
    try {
        const { pollId } = req.params;
        const { userId } = req.body;
        if (!userId) return res.status(400).send({ error: 'User ID is required.' });
        
        // Check if poll exists and belongs to user
        const checkPollQuery = `SELECT user_id FROM polls WHERE poll_id = $1`;
        const checkResult = await client.query(checkPollQuery, [pollId]);
        
        if (checkResult.rows.length === 0) {
            return res.status(404).send({ error: 'Poll not found.' });
        }
        
        if (checkResult.rows[0].user_id !== userId) {
            return res.status(403).send({ error: 'Forbidden' });
        }
        
        // Delete poll (cascade will handle related records)
        const deletePollQuery = `DELETE FROM polls WHERE poll_id = $1`;
        await client.query(deletePollQuery, [pollId]);
        
        res.status(200).send({ message: 'Poll deleted successfully.' });
    } catch (error) {
        console.error('Error deleting poll:', error);
        res.status(500).send({ error: 'Failed to delete poll.' });
    }
});

// COMBINED FEED (POSTS + POLLS)
app.get('/api/feed', async (req, res) => {
    try {
        const { type = 'all' } = req.query; // 'all', 'posts', 'polls'
        
        let feedItems = [];
        
        if (type === 'all' || type === 'posts') {
            // Fetch posts
            const postsQuery = `
                SELECT 
                    'post' as type,
                    p.post_id as id,
                    p.user_id as "userId",
                    p.description,
                    p.created_at,
                    u.username,
                    u.display_name as "displayName",
                    u.profile_picture_url as "profilePictureUrl",
                    COALESCE(
                        json_agg(
                            DISTINCT pi.image_url
                        ) FILTER (WHERE pi.image_url IS NOT NULL), 
                        '[]'::json
                    ) as "imageUrls",
                    COALESCE(
                        json_agg(
                            DISTINCT jsonb_build_object(
                                'userId', l.user_id
                            )
                        ) FILTER (WHERE l.user_id IS NOT NULL), 
                        '[]'::json
                    ) as likes,
                    COALESCE(
                        json_agg(
                            DISTINCT jsonb_build_object(
                                'userId', c.user_id,
                                'text', c.comment_text,
                                'createdAt', EXTRACT(EPOCH FROM c.created_at) * 1000
                            )
                        ) FILTER (WHERE c.comment_text IS NOT NULL), 
                        '[]'::json
                    ) as comments
                FROM posts p
                JOIN users u ON p.user_id = u.user_id
                LEFT JOIN post_images pi ON p.post_id = pi.post_id
                LEFT JOIN likes l ON p.post_id = l.post_id
                LEFT JOIN comments c ON p.post_id = c.post_id
                GROUP BY p.post_id, p.user_id, p.description, p.created_at, u.username, u.display_name, u.profile_picture_url
            `;
            
            const postsResult = await client.query(postsQuery);
            const posts = postsResult.rows.map(row => ({
                ...row,
                createdAt: new Date(row.created_at).getTime()
            }));
            feedItems = feedItems.concat(posts);
        }
        
        if (type === 'all' || type === 'polls') {
            // Fetch polls
            const pollsQuery = `
                SELECT 
                    'poll' as type,
                    p.poll_id as id,
                    p.user_id as "userId",
                    p.question,
                    p.description,
                    p.allow_multiple_votes as "allowMultipleVotes",
                    p.created_at,
                    p.expires_at as "expiresAt",
                    u.username,
                    u.display_name as "displayName",
                    u.profile_picture_url as "profilePictureUrl",
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'optionId', po.option_id,
                                'text', po.option_text,
                                'order', po.option_order,
                                'votes', COALESCE(vote_counts.vote_count, 0)
                            )
                            ORDER BY po.option_order
                        ) FILTER (WHERE po.option_id IS NOT NULL), 
                        '[]'::json
                    ) as options,
                    COALESCE(
                        json_agg(
                            DISTINCT pv.user_id
                        ) FILTER (WHERE pv.user_id IS NOT NULL), 
                        '[]'::json
                    ) as "userVotes"
                FROM polls p
                JOIN users u ON p.user_id = u.user_id
                LEFT JOIN poll_options po ON p.poll_id = po.poll_id
                LEFT JOIN poll_votes pv ON p.poll_id = pv.poll_id
                LEFT JOIN (
                    SELECT 
                        option_id,
                        COUNT(*) as vote_count
                    FROM poll_votes
                    GROUP BY option_id
                ) vote_counts ON po.option_id = vote_counts.option_id
                GROUP BY p.poll_id, p.user_id, p.question, p.description, p.allow_multiple_votes, p.created_at, p.expires_at, u.username, u.display_name, u.profile_picture_url
            `;
            
            const pollsResult = await client.query(pollsQuery);
            const polls = pollsResult.rows.map(row => ({
                ...row,
                createdAt: new Date(row.created_at).getTime(),
                expiresAt: row.expiresAt ? new Date(row.expiresAt).getTime() : null
            }));
            feedItems = feedItems.concat(polls);
        }
        
        // Sort by creation time (newest first)
        feedItems.sort((a, b) => b.createdAt - a.createdAt);
        
        res.status(200).send(feedItems);
    } catch (error) {
        console.error('Error fetching feed:', error);
        res.status(500).send({ error: 'Failed to fetch feed.' });
    }
});

// PLACEHOLDER CHAT/MESSAGING ENDPOINTS (to be implemented later)
app.get('/api/users/:userId/chats', async (req, res) => {
    try {
        // For now, return empty array - implement proper chat functionality later
        res.status(200).send([]);
    } catch (error) {
        console.error('Error fetching chats:', error);
        res.status(500).send({ error: 'Failed to fetch chats.' });
    }
});

app.get('/api/chats/:chatId/messages', async (req, res) => {
    try {
        // For now, return empty array - implement proper messaging functionality later
        res.status(200).send([]);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).send({ error: 'Failed to fetch messages.' });
    }
});


// 3. Start Server
app.listen(PORT, () => {
  console.log(`🚀 EduLink Backend Server Started!`);
  console.log(`📍 Environment: ${isDevelopment ? 'Development' : isAzure ? 'Azure Cloud' : 'Production'}`);
  console.log(`🌐 Server running on: ${isDevelopment ? `http://localhost:${PORT}` : `Port ${PORT}`}`);
  console.log(`💾 Database: PostgreSQL ${isDevelopment ? '(Local/Neon)' : '(Neon Cloud)'}`);
  console.log(`☁️ Storage: ${sharedKeyCredential ? 'Azure Blob Storage' : 'Not configured (Dev mode)'}`);
  console.log(`🔐 Auth: Firebase Admin SDK`);
  console.log('✅ Ready to accept requests!');
});
